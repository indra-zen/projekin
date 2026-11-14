-- QA and security review fixes (2026-11-14). See docs/IMPLEMENTATION_PLAN.md §0.
--
-- 1. Reviews are public (DATABASE §9, §10), but 20261114000000 granted SELECT
--    to `authenticated` only: signed-out visitors got "permission denied for
--    table reviews", so public profiles showed no reviews at all.
-- 2. The rating views of DATABASE §4.19 were never created. Add them, and add
--    rating_avg / rating_count to service_listings (cards, sort by rating).
-- 3. order-files is immutable evidence (DATABASE §11.2). 20261114000000 let
--    the freelancer delete any object in the order folder, including files
--    already delivered (and disputed). No code path deletes them.
-- 4. send_order_message: BR-29 allows messages only while the order is
--    in_progress, delivered or disputed (it also accepted completed orders),
--    and admins may post (API_CONTRACT §4.8: participant or admin).
-- 5. create_order_review: a NULL rating is a validation error (it surfaced as
--    a NOT NULL violation, i.e. INTERNAL_ERROR); a concurrent duplicate maps
--    to ALREADY_REVIEWED.
-- 6. Defence in depth for direct PostgREST writes: a service cover and the
--    portfolio images must be paths inside the owner's storage folder (the
--    server actions already check this; the database did not).

-- ---------------------------------------------------------------------------
-- 1. Public reviews
-- ---------------------------------------------------------------------------

grant select on public.reviews to anon;

create index if not exists reviews_service_idx
  on public.reviews (service_id)
  where service_id is not null;

-- ---------------------------------------------------------------------------
-- 2. Rating views (security_invoker: the reviews policy decides visibility)
-- ---------------------------------------------------------------------------

create view public.freelancer_rating_stats
with (security_invoker = true)
as
select reviewee_id as user_id,
       round(avg(rating), 2) as rating_avg,
       count(*)::integer as rating_count
from public.reviews
where reviewer_role = 'client'
group by reviewee_id;

create view public.client_rating_stats
with (security_invoker = true)
as
select reviewee_id as user_id,
       round(avg(rating), 2) as rating_avg,
       count(*)::integer as rating_count
from public.reviews
where reviewer_role = 'freelancer'
group by reviewee_id;

create view public.service_rating_stats
with (security_invoker = true)
as
select service_id,
       round(avg(rating), 2) as rating_avg,
       count(*)::integer as rating_count
from public.reviews
where reviewer_role = 'client' and service_id is not null
group by service_id;

revoke all on public.freelancer_rating_stats, public.client_rating_stats,
  public.service_rating_stats
from anon, authenticated;
grant select on public.freelancer_rating_stats, public.client_rating_stats,
  public.service_rating_stats
to anon, authenticated;

-- Same columns as 20261113080600, plus the rating columns at the end.
create or replace view public.service_listings
with (security_invoker = true)
as
select
  s.id, s.freelancer_id, s.category_id, s.title, s.description, s.price,
  s.delivery_days, s.revisions_included, s.requirements_prompt,
  s.cover_image_path, s.published_at, s.created_at, s.updated_at,
  c.slug as category_slug, c.name as category_name,
  p.username as freelancer_username, p.full_name as freelancer_name,
  p.avatar_path as freelancer_avatar_path,
  fp.headline as freelancer_headline, fp.skills as freelancer_skills,
  u.name as university_name, u.short_name as university_short_name,
  coalesce(rs.rating_avg, 0) as rating_avg,
  coalesce(rs.rating_count, 0) as rating_count
from public.services s
join public.categories c on c.id = s.category_id and c.is_active
join public.profiles p on p.id = s.freelancer_id and p.onboarded_at is not null
join public.freelancer_profiles fp on fp.user_id = s.freelancer_id
join public.universities u on u.id = fp.university_id
left join public.service_rating_stats rs on rs.service_id = s.id
where s.status = 'published'
  and s.blocked_at is null
  and fp.status = 'active'
  and fp.verified_until > now();

-- ---------------------------------------------------------------------------
-- 3. Delivered files are immutable
-- ---------------------------------------------------------------------------

drop policy if exists order_files_delete_freelancer on storage.objects;

-- ---------------------------------------------------------------------------
-- 4. send_order_message (BR-29, admins may post)
-- ---------------------------------------------------------------------------

create or replace function public.send_order_message(p_order_id uuid, p_body text)
returns public.order_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders;
  v_row public.order_messages;
  v_body text := btrim(coalesce(p_body, ''));
