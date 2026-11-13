-- Job marketplace, proposals and the unified order (creation + pre-payment
-- cancellation). See docs/DATABASE.md §4.9–§4.12, §7, §8.1, §8.3, §8.4, §9, §10.
-- Payments, delivery and disputes are added in later phases.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.job_status as enum ('open', 'hiring', 'filled', 'closed');
create type public.proposal_status as enum ('submitted', 'accepted', 'rejected', 'withdrawn');
create type public.order_source as enum ('service', 'job');
create type public.order_status as enum (
  'awaiting_payment', 'in_progress', 'delivered', 'completed', 'cancelled', 'disputed'
);
create type public.payout_status as enum ('none', 'pending', 'paid');

-- ---------------------------------------------------------------------------
-- Business constants (docs/PRD.md BR-09, BR-10, BR-12, BR-13, BR-14)
-- ---------------------------------------------------------------------------

create function private.platform_fee_bps()
returns integer language sql immutable set search_path = '' as $$ select 1000 $$;

create function private.payment_window()
returns interval language sql immutable set search_path = '' as $$ select interval '24 hours' $$;

create function private.max_awaiting_payment_orders()
returns integer language sql immutable set search_path = '' as $$ select 5 $$;

create function private.max_active_jobs()
returns integer language sql immutable set search_path = '' as $$ select 10 $$;

create function private.max_proposals_per_day()
returns integer language sql immutable set search_path = '' as $$ select 30 $$;

-- Today's date in Asia/Jakarta (deadlines are calendar dates).
create function private.today_jakarta()
returns date language sql stable set search_path = '' as $$
  select (now() at time zone 'Asia/Jakarta')::date
$$;

-- ---------------------------------------------------------------------------
-- jobs
-- ---------------------------------------------------------------------------

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles (id) on delete restrict,
  category_id uuid not null references public.categories (id),
  title text not null,
  description text not null,
  requirements text,
  budget_min bigint not null,
  budget_max bigint not null,
  deadline date,
  status public.job_status not null default 'open',
  closed_at timestamptz,
  closed_reason text,
  search tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(requirements, '')), 'C')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jobs_title_length check (char_length(title) between 10 and 100),
  constraint jobs_description_length check (char_length(description) between 50 and 5000),
  constraint jobs_requirements_length check (requirements is null or char_length(requirements) <= 3000),
  constraint jobs_budget_range check (
    budget_min between 10000 and 50000000 and budget_max between 10000 and 50000000
  ),
  constraint jobs_budget_order check (budget_min <= budget_max),
  constraint jobs_closed_reason_length check (closed_reason is null or char_length(closed_reason) <= 500)
);

create index jobs_client_created_idx on public.jobs (client_id, created_at desc);
create index jobs_status_created_idx on public.jobs (status, created_at desc);
create index jobs_category_status_idx on public.jobs (category_id, status);
create index jobs_search_idx on public.jobs using gin (search);

create trigger jobs_set_updated_at
before update on public.jobs
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- proposals
-- ---------------------------------------------------------------------------

create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete restrict,
  freelancer_id uuid not null references public.freelancer_profiles (user_id) on delete restrict,
  cover_letter text not null,
  price bigint not null,
  delivery_days smallint not null,
  revisions_included smallint not null,
  status public.proposal_status not null default 'submitted',
  status_reason text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- BR-14: one proposal per freelancer per job (withdrawn ones cannot be resubmitted).
  constraint proposals_job_freelancer_key unique (job_id, freelancer_id),
  constraint proposals_cover_letter_length check (char_length(cover_letter) between 50 and 3000),
  constraint proposals_price_range check (price between 10000 and 50000000),
  constraint proposals_delivery_days check (delivery_days between 1 and 60),
  constraint proposals_revisions check (revisions_included between 0 and 5),
  constraint proposals_status_reason_length check (status_reason is null or char_length(status_reason) <= 500)
);

create index proposals_job_status_idx on public.proposals (job_id, status);
create index proposals_freelancer_created_idx on public.proposals (freelancer_id, created_at desc);

