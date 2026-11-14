-- Phase 7/8: fulfilment, order communication and reviews.
-- All state changes remain server-side RPCs so the order state machine cannot
-- be bypassed by direct table writes.

create type public.dispute_status as enum ('open', 'resolved');
create type public.dispute_resolution as enum ('release_to_freelancer', 'refund_client');
create type public.review_role as enum ('client', 'freelancer');

create table public.order_messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  sender_id uuid not null references public.profiles (id) on delete restrict,
  body text not null,
  created_at timestamptz not null default now(),
  constraint order_messages_body_length check (char_length(body) between 1 and 5000)
);

create index order_messages_order_created_idx
  on public.order_messages (order_id, created_at);

create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete restrict,
  opened_by uuid not null references public.profiles (id) on delete restrict,
  reason text not null,
  status public.dispute_status not null default 'open',
  resolution public.dispute_resolution,
  admin_note text,
  resolved_by uuid references public.profiles (id) on delete restrict,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint disputes_reason_length check (char_length(reason) between 20 and 2000),
  constraint disputes_resolution_fields check (
    (status = 'open' and resolution is null and admin_note is null and resolved_by is null and resolved_at is null)
    or
    (status = 'resolved' and resolution is not null and char_length(admin_note) between 1 and 2000
      and resolved_by is not null and resolved_at is not null)
  )
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  reviewer_id uuid not null references public.profiles (id) on delete restrict,
  reviewee_id uuid not null references public.profiles (id) on delete restrict,
  reviewer_role public.review_role not null,
  service_id uuid references public.services (id) on delete restrict,
  rating smallint not null,
  comment text,
  created_at timestamptz not null default now(),
  constraint reviews_one_per_reviewer unique (order_id, reviewer_id),
  constraint reviews_rating check (rating between 1 and 5),
  constraint reviews_comment_length check (comment is null or char_length(comment) <= 2000),
  constraint reviews_participants check (reviewer_id <> reviewee_id),
  constraint reviews_service_context check (
    reviewer_role = 'freelancer' and service_id is null
    or reviewer_role = 'client'
  )
);

create index reviews_reviewee_created_idx on public.reviews (reviewee_id, created_at desc);
create index reviews_order_idx on public.reviews (order_id);

-- Private delivery files. The first path segment is the order id and the
-- second is the freelancer id, matching deliver_order's validation.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'order-files',
  'order-files',
  false,
  26214400,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'application/pdf',
    'application/zip', 'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Reset defaults before granting only the operations used by the app.
revoke all on table public.order_messages, public.disputes, public.reviews
from anon, authenticated;

grant select on public.order_messages, public.disputes, public.reviews to authenticated;

alter table public.order_messages enable row level security;
alter table public.disputes enable row level security;
alter table public.reviews enable row level security;

create policy order_messages_select_participant on public.order_messages
for select to authenticated
using (private.is_order_participant(order_id) or (select private.is_admin()));

create policy disputes_select_participant_or_admin on public.disputes
for select to authenticated
using (private.is_order_participant(order_id) or (select private.is_admin()));

create policy reviews_select_public on public.reviews
for select to anon, authenticated
using (true);

create policy order_files_insert_freelancer on storage.objects
for insert to authenticated
with check (
  bucket_id = 'order-files'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and exists (
    select 1 from public.orders
    where id::text = (storage.foldername(name))[1]
      and freelancer_id = (select auth.uid())
      and status = 'in_progress'
  )
);

create policy order_files_select_participant on storage.objects
for select to authenticated
using (
  bucket_id = 'order-files'
  and exists (
    select 1 from public.orders
    where id::text = (storage.foldername(name))[1]
      and (client_id = (select auth.uid()) or freelancer_id = (select auth.uid())
           or (select private.is_admin()))
  )
);

create policy order_files_delete_freelancer on storage.objects
for delete to authenticated
using (
  bucket_id = 'order-files'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and exists (
    select 1 from public.orders
    where id::text = (storage.foldername(name))[1]
      and freelancer_id = (select auth.uid())
  )
);

create function public.send_order_message(p_order_id uuid, p_body text)
returns public.order_messages
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders;
  v_row public.order_messages;
  v_body text := btrim(coalesce(p_body, ''));
begin
  if v_uid is null then raise exception using errcode = 'PJ401', message = 'UNAUTHENTICATED'; end if;
  select * into v_order from public.orders where id = p_order_id;
  if v_order.id is null or v_uid not in (v_order.client_id, v_order.freelancer_id) then
    raise exception using errcode = 'PJ404', message = 'ORDER_NOT_FOUND';
  end if;
  if v_order.status in ('awaiting_payment', 'cancelled') then
    raise exception using errcode = 'PJ409', message = 'MESSAGES_NOT_AVAILABLE';
  end if;
  if char_length(v_body) not between 1 and 5000 then
    raise exception using errcode = 'PJ422', message = 'INVALID_MESSAGE';
  end if;
  insert into public.order_messages (order_id, sender_id, body)
  values (p_order_id, v_uid, v_body)
  returning * into v_row;
  return v_row;
end;
$$;

