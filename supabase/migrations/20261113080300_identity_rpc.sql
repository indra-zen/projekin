-- Identity RPC functions. See docs/DATABASE.md §7.
-- Error convention (docs/DATABASE.md §7.1): SQLSTATE PJ401/PJ403/PJ404/PJ409/PJ422,
-- MESSAGE = stable machine-readable reason.

-- ---------------------------------------------------------------------------
-- complete_onboarding (FR-AUTH-04)
-- ---------------------------------------------------------------------------

create function public.complete_onboarding(
  p_full_name text,
  p_username text,
  p_accept_terms boolean
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_full_name text := btrim(coalesce(p_full_name, ''));
  v_username text := lower(btrim(coalesce(p_username, '')));
  v_profile public.profiles;
begin
  if v_uid is null then
    raise exception using errcode = 'PJ401', message = 'UNAUTHENTICATED';
  end if;
  if p_accept_terms is distinct from true then
    raise exception using errcode = 'PJ422', message = 'TERMS_NOT_ACCEPTED';
  end if;
  if char_length(v_full_name) not between 1 and 100 then
    raise exception using errcode = 'PJ422', message = 'INVALID_FULL_NAME';
  end if;
  if v_username !~ '^[a-z0-9_]{3,30}$' then
    raise exception using errcode = 'PJ422', message = 'INVALID_USERNAME';
  end if;
  if exists (select 1 from public.profiles where username = v_username and id <> v_uid) then
    raise exception using errcode = 'PJ409', message = 'USERNAME_TAKEN';
  end if;

  begin
    update public.profiles
       set full_name = v_full_name,
           username = v_username,
           terms_accepted_at = coalesce(terms_accepted_at, now()),
           onboarded_at = coalesce(onboarded_at, now())
     where id = v_uid
    returning * into v_profile;
  exception when unique_violation then
    raise exception using errcode = 'PJ409', message = 'USERNAME_TAKEN';
  end;

  if v_profile.id is null then
    raise exception using errcode = 'PJ404', message = 'PROFILE_NOT_FOUND';
  end if;

  return v_profile;
end;
$$;

-- ---------------------------------------------------------------------------
-- get_my_verification_status: account-level state for the caller only
-- ---------------------------------------------------------------------------

create function public.get_my_verification_status()
returns table (
  state public.student_verification_state,
  is_suspended boolean,
  verified_until timestamptz,
  university_id uuid,
  latest_request_id uuid,
  latest_request_status public.verification_status,
  latest_rejection_reason text,
  can_submit boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception using errcode = 'PJ401', message = 'UNAUTHENTICATED';
  end if;

  return query
  with latest as (
    select sv.id, sv.status, sv.rejection_reason
    from public.student_verifications sv
    where sv.user_id = v_uid
    order by sv.created_at desc, sv.id desc
    limit 1
  ),
  fp as (
    select f.status, f.verified_until, f.university_id
    from public.freelancer_profiles f
    where f.user_id = v_uid
  )
  select
    private.student_verification_state(v_uid),
    coalesce((select fp.status = 'suspended' from fp), false),
    (select fp.verified_until from fp),
    (select fp.university_id from fp),
    (select latest.id from latest),
    (select latest.status from latest),
    (select latest.rejection_reason from latest where latest.status = 'rejected'),
    (
      private.is_onboarded(v_uid)
      and not exists (
        select 1 from public.student_verifications
        where user_id = v_uid and status = 'pending'
      )
      and not exists (
        select 1 from fp
        where fp.verified_until > now() + private.verification_renewal_window()
      )
    );
end;
$$;

-- ---------------------------------------------------------------------------
-- submit_student_verification (FR-VER-01, FR-VER-02, FR-VER-05, BR-02, BR-04)
-- ---------------------------------------------------------------------------

create function public.submit_student_verification(
  p_university_id uuid,
  p_method public.verification_method,
  p_student_number text default null,
  p_document_path text default null
)
returns public.student_verifications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_university public.universities;
  v_email text;
  v_email_confirmed_at timestamptz;
  v_domain text;
  v_student_number text := nullif(btrim(coalesce(p_student_number, '')), '');
  v_valid_until timestamptz;
  v_row public.student_verifications;
begin
  if v_uid is null then
    raise exception using errcode = 'PJ401', message = 'UNAUTHENTICATED';
  end if;
  if not private.is_onboarded(v_uid) then
    raise exception using errcode = 'PJ403', message = 'NOT_ONBOARDED';
  end if;
  if exists (
    select 1 from public.student_verifications
    where user_id = v_uid and status = 'pending'
  ) then
    raise exception using errcode = 'PJ409', message = 'VERIFICATION_PENDING';
  end if;
  if exists (
    select 1 from public.freelancer_profiles
    where user_id = v_uid
      and verified_until > now() + private.verification_renewal_window()
  ) then
    raise exception using errcode = 'PJ409', message = 'ALREADY_VERIFIED';
  end if;

  select * into v_university
  from public.universities
  where id = p_university_id and is_active;
  if v_university.id is null then
    raise exception using errcode = 'PJ404', message = 'UNIVERSITY_NOT_FOUND';
  end if;

  if p_method = 'email_domain' then
    select u.email, u.email_confirmed_at
      into v_email, v_email_confirmed_at
    from auth.users u
    where u.id = v_uid;

    v_domain := lower(split_part(coalesce(v_email, ''), '@', 2));
    if v_email_confirmed_at is null
       or v_domain = ''
       or not (v_domain = any (v_university.email_domains)) then
      raise exception using errcode = 'PJ422', message = 'EMAIL_DOMAIN_NOT_ELIGIBLE';
    end if;

    v_valid_until := now() + private.verification_default_validity();

    insert into public.student_verifications (
      user_id, university_id, method, verified_email, status, valid_until, reviewed_at
    )
    values (
      v_uid, v_university.id, 'email_domain', lower(v_email), 'approved', v_valid_until, now()
    )
    returning * into v_row;

    perform private.apply_verification_approval(v_uid, v_university.id, v_valid_until);
    return v_row;
  end if;

  if p_method = 'document' then
    if v_student_number is null or char_length(v_student_number) > 50 then
      raise exception using errcode = 'PJ422', message = 'INVALID_STUDENT_NUMBER';
    end if;
    if p_document_path is null
       or not starts_with(p_document_path, v_uid::text || '/')
       or position('..' in p_document_path) > 0
       or not exists (
         select 1 from storage.objects o
         where o.bucket_id = 'student-documents' and o.name = p_document_path
       ) then
      raise exception using errcode = 'PJ422', message = 'DOCUMENT_NOT_FOUND';
    end if;

    begin
      insert into public.student_verifications (
        user_id, university_id, method, student_number, document_path, status
      )
      values (
        v_uid, v_university.id, 'document', v_student_number, p_document_path, 'pending'
      )
      returning * into v_row;
    exception when unique_violation then
      raise exception using errcode = 'PJ409', message = 'VERIFICATION_PENDING';
    end;

    return v_row;
  end if;

  raise exception using errcode = 'PJ422', message = 'INVALID_METHOD';
end;
$$;

-- ---------------------------------------------------------------------------
-- review_student_verification (FR-VER-03, FR-VER-04) — admins only
-- ---------------------------------------------------------------------------

create function public.review_student_verification(
  p_verification_id uuid,
  p_decision text,
  p_valid_until timestamptz default null,
  p_reason text default null
)
returns public.student_verifications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.student_verifications;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if v_uid is null then
    raise exception using errcode = 'PJ401', message = 'UNAUTHENTICATED';
  end if;
  if not private.is_admin() then
    raise exception using errcode = 'PJ403', message = 'FORBIDDEN';
  end if;

  select * into v_row
  from public.student_verifications
  where id = p_verification_id
  for update;

  if v_row.id is null then
    raise exception using errcode = 'PJ404', message = 'VERIFICATION_NOT_FOUND';
  end if;
  if v_row.user_id = v_uid then
    raise exception using errcode = 'PJ403', message = 'CANNOT_REVIEW_OWN';
  end if;
  if v_row.status <> 'pending' then
    raise exception using errcode = 'PJ409', message = 'NOT_PENDING';
  end if;

  if p_decision = 'approve' then
    if p_valid_until is null
       or p_valid_until <= now()
       or p_valid_until > now() + private.verification_max_validity() then
      raise exception using errcode = 'PJ422', message = 'VALID_UNTIL_OUT_OF_RANGE';
    end if;

    update public.student_verifications
       set status = 'approved',
           valid_until = p_valid_until,
           reviewed_by = v_uid,
           reviewed_at = now()
     where id = v_row.id
    returning * into v_row;

    perform private.apply_verification_approval(v_row.user_id, v_row.university_id, p_valid_until);
    return v_row;
  end if;

  if p_decision = 'reject' then
    if v_reason is null or char_length(v_reason) > 500 then
      raise exception using errcode = 'PJ422', message = 'INVALID_REASON';
    end if;

    update public.student_verifications
       set status = 'rejected',
           rejection_reason = v_reason,
           reviewed_by = v_uid,
           reviewed_at = now()
     where id = v_row.id
    returning * into v_row;

    return v_row;
  end if;

  raise exception using errcode = 'PJ422', message = 'INVALID_DECISION';
end;
$$;

-- ---------------------------------------------------------------------------
-- Execute grants: authenticated only (functions check roles internally)
-- ---------------------------------------------------------------------------

revoke all on function
  public.complete_onboarding(text, text, boolean),
  public.get_my_verification_status(),
  public.submit_student_verification(uuid, public.verification_method, text, text),
  public.review_student_verification(uuid, text, timestamptz, text)
from public, anon;

grant execute on function
  public.complete_onboarding(text, text, boolean),
  public.get_my_verification_status(),
  public.submit_student_verification(uuid, public.verification_method, text, text),
  public.review_student_verification(uuid, text, timestamptz, text)
to authenticated, service_role;