create trigger proposals_set_updated_at
before update on public.proposals
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- orders (unified: service and job flows)
-- ---------------------------------------------------------------------------

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity,
  source public.order_source not null,
  service_id uuid references public.services (id) on delete restrict,
  job_id uuid references public.jobs (id) on delete restrict,
  proposal_id uuid references public.proposals (id) on delete restrict,
  client_id uuid not null references public.profiles (id) on delete restrict,
  freelancer_id uuid not null references public.freelancer_profiles (user_id) on delete restrict,
  title text not null,
  brief text not null,
  requirements text,
  amount bigint not null,
  platform_fee bigint not null,
  freelancer_earnings bigint not null,
  delivery_days smallint not null,
  revisions_allowed smallint not null,
  revisions_used smallint not null default 0,
  status public.order_status not null default 'awaiting_payment',
  payment_due_at timestamptz not null,
  paid_at timestamptz,
  due_at timestamptz,
  delivered_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles (id),
  cancellation_reason text,
  payout_status public.payout_status not null default 'none',
  payout_reference text,
  payout_marked_by uuid references public.profiles (id),
  payout_marked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_order_number_key unique (order_number),
  constraint orders_proposal_id_key unique (proposal_id),
  constraint orders_parties_differ check (client_id <> freelancer_id),
  constraint orders_amount_range check (amount between 10000 and 50000000),
  constraint orders_amount_split check (
    platform_fee >= 0 and freelancer_earnings >= 0 and amount = platform_fee + freelancer_earnings
  ),
  constraint orders_delivery_days check (delivery_days between 1 and 60),
  constraint orders_revisions check (
    revisions_allowed between 0 and 5 and revisions_used between 0 and revisions_allowed
  ),
  constraint orders_source_refs check (
    (source = 'service' and service_id is not null and job_id is null and proposal_id is null)
    or (source = 'job' and job_id is not null and proposal_id is not null and service_id is null)
  ),
  constraint orders_payout_requires_completed check (payout_status = 'none' or status = 'completed'),
  constraint orders_cancellation_reason_length check (
    cancellation_reason is null or char_length(cancellation_reason) <= 500
  ),
  constraint orders_payout_reference_length check (payout_reference is null or char_length(payout_reference) <= 200)
);

-- BR-16: at most one live (non-cancelled) order per job. Backstop for races.
create unique index orders_one_live_order_per_job
  on public.orders (job_id)
  where job_id is not null and status <> 'cancelled';

create index orders_client_status_idx on public.orders (client_id, status, created_at desc);
create index orders_freelancer_status_idx on public.orders (freelancer_id, status, created_at desc);
create index orders_awaiting_payment_idx on public.orders (status, payment_due_at)
  where status = 'awaiting_payment';

create trigger orders_set_updated_at
before update on public.orders
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- order_events (append-only timeline)
-- ---------------------------------------------------------------------------

create table public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete restrict,
  actor_id uuid references public.profiles (id),
  event_type text not null,
  from_status public.order_status,
  to_status public.order_status,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint order_events_type check (event_type in (
    'created', 'payment_attempt_created', 'payment_paid', 'payment_failed', 'payment_expired',
    'payment_cancelled', 'late_payment_detected', 'duplicate_payment_detected', 'delivered',
    'revision_requested', 'completed', 'auto_completed', 'cancelled', 'dispute_opened',
    'dispute_resolved', 'refund_marked', 'payment_refunded_by_provider', 'payout_marked'
  ))
);

create index order_events_order_created_idx on public.order_events (order_id, created_at);

-- ---------------------------------------------------------------------------
-- Relationship helpers (SECURITY DEFINER: avoid RLS recursion between
-- jobs <-> proposals, DATABASE §6.2)
-- ---------------------------------------------------------------------------

create function private.is_job_owner(p_job_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.jobs where id = p_job_id and client_id = (select auth.uid())
  );
$$;

create function private.has_proposal_on_job(p_job_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.proposals
    where job_id = p_job_id and freelancer_id = (select auth.uid())
  );
