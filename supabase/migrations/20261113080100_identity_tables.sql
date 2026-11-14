-- Identity tables: profiles, admin_users, universities, student_verifications,
-- freelancer_profiles. See docs/DATABASE.md §4.1–§4.5.

-- ---------------------------------------------------------------------------
-- Helpers needed by table definitions and triggers
-- ---------------------------------------------------------------------------

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Every skill tag is 1–30 characters with no surrounding whitespace.
create function private.skills_valid(p_skills text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(bool_and(char_length(s) between 1 and 30 and s = btrim(s)), true)
  from unnest(p_skills) as s;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  full_name text,
  avatar_path text,
  bio text,
  location text,
  terms_accepted_at timestamptz,
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_key unique (username),
  constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,30}$'),
  constraint profiles_full_name_length check (full_name is null or char_length(full_name) between 1 and 100),
  constraint profiles_avatar_path_length check (avatar_path is null or char_length(avatar_path) <= 300),
  constraint profiles_bio_length check (bio is null or char_length(bio) <= 1000),
  constraint profiles_location_length check (location is null or char_length(location) <= 100),
  constraint profiles_onboarding_complete check (
    onboarded_at is null or (full_name is not null and terms_accepted_at is not null)
  )
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- admin_users (written only via SQL / service role)
-- ---------------------------------------------------------------------------

create table public.admin_users (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- universities
-- ---------------------------------------------------------------------------

create table public.universities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_name text,
  email_domains text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint universities_name_key unique (name),
  constraint universities_name_length check (char_length(name) between 1 and 200),
  constraint universities_short_name_length check (short_name is null or char_length(short_name) <= 50),
  constraint universities_domains_lowercase check (
    array_to_string(email_domains, ',') = lower(array_to_string(email_domains, ','))
  )
);

create trigger universities_set_updated_at
before update on public.universities
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- student_verifications (request + audit log)
-- ---------------------------------------------------------------------------

create table public.student_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  university_id uuid not null references public.universities (id),
  method public.verification_method not null,
  verified_email text,
  student_number text,
  document_path text,
  status public.verification_status not null default 'pending',
  valid_until timestamptz,
  rejection_reason text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint student_verifications_document_fields check (
    method <> 'document' or (student_number is not null and document_path is not null)
  ),
  constraint student_verifications_student_number_length check (
    student_number is null or char_length(student_number) between 1 and 50
  ),
  constraint student_verifications_approved_has_validity check (
    status <> 'approved' or valid_until is not null
  ),
  constraint student_verifications_rejected_has_reason check (
    status <> 'rejected' or rejection_reason is not null
  ),
  constraint student_verifications_rejection_reason_length check (
    rejection_reason is null or char_length(rejection_reason) between 1 and 500
  )
);

-- BR-04: at most one pending request per user.
create unique index student_verifications_one_pending_per_user
  on public.student_verifications (user_id)
  where status = 'pending';

create index student_verifications_user_created_idx
  on public.student_verifications (user_id, created_at desc);

create index student_verifications_pending_queue_idx
  on public.student_verifications (created_at)
  where status = 'pending';

-- ---------------------------------------------------------------------------
-- freelancer_profiles (single source of truth for eligibility, BR-01)
-- ---------------------------------------------------------------------------

create table public.freelancer_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  university_id uuid not null references public.universities (id),
  verified_until timestamptz not null,
  status public.freelancer_status not null default 'active',
  headline text,
  skills text[] not null default '{}',
  major text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint freelancer_profiles_headline_length check (headline is null or char_length(headline) <= 120),
  constraint freelancer_profiles_major_length check (major is null or char_length(major) <= 100),
  constraint freelancer_profiles_skills_count check (cardinality(skills) <= 15),
  constraint freelancer_profiles_skills_valid check (private.skills_valid(skills))
);

create trigger freelancer_profiles_set_updated_at
before update on public.freelancer_profiles
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- New auth user -> profile row (FR-AUTH-03)
-- ---------------------------------------------------------------------------

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_username text := 'user_' || left(replace(new.id::text, '-', ''), 10);
  v_full_name text := nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 100), '');
begin
  while exists (select 1 from public.profiles where username = v_username) loop
    v_username := 'user_' || left(md5(random()::text || clock_timestamp()::text), 10);
  end loop;

  insert into public.profiles (id, username, full_name)
  values (new.id, v_username, v_full_name);

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();
