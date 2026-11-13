-- Phase 6: payments (Midtrans Snap Sandbox) and the order lifecycle up to
-- completion. See docs/DATABASE.md §4.14, §4.16, §4.17, §7.2, §8.1, §8.2, §12.
--
-- * payments, payment_notifications, order_deliveries
-- * create_service_order, create_payment_attempt, attach_snap_token,
--   fail_payment_attempt, apply_payment_status, cancel_order (full BR-20),
--   expire_unpaid_orders (+ pg_cron), deliver_order (message; files arrive with
--   the order-files bucket in Phase 7), complete_order
--
-- Global lock order (DATABASE §7): jobs -> proposals -> orders -> payments.

-- ---------------------------------------------------------------------------
-- Enums and constants
-- ---------------------------------------------------------------------------

create type public.payment_status as enum (
  'initiated', 'pending', 'paid', 'failed', 'expired', 'cancelled', 'refunded'
);
create type public.refund_status as enum ('none', 'pending', 'refunded');

-- BR-10 grace period before unpaid orders are cancelled automatically.
create function private.payment_grace()
returns interval language sql immutable set search_path = '' as $$ select interval '15 minutes' $$;

-- BR-11
create function private.max_payment_attempts()
returns integer language sql immutable set search_path = '' as $$ select 5 $$;

-- ---------------------------------------------------------------------------
-- payments: one row per Midtrans Snap transaction attempt
-- ---------------------------------------------------------------------------

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  attempt_no smallint not null,
  midtrans_order_id text not null,
  gross_amount bigint not null,
  status public.payment_status not null default 'initiated',
  snap_token text,
  snap_redirect_url text,
  token_expires_at timestamptz,
  midtrans_transaction_id text,
  midtrans_transaction_status text,
  midtrans_fraud_status text,
  midtrans_status_code text,
  payment_type text,
  paid_at timestamptz,
  failure_reason text,
  refund_status public.refund_status not null default 'none',
  refund_reference text,
  refund_marked_by uuid references public.profiles (id),
  refund_marked_at timestamptz,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_midtrans_order_id_key unique (midtrans_order_id),
  constraint payments_order_attempt_key unique (order_id, attempt_no),
  constraint payments_attempt_no check (attempt_no between 1 and 5),
  constraint payments_gross_amount check (gross_amount between 10000 and 50000000),
  constraint payments_midtrans_order_id_format check (midtrans_order_id ~ '^PJK-[0-9]{6,}-[1-5]-[0-9a-f]{8}$'),
  constraint payments_failure_reason_length check (failure_reason is null or char_length(failure_reason) <= 500),
  constraint payments_refund_reference_length check (refund_reference is null or char_length(refund_reference) <= 200),
  constraint payments_text_lengths check (
    coalesce(char_length(snap_token), 0) <= 200
    and coalesce(char_length(snap_redirect_url), 0) <= 500
    and coalesce(char_length(midtrans_transaction_id), 0) <= 100
    and coalesce(char_length(midtrans_transaction_status), 0) <= 50
    and coalesce(char_length(midtrans_fraud_status), 0) <= 50
    and coalesce(char_length(midtrans_status_code), 0) <= 10
    and coalesce(char_length(payment_type), 0) <= 50
  )
);

-- BR-11: at most one live (initiated/pending) attempt per order.
create unique index payments_one_live_attempt
  on public.payments (order_id)
  where status in ('initiated', 'pending');

create index payments_refund_pending_idx on public.payments (refund_status)
  where refund_status = 'pending';
create index payments_live_created_idx on public.payments (status, created_at)
  where status in ('initiated', 'pending');

create trigger payments_set_updated_at
before update on public.payments
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- payment_notifications: append-only log of every Midtrans HTTP notification
-- (no FK: notifications for other environments are logged too)
-- ---------------------------------------------------------------------------

create table public.payment_notifications (
  id bigint generated always as identity primary key,
  midtrans_order_id text,
  transaction_status text,
  status_code text,
  signature_valid boolean not null,
  payload jsonb not null,
  processing_result text,
  error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint payment_notifications_result check (processing_result is null or processing_result in (
    'applied', 'no_change', 'ignored_regression', 'unknown_payment', 'amount_mismatch',
    'invalid_signature', 'not_found', 'error'
  )),
  constraint payment_notifications_error_length check (error is null or char_length(error) <= 1000)
);

create index payment_notifications_order_received_idx
  on public.payment_notifications (midtrans_order_id, received_at desc);

