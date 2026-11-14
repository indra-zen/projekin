-- Phase 9: admin money operations (DATABASE §7.2, PRD BR-21, BR-23, BR-24).
--
-- resolve_dispute        disputed order -> completed (payout pending) or
--                        cancelled (refund pending); dispute resolved.
-- mark_refund_completed  payment refund pending -> refunded (with reference).
-- mark_payout_paid       completed order payout pending -> paid (with reference).
--
-- Also: at most 50 objects per order in order-files (QA residual risk 2).
-- Lock order everywhere: jobs -> orders -> payments / disputes.

-- ---------------------------------------------------------------------------
-- resolve_dispute (FR-ADM-04)
-- ---------------------------------------------------------------------------

create function public.resolve_dispute(
  p_dispute_id uuid,
  p_resolution public.dispute_resolution,
  p_admin_note text
)
returns public.disputes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_dispute public.disputes;
  v_order public.orders;
  v_note text := btrim(coalesce(p_admin_note, ''));
begin
  if v_uid is null then
    raise exception using errcode = 'PJ401', message = 'UNAUTHENTICATED';
  end if;
  if not private.is_admin() then
    raise exception using errcode = 'PJ403', message = 'FORBIDDEN';
  end if;
  if p_resolution is null then
    raise exception using errcode = 'PJ422', message = 'INVALID_RESOLUTION';
  end if;
  if char_length(v_note) not between 1 and 2000 then
    raise exception using errcode = 'PJ422', message = 'INVALID_ADMIN_NOTE';
  end if;

  select * into v_dispute from public.disputes where id = p_dispute_id;
  if v_dispute.id is null then
    raise exception using errcode = 'PJ404', message = 'DISPUTE_NOT_FOUND';
  end if;

  select * into v_order from public.orders where id = v_dispute.order_id;
  if v_order.job_id is not null then
    perform 1 from public.jobs where id = v_order.job_id for update;
  end if;
  select * into v_order from public.orders where id = v_dispute.order_id for update;
  select * into v_dispute from public.disputes where id = p_dispute_id for update;

  if v_dispute.status <> 'open' or v_order.status <> 'disputed' then
    raise exception using errcode = 'PJ409', message = 'DISPUTE_NOT_OPEN';
  end if;

  if p_resolution = 'release_to_freelancer' then
    update public.orders
       set status = 'completed', completed_at = now(), payout_status = 'pending'
     where id = v_order.id;
  else
    -- Order cancelled by the admin; the paid payment becomes refund pending.
    perform private.apply_order_cancellation(
      v_order.id, v_uid, 'dispute_refund', 'cancelled'
    );
  end if;

  update public.disputes
     set status = 'resolved', resolution = p_resolution, admin_note = v_note,
         resolved_by = v_uid, resolved_at = now()
   where id = v_dispute.id
  returning * into v_dispute;

  insert into public.order_events (order_id, actor_id, event_type, from_status, to_status, payload)
  values (
    v_order.id, v_uid, 'dispute_resolved', 'disputed',
    case when p_resolution = 'release_to_freelancer'
      then 'completed'::public.order_status else 'cancelled'::public.order_status end,
    jsonb_build_object('resolution', p_resolution)
  );
  return v_dispute;
end;
$$;

-- ---------------------------------------------------------------------------
-- mark_refund_completed (FR-ADM-05, BR-24)
-- ---------------------------------------------------------------------------

create function public.mark_refund_completed(p_payment_id uuid, p_reference text)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_payment public.payments;
  v_ref text := btrim(coalesce(p_reference, ''));
begin
  if v_uid is null then
    raise exception using errcode = 'PJ401', message = 'UNAUTHENTICATED';
  end if;
  if not private.is_admin() then
    raise exception using errcode = 'PJ403', message = 'FORBIDDEN';
  end if;
  if char_length(v_ref) not between 1 and 200 then
    raise exception using errcode = 'PJ422', message = 'INVALID_REFERENCE';
  end if;

  select * into v_payment from public.payments where id = p_payment_id;
  if v_payment.id is null then
    raise exception using errcode = 'PJ404', message = 'PAYMENT_NOT_FOUND';
  end if;
  perform 1 from public.orders where id = v_payment.order_id for update;
  select * into v_payment from public.payments where id = p_payment_id for update;
  if v_payment.refund_status <> 'pending' then
    raise exception using errcode = 'PJ409', message = 'REFUND_NOT_PENDING';
  end if;

  update public.payments
     set refund_status = 'refunded', status = 'refunded', refund_reference = v_ref,
         refund_marked_by = v_uid, refund_marked_at = now()
   where id = v_payment.id
  returning * into v_payment;

  insert into public.order_events (order_id, actor_id, event_type, payload)
  values (
    v_payment.order_id, v_uid, 'refund_marked',
    jsonb_build_object('payment_id', v_payment.id, 'reference', v_ref)
  );
  return v_payment;
end;
$$;

-- ---------------------------------------------------------------------------
-- mark_payout_paid (FR-ADM-05, BR-23)
-- ---------------------------------------------------------------------------

create function public.mark_payout_paid(p_order_id uuid, p_reference text)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders;
  v_ref text := btrim(coalesce(p_reference, ''));
begin
  if v_uid is null then
    raise exception using errcode = 'PJ401', message = 'UNAUTHENTICATED';
  end if;
  if not private.is_admin() then
    raise exception using errcode = 'PJ403', message = 'FORBIDDEN';
  end if;
  if char_length(v_ref) not between 1 and 200 then
    raise exception using errcode = 'PJ422', message = 'INVALID_REFERENCE';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then
    raise exception using errcode = 'PJ404', message = 'ORDER_NOT_FOUND';
  end if;
  if v_order.status <> 'completed' or v_order.payout_status <> 'pending' then
    raise exception using errcode = 'PJ409', message = 'PAYOUT_NOT_PENDING';
  end if;

  update public.orders
     set payout_status = 'paid', payout_reference = v_ref,
         payout_marked_by = v_uid, payout_marked_at = now()
   where id = v_order.id
  returning * into v_order;

  insert into public.order_events (order_id, actor_id, event_type, payload)
  values (v_order.id, v_uid, 'payout_marked', jsonb_build_object('reference', v_ref));
  return v_order;
end;
$$;

revoke all on function public.resolve_dispute(uuid, public.dispute_resolution, text),
  public.mark_refund_completed(uuid, text),
  public.mark_payout_paid(uuid, text)
from public, anon;
grant execute on function public.resolve_dispute(uuid, public.dispute_resolution, text),
  public.mark_refund_completed(uuid, text),
  public.mark_payout_paid(uuid, text)
to authenticated;

-- Admin queues.
create index if not exists orders_payout_pending_idx
  on public.orders (payout_status) where payout_status = 'pending';
create index if not exists payments_refund_pending_idx
  on public.payments (refund_status) where refund_status = 'pending';

-- ---------------------------------------------------------------------------
-- order-files: at most 50 objects per order (QA residual risk 2)
-- ---------------------------------------------------------------------------

create function private.order_file_count(p_order_folder text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from storage.objects
  where bucket_id = 'order-files'
    and (storage.foldername(name))[1] = p_order_folder;
$$;

revoke all on function private.order_file_count(text) from public;
grant execute on function private.order_file_count(text) to authenticated;

drop policy if exists order_files_insert_freelancer on storage.objects;
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
  and private.order_file_count((storage.foldername(name))[1]) < 50
);
