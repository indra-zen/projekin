-- Service marketplace, portfolio items, and public listing rules.

create type public.service_status as enum ('draft', 'published', 'paused', 'archived');

create table public.portfolio_items (
  id uuid primary key default gen_random_uuid(),
  freelancer_id uuid not null references public.freelancer_profiles(user_id) on delete cascade,
  title text not null,
  description text,
  external_url text,
  image_paths text[] not null default '{}',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint portfolio_items_title_length check (char_length(title) between 1 and 100),
  constraint portfolio_items_description_length check (description is null or char_length(description) <= 2000),
  constraint portfolio_items_external_url check (external_url is null or external_url ~ '^https://'),
  constraint portfolio_items_image_count check (cardinality(image_paths) <= 5)
);

create trigger portfolio_items_set_updated_at
before update on public.portfolio_items
for each row execute function private.set_updated_at();

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  constraint categories_slug_format check (slug ~ '^[a-z0-9-]{2,50}$'),
  constraint categories_name_length check (char_length(name) between 1 and 100)
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  freelancer_id uuid not null references public.freelancer_profiles(user_id) on delete restrict,
  category_id uuid not null references public.categories(id),
  title text not null,
  description text not null,
  price bigint not null,
  delivery_days smallint not null,
  revisions_included smallint not null default 0,
  requirements_prompt text,
  cover_image_path text,
  status public.service_status not null default 'draft',
  published_at timestamptz,
  blocked_at timestamptz,
  blocked_reason text,
  search tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'B')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint services_title_length check (char_length(title) between 10 and 100),
  constraint services_description_length check (char_length(description) between 50 and 5000),
  constraint services_price_idr check (price between 10000 and 50000000),
  constraint services_delivery_days check (delivery_days between 1 and 60),
  constraint services_revisions check (revisions_included between 0 and 5),
  constraint services_requirements_length check (requirements_prompt is null or char_length(requirements_prompt) <= 1000),
  constraint services_block_reason_length check (blocked_reason is null or char_length(blocked_reason) <= 500)
);

create index services_public_listing_idx
  on public.services (category_id, created_at desc)
  where status = 'published' and blocked_at is null;
create index services_freelancer_idx on public.services (freelancer_id, created_at desc);
create index services_search_idx on public.services using gin(search);
create trigger services_set_updated_at
before update on public.services
for each row execute function private.set_updated_at();

create view public.service_listings
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
  u.name as university_name, u.short_name as university_short_name
from public.services s
join public.categories c on c.id = s.category_id and c.is_active
join public.profiles p on p.id = s.freelancer_id and p.onboarded_at is not null
join public.freelancer_profiles fp on fp.user_id = s.freelancer_id
join public.universities u on u.id = fp.university_id
where s.status = 'published'
  and s.blocked_at is null
  and fp.status = 'active'
  and fp.verified_until > now();

insert into public.categories (slug, name, sort_order) values
  ('desain', 'Desain & Kreatif', 1),
  ('pengembangan', 'Pengembangan Web', 2),
  ('penulisan', 'Penulisan & Penerjemahan', 3),
  ('pemasaran', 'Pemasaran Digital', 4),
  ('video', 'Video & Animasi', 5)
on conflict (slug) do nothing;

