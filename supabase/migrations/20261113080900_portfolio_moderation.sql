-- Phase 4 completion: portfolio storage and admin moderation RPCs.

create function public.set_freelancer_status(
  p_user_id uuid,
  p_status public.freelancer_status
)
returns public.freelancer_profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.freelancer_profiles;
begin
  if not private.is_admin() then
    raise exception using errcode = 'PJ403', message = 'FORBIDDEN';
  end if;
  if p_user_id = auth.uid() then
    raise exception using errcode = 'PJ403', message = 'CANNOT_MODERATE_SELF';
  end if;
  update public.freelancer_profiles
     set status = p_status
   where user_id = p_user_id
   returning * into v_row;
  if v_row.user_id is null then
    raise exception using errcode = 'PJ404', message = 'FREELANCER_NOT_FOUND';
  end if;
  return v_row;
end;
$$;

create function public.admin_set_service_block(
  p_service_id uuid,
  p_blocked boolean,
  p_reason text default null
)
returns public.services
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.services;
  v_reason text := nullif(btrim(p_reason), '');
begin
  if not private.is_admin() then
    raise exception using errcode = 'PJ403', message = 'FORBIDDEN';
  end if;
  if p_blocked and (v_reason is null or char_length(v_reason) > 500) then
    raise exception using errcode = 'PJ422', message = 'INVALID_BLOCK_REASON';
  end if;
  update public.services
     set blocked_at = case when p_blocked then now() else null end,
         blocked_reason = case when p_blocked then v_reason else null end,
         status = case when p_blocked and status = 'published' then 'paused'::public.service_status else status end
   where id = p_service_id
   returning * into v_row;
  if v_row.id is null then
    raise exception using errcode = 'PJ404', message = 'SERVICE_NOT_FOUND';
  end if;
  return v_row;
end;
$$;

revoke all on function public.set_freelancer_status(uuid, public.freelancer_status)
from public, anon, authenticated;
revoke all on function public.admin_set_service_block(uuid, boolean, text)
from public, anon, authenticated;
grant execute on function public.set_freelancer_status(uuid, public.freelancer_status) to authenticated;
grant execute on function public.admin_set_service_block(uuid, boolean, text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portfolio', 'portfolio', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy portfolio_select_public on storage.objects for select
  to anon, authenticated using (bucket_id = 'portfolio');
create policy portfolio_insert_own on storage.objects for insert
  to authenticated with check (bucket_id = 'portfolio' and (storage.foldername(name))[1] = auth.uid()::text);
create policy portfolio_update_own on storage.objects for update
  to authenticated using (bucket_id = 'portfolio' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'portfolio' and (storage.foldername(name))[1] = auth.uid()::text);
create policy portfolio_delete_own on storage.objects for delete
  to authenticated using (bucket_id = 'portfolio' and (storage.foldername(name))[1] = auth.uid()::text);