-- ---------------------------------------------------------------------------
-- order_deliveries
-- ---------------------------------------------------------------------------

create table public.order_deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  freelancer_id uuid not null references public.freelancer_profiles (user_id),
  delivery_number smallint not null,
  message text not null,
  attachment_paths text[] not null default '{}',
  created_at timestamptz not null default now(),
  constraint order_deliveries_number_key unique (order_id, delivery_number),
  constraint order_deliveries_message_length check (char_length(message) between 1 and 5000),
  constraint order_deliveries_attachment_count check (cardinality(attachment_paths) <= 10)
);

create index orders_delivered_idx on public.orders (status, delivered_at)
  where status = 'delivered';
create index orders_payout_pending_idx on public.orders (payout_status)
  where payout_status = 'pending';

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function private.is_order_client(p_order_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.orders where id = p_order_id and client_id = (select auth.uid())
  );
$$;

-- Effects shared by cancel_order and expire_unpaid_orders. The caller must hold
-- the job (if any) and order row locks and must have validated the transition.
-- Closes live attempts with p_attempt_status, marks a paid payment for refund
-- (BR-24), reopens the job when cancelled before payment (BR-16) and writes the
-- `cancelled` event. Returns the Midtrans order IDs of the attempts that were
-- live, so the caller can expire them at Midtrans (best effort).
create function private.apply_order_cancellation(
  p_order_id uuid,
  p_actor uuid,
  p_reason text,
  p_attempt_status public.payment_status
)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_live text[];
  v_refund boolean;
begin
  select * into v_order from public.orders where id = p_order_id;

  select coalesce(array_agg(midtrans_order_id order by attempt_no), '{}')
    into v_live
    from public.payments
   where order_id = v_order.id and status in ('initiated', 'pending');

  update public.payments
     set status = p_attempt_status,
         failure_reason = coalesce(failure_reason, 'order_cancelled')
   where order_id = v_order.id and status in ('initiated', 'pending');

  update public.payments
     set refund_status = 'pending'
   where order_id = v_order.id and status = 'paid' and refund_status = 'none';
  v_refund := found;

  update public.orders
     set status = 'cancelled',
         cancelled_at = now(),
         cancelled_by = p_actor,
         cancellation_reason = p_reason
   where id = v_order.id;

  if v_order.source = 'job' and v_order.status = 'awaiting_payment' then
    update public.jobs set status = 'open' where id = v_order.job_id and status = 'hiring';
    update public.proposals
       set status = 'rejected', status_reason = 'hire_cancelled', decided_at = now()
     where id = v_order.proposal_id and status = 'accepted';
  end if;

  insert into public.order_events (order_id, actor_id, event_type, from_status, to_status, payload)
  values (
    v_order.id, p_actor, 'cancelled', v_order.status, 'cancelled',
    jsonb_build_object('reason', p_reason, 'refund_pending', v_refund)
  );

  return v_live;
end;
$$;

revoke all on function
  private.payment_grace(),
  private.max_payment_attempts(),
  private.is_order_client(uuid),
  private.apply_order_cancellation(uuid, uuid, text, public.payment_status)
from public, anon, authenticated;

-- Used by the payments RLS policy.
grant execute on function private.is_order_client(uuid) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Grants (reset Supabase defaults first) and RLS
-- ---------------------------------------------------------------------------

revoke all on table public.payments, public.payment_notifications, public.order_deliveries
from anon, authenticated;

grant select on public.payments to authenticated;
grant select on public.payment_notifications to authenticated;
grant select on public.order_deliveries to authenticated;

alter table public.payments enable row level security;
alter table public.payment_notifications enable row level security;
alter table public.order_deliveries enable row level security;

-- Payments are visible to the order's client and admins only (not the freelancer).
create policy payments_select_client on public.payments for select
  to authenticated
  using (private.is_order_client(order_id) or (select private.is_admin()));

create policy payment_notifications_select_admin on public.payment_notifications for select
  to authenticated
  using ((select private.is_admin()));

create policy order_deliveries_select_participant on public.order_deliveries for select
  to authenticated
  using (private.is_order_participant(order_id) or (select private.is_admin()));

-- ---------------------------------------------------------------------------
-- create_service_order (FR-ORD-01)
-- ---------------------------------------------------------------------------

