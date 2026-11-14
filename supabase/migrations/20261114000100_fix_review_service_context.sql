-- A freelancer reviews the client, so the review is not associated with a
-- service. Normalize this at the database boundary before enforcing it.

create or replace function private.normalize_review_service_id()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.reviewer_role = 'freelancer' then
    new.service_id := null;
  end if;
  return new;
end;
$$;

create trigger reviews_normalize_service_id
before insert or update on public.reviews
for each row execute function private.normalize_review_service_id();