$$;

create function private.job_has_proposals(p_job_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.proposals where job_id = p_job_id);
$$;

create function private.active_job_count(p_uid uuid)
returns integer language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.jobs
  where client_id = p_uid and status in ('open', 'hiring');
$$;

create function private.is_order_participant(p_order_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.orders
    where id = p_order_id and (select auth.uid()) in (client_id, freelancer_id)
  );
$$;

revoke all on function
  private.platform_fee_bps(),
  private.payment_window(),
  private.max_awaiting_payment_orders(),
  private.max_active_jobs(),
  private.max_proposals_per_day(),
  private.today_jakarta(),
  private.is_job_owner(uuid),
  private.has_proposal_on_job(uuid),
  private.job_has_proposals(uuid),
  private.active_job_count(uuid),
  private.is_order_participant(uuid)
from public, anon, authenticated;

-- Helpers used inside RLS policies must be executable by the API roles.
grant execute on function
  private.max_active_jobs(),
  private.today_jakarta(),
  private.is_job_owner(uuid),
  private.has_proposal_on_job(uuid),
  private.job_has_proposals(uuid),
  private.active_job_count(uuid),
  private.is_order_participant(uuid)
to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Grants (reset Supabase defaults first)
-- ---------------------------------------------------------------------------

revoke all on table public.jobs, public.proposals, public.orders, public.order_events
from anon, authenticated;

grant select on public.jobs to anon, authenticated;
grant insert (client_id, category_id, title, description, requirements, budget_min, budget_max, deadline)
  on public.jobs to authenticated;
grant update (category_id, title, description, requirements, budget_min, budget_max, deadline)
  on public.jobs to authenticated;

grant select on public.proposals to authenticated;
grant select on public.orders to authenticated;
grant select on public.order_events to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.jobs enable row level security;
alter table public.proposals enable row level security;
alter table public.orders enable row level security;
alter table public.order_events enable row level security;

create policy jobs_select_visible on public.jobs for select
  to anon, authenticated
  using (
    status = 'open'
    or client_id = (select auth.uid())
    or private.has_proposal_on_job(id)
    or (select private.is_admin())
  );

create policy jobs_insert_own on public.jobs for insert
  to authenticated
  with check (
    client_id = (select auth.uid())
    and private.is_onboarded((select auth.uid()))
    and private.active_job_count((select auth.uid())) < private.max_active_jobs()
    and (deadline is null or deadline >= private.today_jakarta())
  );

-- BR-30: editable only while open and before the first proposal.
create policy jobs_update_own_editable on public.jobs for update
  to authenticated
  using (
    client_id = (select auth.uid())
    and status = 'open'
    and not private.job_has_proposals(id)
  )
  with check (
    client_id = (select auth.uid())
    and (deadline is null or deadline >= private.today_jakarta())
  );

create policy proposals_select_own_or_job_owner on public.proposals for select
  to authenticated
  using (
    freelancer_id = (select auth.uid())
    or private.is_job_owner(job_id)
    or (select private.is_admin())
  );

create policy orders_select_participant on public.orders for select
  to authenticated
  using (
    client_id = (select auth.uid())
    or freelancer_id = (select auth.uid())
    or (select private.is_admin())
  );

create policy order_events_select_participant on public.order_events for select
  to authenticated
  using (private.is_order_participant(order_id) or (select private.is_admin()));

-- ---------------------------------------------------------------------------
-- RPCs. Lock order: jobs -> proposals -> orders (DATABASE §7).
-- ---------------------------------------------------------------------------

