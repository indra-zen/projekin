-- Identity foundation: private helper schema and enums.
-- See docs/DATABASE.md §1, §3.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

create type public.verification_method as enum ('email_domain', 'document');

-- Status of a single verification request.
create type public.verification_status as enum ('pending', 'approved', 'rejected');

create type public.freelancer_status as enum ('active', 'suspended');

-- Account-level student verification state, derived (never stored) from
-- student_verifications + freelancer_profiles. See docs/DATABASE.md §8.6.
create type public.student_verification_state as enum ('unverified', 'pending', 'verified', 'rejected');