create function public.create_service_order(p_service_id uuid, p_requirements text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_service public.services;
  v_requirements text := btrim(coalesce(p_requirements, ''));
  v_fee bigint;
  v_order_id uuid;
begin
  if v_uid is null then
    raise exception using errcode = 'PJ401', message = 'UNAUTHENTICATED';
  end if;
  if not private.is_onboarded(v_uid) then
    raise exception using errcode = 'PJ403', message = 'NOT_ONBOARDED';
  end if;
  if char_length(v_requirements) not between 10 and 5000 then
    raise exception using errcode = 'PJ422', message = 'INVALID_REQUIREMENTS';
  end if;

  -- Serialise this client's order creation so the BR-12 count and the
  -- duplicate check below cannot be raced by parallel requests.
  perform pg_advisory_xact_lock(hashtextextended('projekin.client_orders:' || v_uid::text, 0));

  -- FOR SHARE: a concurrent pause/block of the service waits for this order.
  select * into v_service from public.services where id = p_service_id for share;
  if v_service.id is null then
    raise exception using errcode = 'PJ404', message = 'SERVICE_NOT_FOUND';
  end if;
  if v_service.freelancer_id = v_uid then
    raise exception using errcode = 'PJ403', message = 'OWN_SERVICE';
  end if;
  if v_service.status <> 'published'
     or v_service.blocked_at is not null
     or not private.is_eligible_freelancer(v_service.freelancer_id) then
    raise exception using errcode = 'PJ409', message = 'SERVICE_NOT_AVAILABLE';
  end if;

  if exists (
    select 1 from public.orders
    where client_id = v_uid and service_id = v_service.id and status = 'awaiting_payment'
  ) then
    raise exception using errcode = 'PJ409', message = 'SERVICE_ORDER_PENDING';
  end if;
  if (
    select count(*) from public.orders
    where client_id = v_uid and status = 'awaiting_payment'
  ) >= private.max_awaiting_payment_orders() then
    raise exception using errcode = 'PJ409', message = 'MAX_AWAITING_PAYMENT_ORDERS';
  end if;

  -- BR-09: amounts come from the service row, never from the caller.
  v_fee := (v_service.price * private.platform_fee_bps()) / 10000;

  insert into public.orders (
    source, service_id, client_id, freelancer_id,
    title, brief, requirements,
    amount, platform_fee, freelancer_earnings,
    delivery_days, revisions_allowed, payment_due_at
  )
  values (
    'service', v_service.id, v_uid, v_service.freelancer_id,
    v_service.title, v_service.description, v_requirements,
    v_service.price, v_fee, v_service.price - v_fee,
    v_service.delivery_days, v_service.revisions_included,
    now() + private.payment_window()
  )
  returning id into v_order_id;

  insert into public.order_events (order_id, actor_id, event_type, to_status, payload)
  values (
    v_order_id, v_uid, 'created', 'awaiting_payment',
    jsonb_build_object('service_id', v_service.id)
  );

  return v_order_id;
end;
$$;

-- accept_proposal: same body as 080800, plus the per-client lock so BR-12 is
-- not raced by a parallel create_service_order.
create or replace function public.accept_proposal(p_proposal_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_job_id uuid;
  v_job public.jobs;
  v_proposal public.proposals;
  v_fee bigint;
  v_order_id uuid;
begin
  if v_uid is null then
    raise exception using errcode = 'PJ401', message = 'UNAUTHENTICATED';
  end if;

  select job_id into v_job_id from public.proposals where id = p_proposal_id;
  if v_job_id is null then
    raise exception using errcode = 'PJ404', message = 'PROPOSAL_NOT_FOUND';
  end if;

  select * into v_job from public.jobs where id = v_job_id for update;
  if v_job.client_id <> v_uid then
    raise exception using errcode = 'PJ403', message = 'NOT_JOB_OWNER';
  end if;
  if not private.is_onboarded(v_uid) then
    raise exception using errcode = 'PJ403', message = 'NOT_ONBOARDED';
  end if;
  if v_job.status <> 'open' then
    raise exception using errcode = 'PJ409', message = 'JOB_NOT_OPEN';
  end if;

  select * into v_proposal from public.proposals where id = p_proposal_id for update;
  if v_proposal.status <> 'submitted' then
    raise exception using errcode = 'PJ409', message = 'PROPOSAL_NOT_SUBMITTED';
  end if;
  if not private.is_eligible_freelancer(v_proposal.freelancer_id) then
    raise exception using errcode = 'PJ403', message = 'FREELANCER_NOT_ELIGIBLE';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('projekin.client_orders:' || v_uid::text, 0));
  if (
    select count(*) from public.orders
    where client_id = v_uid and status = 'awaiting_payment'
  ) >= private.max_awaiting_payment_orders() then
    raise exception using errcode = 'PJ409', message = 'MAX_AWAITING_PAYMENT_ORDERS';
  end if;

  v_fee := (v_proposal.price * private.platform_fee_bps()) / 10000;

  update public.proposals
     set status = 'accepted', decided_at = now()
   where id = v_proposal.id;

  update public.jobs set status = 'hiring' where id = v_job.id;

  begin
    insert into public.orders (
      source, job_id, proposal_id, client_id, freelancer_id,
      title, brief, requirements,
      amount, platform_fee, freelancer_earnings,
      delivery_days, revisions_allowed, payment_due_at
    )
    values (
      'job', v_job.id, v_proposal.id, v_uid, v_proposal.freelancer_id,
      v_job.title, v_job.description, v_job.requirements,
      v_proposal.price, v_fee, v_proposal.price - v_fee,
      v_proposal.delivery_days, v_proposal.revisions_included,
      now() + private.payment_window()
    )
    returning id into v_order_id;
  exception when unique_violation then
    raise exception using errcode = 'PJ409', message = 'JOB_ALREADY_HIRED';
  end;

  insert into public.order_events (order_id, actor_id, event_type, to_status, payload)
  values (
    v_order_id, v_uid, 'created', 'awaiting_payment',
    jsonb_build_object('proposal_id', v_proposal.id, 'job_id', v_job.id)
  );

  return v_order_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- create_payment_attempt (order client). Returns a reusable attempt (valid
-- Snap token) or a new `initiated` attempt for the server to send to Snap.
-- ---------------------------------------------------------------------------

create function public.create_payment_attempt(p_order_id uuid)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders;
  v_live public.payments;
  v_attempts integer;
  v_id uuid := gen_random_uuid();
  v_row public.payments;
begin
  if v_uid is null then
    raise exception using errcode = 'PJ401', message = 'UNAUTHENTICATED';
  end if;

  -- Locking the order serialises concurrent "Pay" clicks for the same order.
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null or v_order.client_id <> v_uid then
    raise exception using errcode = 'PJ404', message = 'ORDER_NOT_FOUND';
  end if;
  if v_order.status <> 'awaiting_payment' then
    raise exception using errcode = 'PJ409', message = 'ORDER_NOT_AWAITING_PAYMENT';
  end if;
  if now() >= v_order.payment_due_at - interval '5 minutes' then
    raise exception using errcode = 'PJ409', message = 'PAYMENT_WINDOW_CLOSING';
  end if;

  select * into v_live from public.payments
   where order_id = v_order.id and status in ('initiated', 'pending')
   for update;

  if v_live.id is not null then
    -- (a) Reuse a live attempt whose Snap token is still valid (BR-11).
    if v_live.snap_token is not null and v_live.token_expires_at > now() then
      return v_live;
    end if;
    -- (b) Another request is creating the Snap transaction right now.
    if v_live.status = 'initiated' and v_live.snap_token is null
       and v_live.created_at > now() - interval '2 minutes' then
      raise exception using errcode = 'PJ409', message = 'PAYMENT_IN_PROGRESS';
    end if;
    -- (c) Close the stale attempt.
    if v_live.status = 'initiated' then
      update public.payments
         set status = 'failed', failure_reason = 'stale_initiated'
       where id = v_live.id;
      insert into public.order_events (order_id, actor_id, event_type, payload)
      values (v_order.id, null, 'payment_failed',
              jsonb_build_object('midtrans_order_id', v_live.midtrans_order_id, 'reason', 'stale_initiated'));
    else
      update public.payments
         set status = 'expired', failure_reason = 'token_expired'
       where id = v_live.id;
      insert into public.order_events (order_id, actor_id, event_type, payload)
      values (v_order.id, null, 'payment_expired',
              jsonb_build_object('midtrans_order_id', v_live.midtrans_order_id, 'reason', 'token_expired'));
    end if;
  end if;

  select count(*) into v_attempts from public.payments where order_id = v_order.id;
  if v_attempts >= private.max_payment_attempts() then
    raise exception using errcode = 'PJ409', message = 'MAX_PAYMENT_ATTEMPTS';
  end if;

  insert into public.payments (id, order_id, attempt_no, midtrans_order_id, gross_amount)
  values (
    v_id, v_order.id, v_attempts + 1,
    -- lpad truncates longer strings, so never pad to less than the full length.
    format('PJK-%s-%s-%s',
           lpad(v_order.order_number::text, greatest(6, char_length(v_order.order_number::text)), '0'),
           v_attempts + 1,
           left(replace(v_id::text, '-', ''), 8)),
    v_order.amount
  )
  returning * into v_row;

  insert into public.order_events (order_id, actor_id, event_type, payload)
  values (v_order.id, v_uid, 'payment_attempt_created',
          jsonb_build_object('midtrans_order_id', v_row.midtrans_order_id, 'attempt_no', v_row.attempt_no));

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- attach_snap_token / fail_payment_attempt (service role only)
-- ---------------------------------------------------------------------------

create function public.attach_snap_token(
  p_payment_id uuid,
  p_snap_token text,
  p_redirect_url text,
  p_token_expires_at timestamptz
)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.payments;
  v_due timestamptz;
begin
  if coalesce(char_length(p_snap_token), 0) not between 1 and 200
     or coalesce(char_length(p_redirect_url), 0) not between 1 and 500
     or p_token_expires_at is null then
    raise exception using errcode = 'PJ422', message = 'INVALID_SNAP_TOKEN';
  end if;

  select o.payment_due_at into v_due
    from public.payments p join public.orders o on o.id = p.order_id
   where p.id = p_payment_id;

  select * into v_row from public.payments where id = p_payment_id for update;
  if v_row.id is null then
    raise exception using errcode = 'PJ404', message = 'PAYMENT_NOT_FOUND';
  end if;
  -- BR-10: the Snap expiry may never outlive the order's payment window.
  if p_token_expires_at > v_due then
    raise exception using errcode = 'PJ422', message = 'INVALID_TOKEN_EXPIRY';
  end if;
  -- `pending` without a token: a notification arrived before this call.
  if not (v_row.status = 'initiated' or (v_row.status = 'pending' and v_row.snap_token is null)) then
    raise exception using errcode = 'PJ409', message = 'PAYMENT_NOT_INITIATED';
  end if;

  update public.payments
     set status = 'pending',
         snap_token = p_snap_token,
         snap_redirect_url = p_redirect_url,
         token_expires_at = p_token_expires_at
   where id = v_row.id
  returning * into v_row;
  return v_row;
end;
$$;

create function public.fail_payment_attempt(p_payment_id uuid, p_reason text)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.payments;
  v_reason text := left(coalesce(nullif(btrim(p_reason), ''), 'unknown'), 500);
begin
  select * into v_row from public.payments where id = p_payment_id for update;
  if v_row.id is null then
    raise exception using errcode = 'PJ404', message = 'PAYMENT_NOT_FOUND';
  end if;
  if v_row.status = 'failed' then
    return v_row; -- idempotent
  end if;
  if v_row.status <> 'initiated' then
    raise exception using errcode = 'PJ409', message = 'PAYMENT_NOT_INITIATED';
  end if;

  update public.payments
     set status = 'failed', failure_reason = v_reason
   where id = v_row.id
  returning * into v_row;

  insert into public.order_events (order_id, actor_id, event_type, payload)
  values (v_row.order_id, null, 'payment_failed',
          jsonb_build_object('midtrans_order_id', v_row.midtrans_order_id, 'reason', v_reason));
  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- apply_payment_status (service role only). Values must come from the Midtrans
-- Status API (never from a browser redirect). Idempotent. DATABASE §8.2.
-- ---------------------------------------------------------------------------

create function public.apply_payment_status(
  p_midtrans_order_id text,
  p_transaction_status text,
  p_fraud_status text,
  p_status_code text,
  p_gross_amount bigint,
  p_payment_type text,
  p_transaction_id text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment_id uuid;
  v_order_id uuid;
  v_job_id uuid;
  v_order public.orders;
  v_payment public.payments;
  v_tx text := lower(btrim(coalesce(p_transaction_status, '')));
  v_fraud text := nullif(lower(btrim(coalesce(p_fraud_status, ''))), '');
  v_new public.payment_status;
  v_old public.payment_status;
  v_payload jsonb;
begin
  -- 1. Look up without locks to learn the rows to lock.
  select p.id, p.order_id, o.job_id into v_payment_id, v_order_id, v_job_id
    from public.payments p join public.orders o on o.id = p.order_id
   where p.midtrans_order_id = p_midtrans_order_id;
  if v_payment_id is null then
    return 'unknown_payment';
  end if;

  -- 2. Lock in the global order.
  if v_job_id is not null then
    perform 1 from public.jobs where id = v_job_id for update;
  end if;
  select * into v_order from public.orders where id = v_order_id for update;
  select * into v_payment from public.payments where id = v_payment_id for update;

  -- 3. Amount must match what we asked Midtrans to charge.
  if p_gross_amount is null or p_gross_amount <> v_payment.gross_amount then
    return 'amount_mismatch';
  end if;

  -- 4. Midtrans status (+ fraud status) -> payment_status.
  v_new := case
    when v_tx = 'settlement' then 'paid'
    when v_tx = 'capture' and (v_fraud is null or v_fraud = 'accept') then 'paid'
    when v_tx = 'capture' and v_fraud = 'challenge' then 'pending'
    when v_tx = 'capture' and v_fraud = 'deny' then 'failed'
    when v_tx in ('authorize', 'pending') then 'pending'
    when v_tx in ('deny', 'failure') then 'failed'
    when v_tx = 'cancel' then 'cancelled'
    when v_tx = 'expire' then 'expired'
    when v_tx in ('refund', 'partial_refund', 'chargeback', 'partial_chargeback') then 'refunded'
    else null
  end::public.payment_status;
  if v_new is null then
    return 'error';
  end if;

  v_old := v_payment.status;

  -- 5. Same status: refresh raw fields only.
  if v_new = v_old then
    update public.payments
       set midtrans_transaction_id = coalesce(left(p_transaction_id, 100), midtrans_transaction_id),
           midtrans_transaction_status = left(v_tx, 50),
           midtrans_fraud_status = left(v_fraud, 50),
           midtrans_status_code = left(p_status_code, 10),
           payment_type = coalesce(left(p_payment_type, 50), payment_type),
           last_synced_at = now()
     where id = v_payment.id;
    return 'no_change';
  end if;

  -- Regression guard: refunded is final; paid only becomes refunded; a
  -- terminal unpaid status only accepts paid (captured money always wins) or a
  -- provider refund.
  if v_old = 'refunded'
     or (v_old = 'paid' and v_new <> 'refunded')
     or (v_old in ('failed', 'expired', 'cancelled') and v_new not in ('paid', 'refunded')) then
    update public.payments set last_synced_at = now() where id = v_payment.id;
    return 'ignored_regression';
  end if;

  -- 6. Apply.
  update public.payments
     set status = v_new,
         midtrans_transaction_id = coalesce(left(p_transaction_id, 100), midtrans_transaction_id),
         midtrans_transaction_status = left(v_tx, 50),
         midtrans_fraud_status = left(v_fraud, 50),
         midtrans_status_code = left(p_status_code, 10),
         payment_type = coalesce(left(p_payment_type, 50), payment_type),
         paid_at = case when v_new = 'paid' then now() else paid_at end,
         refund_status = case when v_new = 'refunded' then 'refunded'::public.refund_status else refund_status end,
         refund_reference = case when v_new = 'refunded' then left('midtrans:' || v_tx, 200) else refund_reference end,
         last_synced_at = now()
   where id = v_payment.id;

  v_payload := jsonb_build_object(
    'midtrans_order_id', v_payment.midtrans_order_id,
    'payment_type', p_payment_type
  );

  -- 7. Paid.
  if v_new = 'paid' then
    if v_order.status = 'awaiting_payment' then
      update public.orders
         set status = 'in_progress',
             paid_at = now(),
             due_at = now() + make_interval(days => v_order.delivery_days)
       where id = v_order.id;

      if v_order.source = 'job' then
        update public.jobs set status = 'filled' where id = v_order.job_id;
        update public.proposals
           set status = 'rejected', status_reason = 'job_filled', decided_at = now()
         where job_id = v_order.job_id and status = 'submitted';
      end if;

      -- Any other live attempt is superseded; if it is paid later it is
      -- flagged as a duplicate payment (refund pending).
      update public.payments
         set status = 'cancelled', failure_reason = 'superseded'
       where order_id = v_order.id and id <> v_payment.id and status in ('initiated', 'pending');

      insert into public.order_events (order_id, actor_id, event_type, from_status, to_status, payload)
      values (v_order.id, null, 'payment_paid', 'awaiting_payment', 'in_progress', v_payload);
    else
      update public.payments set refund_status = 'pending' where id = v_payment.id;
      insert into public.order_events (order_id, actor_id, event_type, payload)
      values (
        v_order.id, null,
        case when v_order.status = 'cancelled' then 'late_payment_detected' else 'duplicate_payment_detected' end,
        v_payload
      );
    end if;

  -- 8. Failed / expired / cancelled attempt: the order keeps waiting (FR-PAY-04).
  elsif v_new in ('failed', 'expired', 'cancelled') then
    insert into public.order_events (order_id, actor_id, event_type, payload)
    values (v_order.id, null, 'payment_' || v_new::text, v_payload);

  -- 9. Provider refund / chargeback.
  elsif v_new = 'refunded' then
    insert into public.order_events (order_id, actor_id, event_type, payload)
    values (v_order.id, null, 'payment_refunded_by_provider', v_payload);
  end if;

  return 'applied';
end;
$$;

-- ---------------------------------------------------------------------------
-- cancel_order: full BR-20. Replaces the pre-payment-only version from 080800
-- (same signature).
-- ---------------------------------------------------------------------------

create or replace function public.cancel_order(p_order_id uuid, p_reason text)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if v_uid is null then
    raise exception using errcode = 'PJ401', message = 'UNAUTHENTICATED';
  end if;

  select * into v_order from public.orders where id = p_order_id;
  if v_order.id is null
     or (v_uid not in (v_order.client_id, v_order.freelancer_id) and not private.is_admin()) then
    raise exception using errcode = 'PJ404', message = 'ORDER_NOT_FOUND';
  end if;
  if char_length(v_reason) not between 1 and 500 then
    raise exception using errcode = 'PJ422', message = 'INVALID_CANCEL_REASON';
  end if;

  if v_order.job_id is not null then
    perform 1 from public.jobs where id = v_order.job_id for update;
  end if;
  select * into v_order from public.orders where id = p_order_id for update;

  -- Client, freelancer or admin: before payment. Freelancer only: after
  -- payment but before the first delivery (full refund, BR-20).
  if not (
    v_order.status = 'awaiting_payment'
    or (
      v_order.status = 'in_progress'
      and v_uid = v_order.freelancer_id
      and not exists (select 1 from public.order_deliveries where order_id = v_order.id)
    )
  ) then
    raise exception using errcode = 'PJ409', message = 'ORDER_NOT_CANCELLABLE';
  end if;

  return private.apply_order_cancellation(v_order.id, v_uid, v_reason, 'cancelled');
end;
$$;

-- ---------------------------------------------------------------------------
-- expire_unpaid_orders (pg_cron / service role). BR-10.
-- ---------------------------------------------------------------------------

create function public.expire_unpaid_orders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_candidate record;
  v_order public.orders;
  v_count integer := 0;
begin
  for v_candidate in
    select id, job_id from public.orders
     where status = 'awaiting_payment'
       and payment_due_at + private.payment_grace() < now()
     order by payment_due_at
     limit 500
  loop
    -- Rows being paid or cancelled right now are skipped until the next run.
    if v_candidate.job_id is not null then
      perform 1 from public.jobs where id = v_candidate.job_id for update skip locked;
      if not found then
        continue;
      end if;
    end if;
    select * into v_order from public.orders where id = v_candidate.id for update skip locked;
    if v_order.id is null
       or v_order.status <> 'awaiting_payment'
       or v_order.payment_due_at + private.payment_grace() >= now() then
      continue;
    end if;

    perform private.apply_order_cancellation(v_order.id, null, 'payment_window_expired', 'expired');
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- deliver_order (order freelancer) and complete_order (order client)
-- ---------------------------------------------------------------------------

create function public.deliver_order(
  p_order_id uuid,
  p_message text,
  p_attachment_paths text[] default '{}'
)
returns public.order_deliveries
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders;
  v_message text := btrim(coalesce(p_message, ''));
  v_paths text[] := coalesce(p_attachment_paths, '{}');
  v_prefix text;
  v_path text;
  v_row public.order_deliveries;
begin
  if v_uid is null then
    raise exception using errcode = 'PJ401', message = 'UNAUTHENTICATED';
  end if;

  select * into v_order from public.orders where id = p_order_id;
  if v_order.id is null or v_uid not in (v_order.client_id, v_order.freelancer_id) then
    raise exception using errcode = 'PJ404', message = 'ORDER_NOT_FOUND';
  end if;
  if v_uid <> v_order.freelancer_id then
    raise exception using errcode = 'PJ403', message = 'NOT_ORDER_FREELANCER';
  end if;
  if char_length(v_message) not between 1 and 5000 then
    raise exception using errcode = 'PJ422', message = 'INVALID_MESSAGE';
  end if;
  if cardinality(v_paths) > 10 then
    raise exception using errcode = 'PJ422', message = 'TOO_MANY_ATTACHMENTS';
  end if;
  v_prefix := v_order.id::text || '/' || v_uid::text || '/';
  foreach v_path in array v_paths loop
    if v_path is null
       or left(v_path, char_length(v_prefix)) <> v_prefix
       or not exists (
         select 1 from storage.objects where bucket_id = 'order-files' and name = v_path
       ) then
      raise exception using errcode = 'PJ422', message = 'ATTACHMENT_NOT_FOUND';
    end if;
  end loop;

  if v_order.job_id is not null then
    perform 1 from public.jobs where id = v_order.job_id for update;
  end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.status <> 'in_progress' then
    raise exception using errcode = 'PJ409', message = 'ORDER_NOT_IN_PROGRESS';
  end if;

  insert into public.order_deliveries (order_id, freelancer_id, delivery_number, message, attachment_paths)
  values (
    v_order.id, v_uid,
    coalesce((select max(delivery_number) from public.order_deliveries where order_id = v_order.id), 0) + 1,
    v_message, v_paths
  )
  returning * into v_row;

  update public.orders set status = 'delivered', delivered_at = now() where id = v_order.id;

  insert into public.order_events (order_id, actor_id, event_type, from_status, to_status, payload)
  values (v_order.id, v_uid, 'delivered', 'in_progress', 'delivered',
          jsonb_build_object('delivery_number', v_row.delivery_number));
  return v_row;
end;
$$;

create function public.complete_order(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders;
begin
  if v_uid is null then
    raise exception using errcode = 'PJ401', message = 'UNAUTHENTICATED';
  end if;

  select * into v_order from public.orders where id = p_order_id;
  if v_order.id is null or v_uid not in (v_order.client_id, v_order.freelancer_id) then
    raise exception using errcode = 'PJ404', message = 'ORDER_NOT_FOUND';
  end if;
  if v_uid <> v_order.client_id then
    raise exception using errcode = 'PJ403', message = 'NOT_ORDER_CLIENT';
  end if;

  if v_order.job_id is not null then
    perform 1 from public.jobs where id = v_order.job_id for update;
  end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.status <> 'delivered' then
    raise exception using errcode = 'PJ409', message = 'ORDER_NOT_DELIVERED';
  end if;

  -- BR-23: payout becomes pending; an admin pays off-platform (no escrow,
  -- no automatic payouts).
  update public.orders
     set status = 'completed', completed_at = now(), payout_status = 'pending'
   where id = v_order.id
  returning * into v_order;

  insert into public.order_events (order_id, actor_id, event_type, from_status, to_status)
  values (v_order.id, v_uid, 'completed', 'delivered', 'completed');
  return v_order;
end;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges. Supabase grants EXECUTE on new public functions to the
-- API roles by default, so revoke first.
-- ---------------------------------------------------------------------------

revoke all on function
  public.create_service_order(uuid, text),
  public.create_payment_attempt(uuid),
  public.attach_snap_token(uuid, text, text, timestamptz),
  public.fail_payment_attempt(uuid, text),
  public.apply_payment_status(text, text, text, text, bigint, text, text),
  public.expire_unpaid_orders(),
  public.deliver_order(uuid, text, text[]),
  public.complete_order(uuid)
from public, anon, authenticated;

grant execute on function
  public.create_service_order(uuid, text),
  public.create_payment_attempt(uuid),
  public.deliver_order(uuid, text, text[]),
  public.complete_order(uuid)
to authenticated, service_role;

-- Service role only: called by the server with the secret key after it has
-- verified the caller (startPayment / syncPaymentStatus), by the Midtrans
-- notification handler, and by the reconcile and expiry jobs.
grant execute on function
  public.attach_snap_token(uuid, text, text, timestamptz),
  public.fail_payment_attempt(uuid, text),
  public.apply_payment_status(text, text, text, text, bigint, text, text),
  public.expire_unpaid_orders()
to service_role;

-- ---------------------------------------------------------------------------
-- Scheduled job (DATABASE §12). pg_cron exists on Supabase; the PGlite test
-- database does not have it, so the schedule is skipped there.
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule(
      'expire-unpaid-orders',
      '*/5 * * * *',
      'select public.expire_unpaid_orders()'
    );
  end if;
end;
$$;