create function public.close_job(p_job_id uuid, p_reason text default null)
returns public.jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_job public.jobs;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if v_uid is null then
    raise exception using errcode = 'PJ401', message = 'UNAUTHENTICATED';
  end if;

  select * into v_job from public.jobs where id = p_job_id for update;
  if v_job.id is null then
    raise exception using errcode = 'PJ404', message = 'JOB_NOT_FOUND';
  end if;
  if v_job.client_id <> v_uid and not private.is_admin() then
    raise exception using errcode = 'PJ403', message = 'NOT_JOB_OWNER';
  end if;
  if v_job.status <> 'open' then
    raise exception using errcode = 'PJ409', message = 'JOB_NOT_OPEN';
  end if;
  if v_reason is not null and char_length(v_reason) > 500 then
    raise exception using errcode = 'PJ422', message = 'INVALID_REASON';
  end if;

  update public.proposals
     set status = 'rejected', status_reason = 'job_closed', decided_at = now()
   where job_id = v_job.id and status = 'submitted';

  update public.jobs
     set status = 'closed', closed_at = now(), closed_reason = v_reason
   where id = v_job.id
  returning * into v_job;

  return v_job;
end;
$$;

create function public.submit_proposal(
  p_job_id uuid,
  p_cover_letter text,
  p_price bigint,
  p_delivery_days integer,
  p_revisions_included integer
)
returns public.proposals
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_job public.jobs;
  v_cover text := btrim(coalesce(p_cover_letter, ''));
  v_row public.proposals;
begin
  if v_uid is null then
    raise exception using errcode = 'PJ401', message = 'UNAUTHENTICATED';
  end if;
  if not private.is_onboarded(v_uid) then
    raise exception using errcode = 'PJ403', message = 'NOT_ONBOARDED';
  end if;
  if not private.is_eligible_freelancer(v_uid) then
    raise exception using errcode = 'PJ403', message = 'FREELANCER_NOT_ELIGIBLE';
  end if;

  -- FOR SHARE: blocks concurrent close_job / accept_proposal (FOR UPDATE)
  -- until this proposal is committed, so no proposal lands on a closed job.
  select * into v_job from public.jobs where id = p_job_id for share;
  if v_job.id is null then
    raise exception using errcode = 'PJ404', message = 'JOB_NOT_FOUND';
  end if;
  if v_job.client_id = v_uid then
    raise exception using errcode = 'PJ403', message = 'OWN_JOB';
  end if;
  if v_job.status <> 'open' then
    raise exception using errcode = 'PJ409', message = 'JOB_NOT_OPEN';
  end if;

  if char_length(v_cover) not between 50 and 3000 then
    raise exception using errcode = 'PJ422', message = 'INVALID_COVER_LETTER';
  end if;
  if p_price is null or p_price not between 10000 and 50000000 then
    raise exception using errcode = 'PJ422', message = 'INVALID_PRICE';
  end if;
  if p_delivery_days is null or p_delivery_days not between 1 and 60 then
    raise exception using errcode = 'PJ422', message = 'INVALID_DELIVERY_DAYS';
  end if;
  if p_revisions_included is null or p_revisions_included not between 0 and 5 then
    raise exception using errcode = 'PJ422', message = 'INVALID_REVISIONS';
  end if;

  if exists (
    select 1 from public.proposals where job_id = v_job.id and freelancer_id = v_uid
  ) then
    raise exception using errcode = 'PJ409', message = 'ALREADY_PROPOSED';
  end if;
  if (
    select count(*) from public.proposals
    where freelancer_id = v_uid and created_at > now() - interval '24 hours'
  ) >= private.max_proposals_per_day() then
    raise exception using errcode = 'PJ409', message = 'MAX_PROPOSALS_PER_DAY';
  end if;

  begin
    insert into public.proposals (
      job_id, freelancer_id, cover_letter, price, delivery_days, revisions_included
    )
    values (
      v_job.id, v_uid, v_cover, p_price, p_delivery_days, p_revisions_included
    )
    returning * into v_row;
  exception when unique_violation then
    raise exception using errcode = 'PJ409', message = 'ALREADY_PROPOSED';
  end;

  return v_row;
end;
$$;

