# Projekin

Student-powered freelance marketplace. Only verified university students can work as freelancers; anyone can hire them. See [`docs/`](docs/) for the full blueprint (PRD, architecture, database, API contract, implementation plan).

## Stack

Next.js 16 (App Router) · TypeScript (strict) · Tailwind CSS v4 · shadcn/ui · Supabase (Postgres, Auth, Storage, RLS) · Vitest + PGlite · Midtrans Snap Sandbox (planned)

## Setup

1. **Install**

   ```bash
   npm install
   ```

2. **Environment.** Copy `.env.example` to `.env.local` and fill in the values from your Supabase project (Project Settings → API). Only **public** keys are needed; never put a secret/service-role key in a `NEXT_PUBLIC_*` variable.

   | Variable | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key (`sb_publishable_…`) or the legacy anon key |
   | `NEXT_PUBLIC_SITE_URL` (optional) | e.g. `http://localhost:3000`; used for auth email links |

3. **Apply the database migrations** to your hosted **dev** project (needs your Supabase login and the database password; nothing is committed):

   ```bash
   npx supabase login
   npx supabase link --project-ref <your-dev-project-ref>
   npx supabase db push
   ```

   After every schema change, regenerate the types (`src/types/database.ts` is generated; never edit it by hand, and it is excluded from Prettier):

   ```bash
   npx supabase gen types typescript --project-id <your-dev-project-ref> > src/types/database.ts
   ```

4. **Configure Auth** in the Supabase dashboard (Authentication):
   - **URL Configuration:** Site URL `http://localhost:3000`; add `http://localhost:3000/auth/confirm` (and your Vercel URLs) to Redirect URLs.
   - **Email confirmation:** keep "Confirm email" enabled.
   - **Email templates (recommended):** so links work when opened on another device, point the links at the token-hash flow and translate the copy to Bahasa Indonesia:
     - Confirm signup: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/onboarding`
     - Reset password: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`
   - The built-in email sender is heavily rate-limited; for development you can create users under Authentication → Users with "Auto Confirm User", or configure custom SMTP.

5. **Create the first admin.** The admin row points at an existing account, so create the account first:
   1. Register at `/register` (or in the dashboard: Authentication → Users → Add user → Create new user, with "Auto Confirm User" checked, which avoids the rate-limited confirmation email). The sign-up trigger creates the matching `public.profiles` row.
   2. In the SQL Editor (replace the email):

      ```sql
      insert into public.admin_users (user_id)
      select id from auth.users where email = 'admin@example.com'
      returning user_id;
      ```

      `returning` should show one row. Zero rows means the email doesn't match an account yet.
   3. Sign in and finish onboarding; the header then shows an "Admin" link.

   Admins cannot approve their own verification request, so test the review flow with a second (student) account.

6. **Run**

   ```bash
   npm run dev   # http://localhost:3000
   ```

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` · `npm run typecheck` · `npm run format:check` | Static checks |
| `npm test` | All tests (unit + database) |
| `npm run test:unit` | Unit tests (`tests/unit`) |
| `npm run test:db` | Database tests: applies `supabase/migrations` to an in-memory Postgres (PGlite) and checks RLS, grants, RPCs and storage policies |

CI (`.github/workflows/ci.yml`) runs lint, typecheck, tests and build, and applies the migrations to a real Supabase stack.

## Contributing

Read [`CLAUDE.md`](CLAUDE.md) and [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) before starting work.