create function public.request_order_revision(p_order_id uuid, p_reason text)
returns public.orders
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if v_uid is null then raise exception using errcode = 'PJ401', message = 'UNAUTHENTICATED'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null or v_uid <> v_order.client_id then
    raise exception using errcode = 'PJ404', message = 'ORDER_NOT_FOUND';
  end if;
  if v_order.status <> 'delivered' then
    raise exception using errcode = 'PJ409', message = 'ORDER_NOT_DELIVERED';
  end if;
  if v_order.revisions_used >= v_order.revisions_allowed then
    raise exception using errcode = 'PJ409', message = 'NO_REVISIONS_REMAINING';
  end if;
  if char_length(v_reason) not between 10 and 2000 then
    raise exception using errcode = 'PJ422', message = 'INVALID_REVISION_REASON';
  end if;
  update public.orders
     set status = 'in_progress', revisions_used = revisions_used + 1
   where id = v_order.id
   returning * into v_order;
  insert into public.order_messages (order_id, sender_id, body)
  values (v_order.id, v_uid, v_reason);
  insert into public.order_events (order_id, actor_id, event_type, from_status, to_status, payload)
  values (v_order.id, v_uid, 'revision_requested', 'delivered', 'in_progress',
          jsonb_build_object('reason', v_reason, 'revisions_used', v_order.revisions_used));
  return v_order;
end;
$$;

create function public.open_order_dispute(p_order_id uuid, p_reason text)
returns public.disputes
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders;
  v_row public.disputes;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if v_uid is null then raise exception using errcode = 'PJ401', message = 'UNAUTHENTICATED'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null or v_uid not in (v_order.client_id, v_order.freelancer_id) then
    raise exception using errcode = 'PJ404', message = 'ORDER_NOT_FOUND';
  end if;
  if v_order.status not in ('in_progress', 'delivered') then
    raise exception using errcode = 'PJ409', message = 'ORDER_NOT_DISPUTABLE';
  end if;
  if char_length(v_reason) not between 20 and 2000 then
    raise exception using errcode = 'PJ422', message = 'INVALID_DISPUTE_REASON';
  end if;
  if exists (select 1 from public.disputes where order_id = v_order.id) then
    raise exception using errcode = 'PJ409', message = 'DISPUTE_EXISTS';
  end if;
  insert into public.disputes (order_id, opened_by, reason)
  values (v_order.id, v_uid, v_reason)
  returning * into v_row;
  update public.orders set status = 'disputed' where id = v_order.id;
  insert into public.order_events (order_id, actor_id, event_type, from_status, to_status, payload)
  values (v_order.id, v_uid, 'dispute_opened', v_order.status, 'disputed',
          jsonb_build_object('reason', v_reason));
  return v_row;
end;
$$;

create function public.create_order_review(
  p_order_id uuid,
  p_rating smallint,
  p_comment text default null
)
returns public.reviews
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders;
  v_role public.review_role;
  v_reviewee uuid;
  v_row public.reviews;
  v_comment text := nullif(btrim(coalesce(p_comment, '')), '');
begin
  if v_uid is null then raise exception using errcode = 'PJ401', message = 'UNAUTHENTICATED'; end if;
  select * into v_order from public.orders where id = p_order_id;
  if v_order.id is null or v_uid not in (v_order.client_id, v_order.freelancer_id) then
    raise exception using errcode = 'PJ404', message = 'ORDER_NOT_FOUND';
  end if;
  if v_order.status <> 'completed' or v_order.completed_at < now() - interval '14 days' then
    raise exception using errcode = 'PJ409', message = 'REVIEW_WINDOW_CLOSED';
  end if;
  if p_rating not between 1 and 5 then
    raise exception using errcode = 'PJ422', message = 'INVALID_RATING';
  end if;
  if v_comment is not null and char_length(v_comment) > 2000 then
    raise exception using errcode = 'PJ422', message = 'INVALID_REVIEW_COMMENT';
  end if;
  if v_uid = v_order.client_id then
    v_role := 'client'; v_reviewee := v_order.freelancer_id;
  else
    v_role := 'freelancer'; v_reviewee := v_order.client_id;
  end if;
  if exists (select 1 from public.reviews where order_id = v_order.id and reviewer_id = v_uid) then
    raise exception using errcode = 'PJ409', message = 'ALREADY_REVIEWED';
  end if;
  insert into public.reviews (order_id, reviewer_id, reviewee_id, reviewer_role, service_id, rating, comment)
  values (
    v_order.id, v_uid, v_reviewee, v_role,
    case when v_role = 'client' then v_order.service_id else null end,
    p_rating, v_comment
  )
  returning * into v_row;
  return v_row;
end;
$$;

create function public.auto_complete_delivered_orders()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_order public.orders;
  v_count integer := 0;
begin
  for v_order in
    select * from public.orders
    where status = 'delivered' and delivered_at + interval '3 days' <= now()
    order by delivered_at
    limit 500
    for update skip locked
  loop
    update public.orders
       set status = 'completed', completed_at = now(), payout_status = 'pending'
     where id = v_order.id and status = 'delivered';
    if found then
      insert into public.order_events (order_id, event_type, from_status, to_status)
      values (v_order.id, 'auto_completed', 'delivered', 'completed');
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

revoke all on function
  public.send_order_message(uuid, text),
  public.request_order_revision(uuid, text),
  public.open_order_dispute(uuid, text),
  public.create_order_review(uuid, smallint, text),
  public.auto_complete_delivered_orders()
from public, anon, authenticated;

grant execute on function
  public.send_order_message(uuid, text),
  public.request_order_revision(uuid, text),
  public.open_order_dispute(uuid, text),
  public.create_order_review(uuid, smallint, text)
to authenticated;
grant execute on function public.auto_complete_delivered_orders() to service_role;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    begin
      perform cron.schedule(
        'auto-complete-delivered-orders',
        '*/15 * * * *',
        'select public.auto_complete_delivered_orders()'
      );
    exception when unique_violation then
      null;
    end;
  end if;
end $$;
