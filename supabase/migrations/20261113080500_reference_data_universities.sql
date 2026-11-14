-- Reference data: universities (docs/DATABASE.md §13, PRD Q6).
-- email_domains stay empty until the official *student* email domains are
-- confirmed; until then verification uses the document method only.

insert into public.universities (name, short_name, email_domains)
values
  ('STMIK PPKIA Tarakanita Rahmawati', 'STMIK PPKIA', '{}'),
  ('Universitas Borneo Tarakan', 'UBT', '{}')
on conflict (name) do nothing;
