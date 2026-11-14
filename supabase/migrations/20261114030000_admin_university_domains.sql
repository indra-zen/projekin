-- Admins manage each university's student email domains in the app
-- (/admin/universities) instead of through data migrations (product-owner
-- request, 2026-11-14). Matching in request_student_verification stays exact:
-- the part after "@" must equal one of the listed domains.

create function public.admin_set_university_domains(
  p_university_id uuid,
  p_domains text[]
)
returns public.universities
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_domains text[];
  v_row public.universities;
begin
  if auth.uid() is null then
    raise exception using errcode = 'PJ401', message = 'UNAUTHENTICATED';
  end if;
  if not private.is_admin() then
    raise exception using errcode = 'PJ403', message = 'FORBIDDEN';
  end if;

  -- Trim, lower-case, drop a leading "@", remove blanks and duplicates.
  select coalesce(array_agg(distinct d order by d), '{}')
    into v_domains
  from (
    select lower(regexp_replace(btrim(x), '^@', '')) as d
    from unnest(coalesce(p_domains, '{}')) as x
  ) s
  where d <> '';

  if cardinality(v_domains) > 10 then
    raise exception using errcode = 'PJ422', message = 'TOO_MANY_EMAIL_DOMAINS';
  end if;
  if exists (
    select 1 from unnest(v_domains) as d
    where char_length(d) > 253
       or d !~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$'
  ) then
    raise exception using errcode = 'PJ422', message = 'INVALID_EMAIL_DOMAIN';
  end if;

  update public.universities
     set email_domains = v_domains
   where id = p_university_id
  returning * into v_row;
  if v_row.id is null then
    raise exception using errcode = 'PJ404', message = 'UNIVERSITY_NOT_FOUND';
  end if;
  return v_row;
end;
$$;

revoke all on function public.admin_set_university_domains(uuid, text[]) from public, anon;
grant execute on function public.admin_set_university_domains(uuid, text[]) to authenticated;

-- Confirmed by the product owner: STMIK PPKIA student addresses look like
-- 2450047@student.ppkia.ac.id. Only filled in while still empty.
update public.universities
   set email_domains = array['student.ppkia.ac.id']
 where name = 'STMIK PPKIA Tarakanita Rahmawati'
   and email_domains = '{}';