create function public.withdraw_proposal(p_proposal_id uuid)
returns public.proposals
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.proposals;
begin
  if v_uid is null then
    raise exception using errcode = 'PJ401', message = 'UNAUTHENTICATED';
  end if;

  select * into v_row from public.proposals
  where id = p_proposal_id and freelancer_id = v_uid
  for update;
  if v_row.id is null then
    raise exception using errcode = 'PJ404', message = 'PROPOSAL_NOT_FOUND';
  end if;
  if v_row.status <> 'submitted' then
    raise exception using errcode = 'PJ409', message = 'PROPOSAL_NOT_SUBMITTED';
  end if;

  update public.proposals
     set status = 'withdrawn', decided_at = now()
   where id = v_row.id
  returning * into v_row;
  return v_row;
end;
$$;

create function public.reject_proposal(p_proposal_id uuid, p_reason text default null)
returns public.proposals
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_job_id uuid;
  v_job public.jobs;
  v_row public.proposals;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
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
  if v_reason is not null and char_length(v_reason) > 500 then
    raise exception using errcode = 'PJ422', message = 'INVALID_REASON';
  end if;

  select * into v_row from public.proposals where id = p_proposal_id for update;
  if v_row.status <> 'submitted' then
    raise exception using errcode = 'PJ409', message = 'PROPOSAL_NOT_SUBMITTED';
  end if;

  update public.proposals
     set status = 'rejected',
         status_reason = coalesce(v_reason, 'rejected_by_client'),
         decided_at = now()
   where id = v_row.id
  returning * into v_row;
  return v_row;
end;
$$;

-- FR-PROP-04: atomically accept a proposal, move the job to `hiring` and create
-- the unified order (awaiting payment). The job row lock serialises concurrent
-- accepts; orders_one_live_order_per_job is the final backstop.
create function public.accept_proposal(p_proposal_id uuid)
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
  if (
    select count(*) from public.orders
    where client_id = v_uid and status = 'awaiting_payment'
  ) >= private.max_awaiting_payment_orders() then
    raise exception using errcode = 'PJ409', message = 'MAX_AWAITING_PAYMENT_ORDERS';
  end if;

  -- BR-09: integer rupiah, fee rounded down, deducted from the freelancer.
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

-- BR-20 (pre-payment part): client, freelancer or admin may cancel an order that
-- is awaiting payment. A cancelled hire reopens the job (BR-16). Post-payment
-- cancellations arrive with the payments phase. Returns the Midtrans order IDs
-- of live payment attempts (always empty until payments exist).
create function public.cancel_order(p_order_id uuid, p_reason text)
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
    raise exception using errcode = 'PJ422', message = 'INVALID_REASON';
  end if;

  if v_order.job_id is not null then
    perform 1 from public.jobs where id = v_order.job_id for update;
  end if;
  select * into v_order from public.orders where id = p_order_id for update;

  if v_order.status <> 'awaiting_payment' then
    raise exception using errcode = 'PJ409', message = 'ORDER_NOT_CANCELLABLE';
  end if;

  update public.orders
     set status = 'cancelled',
         cancelled_at = now(),
         cancelled_by = v_uid,
         cancellation_reason = v_reason
   where id = v_order.id;

  if v_order.source = 'job' then
    update public.jobs set status = 'open' where id = v_order.job_id and status = 'hiring';
    update public.proposals
       set status = 'rejected', status_reason = 'hire_cancelled', decided_at = now()
     where id = v_order.proposal_id and status = 'accepted';
  end if;

  insert into public.order_events (order_id, actor_id, event_type, from_status, to_status, payload)
  values (
    v_order.id, v_uid, 'cancelled', 'awaiting_payment', 'cancelled',
    jsonb_build_object('reason', v_reason)
  );

  return '{}'::text[];
end;
$$;

revoke all on function
  public.close_job(uuid, text),
  public.submit_proposal(uuid, text, bigint, integer, integer),
  public.withdraw_proposal(uuid),
  public.reject_proposal(uuid, text),
  public.accept_proposal(uuid),
  public.cancel_order(uuid, text)
from public, anon;

grant execute on function
  public.close_job(uuid, text),
  public.submit_proposal(uuid, text, bigint, integer, integer),
  public.withdraw_proposal(uuid),
  public.reject_proposal(uuid, text),
  public.accept_proposal(uuid),
  public.cancel_order(uuid, text)
to authenticated, service_role;
