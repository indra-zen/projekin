-- Identity helpers, business constants, RLS policies and grants.
-- See docs/DATABASE.md §6, §9, §10.

-- ---------------------------------------------------------------------------
-- Business constants (docs/PRD.md BR-03, FR-VER-05)
-- ---------------------------------------------------------------------------

create function private.verification_default_validity()
returns interval language sql immutable set search_path = '' as $$ select interval '12 months' $$;

create function private.verification_max_validity()
returns interval language sql immutable set search_path = '' as $$ select interval '24 months' $$;

create function private.verification_renewal_window()
returns interval language sql immutable set search_path = '' as $$ select interval '30 days' $$;

-- ---------------------------------------------------------------------------
-- Identity helpers (SECURITY DEFINER: bypass RLS for the lookup only)
-- ---------------------------------------------------------------------------

create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users where user_id = (select auth.uid())
  );
$$;

create function private.is_onboarded(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles where id = p_uid and onboarded_at is not null
  );
$$;

-- BR-01: verified student = active freelancer profile with unexpired verification.
create function private.is_eligible_freelancer(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.freelancer_profiles
    where user_id = p_uid
      and status = 'active'
      and verified_until > now()
  );
$$;

-- Account-level state (docs/DATABASE.md §8.6):
--   verified   eligible freelancer (active, not expired)
--   pending    otherwise, if a request is pending
--   rejected   otherwise, if the latest request was rejected
--   unverified everything else (never applied, expired, or suspended)
create function private.student_verification_state(p_uid uuid)
returns public.student_verification_state
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when private.is_eligible_freelancer(p_uid) then 'verified'::public.student_verification_state
    when exists (
      select 1 from public.student_verifications
      where user_id = p_uid and status = 'pending'
    ) then 'pending'::public.student_verification_state
    when (
      select status from public.student_verifications
      where user_id = p_uid
      order by created_at desc, id desc
      limit 1
    ) = 'rejected' then 'rejected'::public.student_verification_state
    else 'unverified'::public.student_verification_state
  end;
$$;

-- Creates or extends the freelancer profile after an approval.
create function private.apply_verification_approval(
  p_uid uuid,
  p_university_id uuid,
  p_valid_until timestamptz
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.freelancer_profiles (user_id, university_id, verified_until)
  values (p_uid, p_university_id, p_valid_until)
  on conflict (user_id) do update
    set university_id = excluded.university_id,
        verified_until = greatest(public.freelancer_profiles.verified_until, excluded.verified_until);
$$;

revoke all on all functions in schema private from public, anon, authenticated;

-- Helpers callable from RLS policies / CHECK constraints.
grant execute on function
  private.is_admin(),
  private.is_onboarded(uuid),
  private.is_eligible_freelancer(uuid),
  private.skills_valid(text[])
to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Grants (Supabase grants ALL to anon/authenticated by default: reset first)
-- ---------------------------------------------------------------------------

revoke all on table
  public.profiles,
  public.admin_users,
  public.universities,
  public.student_verifications,
  public.freelancer_profiles
from anon, authenticated;

grant select on public.profiles to anon, authenticated;
grant update (full_name, username, bio, location, avatar_path) on public.profiles to authenticated;

grant select on public.admin_users to authenticated;

grant select on public.universities to anon, authenticated;

grant select on public.student_verifications to authenticated;

grant select on public.freelancer_profiles to anon, authenticated;
grant update (headline, skills, major) on public.freelancer_profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.admin_users enable row level security;
alter table public.universities enable row level security;
alter table public.student_verifications enable row level security;
alter table public.freelancer_profiles enable row level security;

-- profiles: public read; owners update their own granted columns only.
create policy profiles_select_all
  on public.profiles for select
  to anon, authenticated
  using (true);

create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    and (avatar_path is null or starts_with(avatar_path, id::text || '/'))
  );

-- admin_users: a user can see only whether they themselves are an admin.
create policy admin_users_select_own
  on public.admin_users for select
  to authenticated
  using (user_id = (select auth.uid()));

-- universities: active rows are public; admins also see inactive rows.
create policy universities_select_active
  on public.universities for select
  to anon, authenticated
  using (is_active or (select private.is_admin()));

-- student_verifications: owner and admins read; all writes go through RPCs.
create policy student_verifications_select_own_or_admin
  on public.student_verifications for select
  to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

-- freelancer_profiles: public read; owners update headline/skills/major only.
create policy freelancer_profiles_select_all
  on public.freelancer_profiles for select
  to anon, authenticated
  using (true);

create policy freelancer_profiles_update_own
  on public.freelancer_profiles for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
