-- Security fixes for 20261113080600_services_marketplace.sql.
--
-- 1. Supabase grants ALL on new public tables to anon/authenticated by default.
--    The previous migration added column-level grants without revoking those
--    defaults, so owners could UPDATE any column directly (e.g. set
--    status = 'published' and blocked_at = null), bypassing set_service_status
--    and admin blocks. Reset privileges and grant only what is intended.
-- 2. set_service_status was SECURITY INVOKER (it relied on the over-broad
--    grant to update `status`). Recreate it as SECURITY DEFINER with an empty
--    search_path and fully qualified names, enforcing BR-15 (20 published).
-- 3. Admins can read all services (DATABASE §9).

revoke all on table
  public.categories,
  public.services,
  public.portfolio_items,
  public.service_listings
from anon, authenticated;

grant select on public.categories to anon, authenticated;
grant select on public.service_listings to anon, authenticated;

-- security_invoker view + public listing => anon needs SELECT on the base table;
-- the services RLS policy still decides which rows are visible.
grant select on public.services to anon, authenticated;
grant insert (freelancer_id, category_id, title, description, price, delivery_days,
  revisions_included, requirements_prompt, cover_image_path) on public.services to authenticated;
grant update (category_id, title, description, price, delivery_days,
  revisions_included, requirements_prompt, cover_image_path) on public.services to authenticated;
grant delete on public.services to authenticated;

grant select on public.portfolio_items to anon, authenticated;
grant insert (freelancer_id, title, description, external_url, image_paths, sort_order)
  on public.portfolio_items to authenticated;
grant update (title, description, external_url, image_paths, sort_order)
  on public.portfolio_items to authenticated;
grant delete on public.portfolio_items to authenticated;

create policy services_select_admin on public.services for select
  to authenticated using ((select private.is_admin()));

create function private.max_published_services()
returns integer language sql immutable set search_path = '' as $$ select 20 $$;

create or replace function public.set_service_status(
  p_service_id uuid,
  p_status public.service_status
)
returns public.services
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_service public.services;
begin
  if v_uid is null then
    raise exception using errcode = 'PJ401', message = 'UNAUTHENTICATED';
  end if;

  select * into v_service
  from public.services
  where id = p_service_id and freelancer_id = v_uid
  for update;
  if v_service.id is null then
    raise exception using errcode = 'PJ404', message = 'NOT_FOUND';
  end if;
  if v_service.status = 'archived' then
    raise exception using errcode = 'PJ409', message = 'SERVICE_ARCHIVED';
  end if;
  if p_status = 'draft'
     or (p_status = 'published' and v_service.status not in ('draft', 'paused'))
     or (p_status = 'paused' and v_service.status <> 'published') then
    raise exception using errcode = 'PJ409', message = 'INVALID_SERVICE_TRANSITION';
  end if;

  if p_status = 'published' then
    if not private.is_eligible_freelancer(v_uid) then
      raise exception using errcode = 'PJ403', message = 'FREELANCER_NOT_ELIGIBLE';
    end if;
    if v_service.blocked_at is not null then
      raise exception using errcode = 'PJ403', message = 'SERVICE_BLOCKED';
    end if;
    if v_service.cover_image_path is null then
      raise exception using errcode = 'PJ422', message = 'COVER_IMAGE_REQUIRED';
    end if;
    if (
      select count(*) from public.services
      where freelancer_id = v_uid and status = 'published'
    ) >= private.max_published_services() then
      raise exception using errcode = 'PJ409', message = 'MAX_PUBLISHED_SERVICES';
    end if;
  end if;

  update public.services
     set status = p_status,
         published_at = case
           when p_status = 'published' and published_at is null then now()
           else published_at
         end
   where id = v_service.id
  returning * into v_service;

  return v_service;
end;
$$;

revoke all on function private.max_published_services() from public, anon, authenticated;
revoke all on function public.set_service_status(uuid, public.service_status) from public, anon;
grant execute on function public.set_service_status(uuid, public.service_status) to authenticated, service_role;