create function public.set_service_status(
  p_service_id uuid,
  p_status public.service_status
)
returns public.services
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_service public.services;
begin
  select * into v_service from public.services
    where id = p_service_id and freelancer_id = auth.uid()
    for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'PJ404'; end if;
  if v_service.status = 'archived' then
    raise exception 'SERVICE_ARCHIVED' using errcode = 'PJ409';
  end if;
  if p_status = 'published' and v_service.status not in ('draft', 'paused') then
    raise exception 'INVALID_SERVICE_TRANSITION' using errcode = 'PJ409';
  end if;
  if p_status = 'paused' and v_service.status <> 'published' then
    raise exception 'INVALID_SERVICE_TRANSITION' using errcode = 'PJ409';
  end if;
  if p_status = 'archived' and v_service.status not in ('draft', 'published', 'paused') then
    raise exception 'INVALID_SERVICE_TRANSITION' using errcode = 'PJ409';
  end if;
  if p_status = 'published' then
    if not private.is_eligible_freelancer(auth.uid()) then
      raise exception 'FREELANCER_NOT_ELIGIBLE' using errcode = 'PJ403';
    end if;
    if v_service.blocked_at is not null then
      raise exception 'SERVICE_BLOCKED' using errcode = 'PJ403';
    end if;
    if v_service.cover_image_path is null then
      raise exception 'COVER_IMAGE_REQUIRED' using errcode = 'PJ422';
    end if;
    if (select count(*) from public.services where freelancer_id = auth.uid() and status = 'published') >= 10
      and v_service.status <> 'published' then
      raise exception 'MAX_PUBLISHED_SERVICES' using errcode = 'PJ409';
    end if;
  end if;
  update public.services
    set status = p_status,
        published_at = case when p_status = 'published' and published_at is null then now() else published_at end
    where id = p_service_id
    returning * into v_service;
  return v_service;
end;
$$;

grant select on public.categories to anon, authenticated;
grant select on public.service_listings to anon, authenticated;
grant select on public.services to authenticated;
grant insert (freelancer_id, category_id, title, description, price, delivery_days,
  revisions_included, requirements_prompt, cover_image_path) on public.services to authenticated;
grant update (category_id, title, description, price, delivery_days,
  revisions_included, requirements_prompt, cover_image_path) on public.services to authenticated;
grant delete on public.services to authenticated;
grant select, insert, update, delete on public.portfolio_items to authenticated;
grant execute on function public.set_service_status(uuid, public.service_status) to authenticated;

alter table public.categories enable row level security;
alter table public.services enable row level security;
alter table public.portfolio_items enable row level security;

create policy categories_select_active on public.categories for select
  to anon, authenticated using (is_active);
create policy services_select_public_or_own on public.services for select
  to anon, authenticated using (
    (status = 'published' and blocked_at is null and private.is_eligible_freelancer(freelancer_id))
    or freelancer_id = auth.uid()
  );
create policy services_insert_eligible on public.services for insert
  to authenticated with check (
    freelancer_id = auth.uid() and private.is_eligible_freelancer(auth.uid())
  );
create policy services_update_own on public.services for update
  to authenticated using (freelancer_id = auth.uid() and status <> 'archived')
  with check (freelancer_id = auth.uid() and status <> 'archived');
create policy services_delete_own_draft on public.services for delete
  to authenticated using (freelancer_id = auth.uid() and status = 'draft');
create policy portfolio_items_select_public_or_own on public.portfolio_items for select
  to anon, authenticated using (
    private.is_eligible_freelancer(freelancer_id) or freelancer_id = auth.uid()
  );
create policy portfolio_items_insert_own on public.portfolio_items for insert
  to authenticated with check (freelancer_id = auth.uid() and private.is_eligible_freelancer(auth.uid()));
create policy portfolio_items_update_own on public.portfolio_items for update
  to authenticated using (freelancer_id = auth.uid()) with check (freelancer_id = auth.uid());
create policy portfolio_items_delete_own on public.portfolio_items for delete
  to authenticated using (freelancer_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('service-media', 'service-media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
create policy service_media_select_public on storage.objects for select
  to anon, authenticated using (bucket_id = 'service-media');
create policy service_media_insert_own on storage.objects for insert
  to authenticated with check (bucket_id = 'service-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy service_media_update_own on storage.objects for update
  to authenticated using (bucket_id = 'service-media' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'service-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy service_media_delete_own on storage.objects for delete
  to authenticated using (bucket_id = 'service-media' and (storage.foldername(name))[1] = auth.uid()::text);