begin
  if v_uid is null then
    raise exception using errcode = 'PJ401', message = 'UNAUTHENTICATED';
  end if;

  -- FOR SHARE: a concurrent status change waits until the message is stored.
  select * into v_order from public.orders where id = p_order_id for share;
  if v_order.id is null
     or (v_uid not in (v_order.client_id, v_order.freelancer_id) and not private.is_admin()) then
    raise exception using errcode = 'PJ404', message = 'ORDER_NOT_FOUND';
  end if;
  if v_order.status = 'awaiting_payment' then
    raise exception using errcode = 'PJ409', message = 'MESSAGES_NOT_AVAILABLE';
  end if;
  if v_order.status not in ('in_progress', 'delivered', 'disputed') then
    raise exception using errcode = 'PJ409', message = 'MESSAGES_CLOSED';
  end if;
  if char_length(v_body) not between 1 and 5000 then
    raise exception using errcode = 'PJ422', message = 'INVALID_MESSAGE';
  end if;

  insert into public.order_messages (order_id, sender_id, body)
  values (v_order.id, v_uid, v_body)
  returning * into v_row;
  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. create_order_review (BR-22)
-- ---------------------------------------------------------------------------

create or replace function public.create_order_review(
  p_order_id uuid,
  p_rating smallint,
  p_comment text default null
)
returns public.reviews
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders;
  v_role public.review_role;
  v_reviewee uuid;
  v_row public.reviews;
  v_comment text := nullif(btrim(coalesce(p_comment, '')), '');
begin
  if v_uid is null then
    raise exception using errcode = 'PJ401', message = 'UNAUTHENTICATED';
  end if;

  select * into v_order from public.orders where id = p_order_id;
  if v_order.id is null or v_uid not in (v_order.client_id, v_order.freelancer_id) then
    raise exception using errcode = 'PJ404', message = 'ORDER_NOT_FOUND';
  end if;
  if v_order.status <> 'completed' or v_order.completed_at < now() - interval '14 days' then
    raise exception using errcode = 'PJ409', message = 'REVIEW_WINDOW_CLOSED';
  end if;
  if p_rating is null or p_rating not between 1 and 5 then
    raise exception using errcode = 'PJ422', message = 'INVALID_RATING';
  end if;
  if v_comment is not null and char_length(v_comment) > 2000 then
    raise exception using errcode = 'PJ422', message = 'INVALID_REVIEW_COMMENT';
  end if;

  if v_uid = v_order.client_id then
    v_role := 'client';
    v_reviewee := v_order.freelancer_id;
  else
    v_role := 'freelancer';
    v_reviewee := v_order.client_id;
  end if;

  begin
    insert into public.reviews (
      order_id, reviewer_id, reviewee_id, reviewer_role, service_id, rating, comment
    )
    values (
      v_order.id, v_uid, v_reviewee, v_role,
      case when v_role = 'client' then v_order.service_id else null end,
      p_rating, v_comment
    )
    returning * into v_row;
  exception when unique_violation then
    raise exception using errcode = 'PJ409', message = 'ALREADY_REVIEWED';
  end;
  return v_row;
end;
$$;

-- create or replace keeps the existing grants (authenticated only).

-- ---------------------------------------------------------------------------
-- 6. Storage paths stay in the owner's folder (direct PostgREST writes)
-- ---------------------------------------------------------------------------

-- True when every path is non-null, starts with "{owner}/" and has no "..".
create function private.storage_paths_owned(p_paths text[], p_owner uuid)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    bool_and(
      p is not null
      and starts_with(p, p_owner::text || '/')
      and position('..' in p) = 0
    ),
    true
  )
  from unnest(p_paths) as p;
$$;

revoke all on function private.storage_paths_owned(text[], uuid) from public;
-- Evaluated inside CHECK constraints, i.e. with the writer's privileges.
grant execute on function private.storage_paths_owned(text[], uuid)
  to anon, authenticated, service_role;

-- NOT VALID: enforced for every new write; existing rows are not rechecked.
alter table public.services
  add constraint services_cover_path_owned check (
    cover_image_path is null
    or private.storage_paths_owned(array[cover_image_path], freelancer_id)
  ) not valid;

alter table public.portfolio_items
  add constraint portfolio_items_image_paths_owned check (
    private.storage_paths_owned(image_paths, freelancer_id)
  ) not valid;
