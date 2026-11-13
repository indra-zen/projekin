# Projekin

Student-powered freelance marketplace. Only verified university students can work as freelancers; anyone can hire them. See [`docs/`](docs/) for the full blueprint (PRD, architecture, database, API contract, implementation plan).

## Stack

Next.js 16 (App Router) · TypeScript (strict) · Tailwind CSS v4 · shadcn/ui · Supabase (Postgres, Auth, Storage, RLS) · Vitest + PGlite · Midtrans Snap Sandbox

## Setup

1. **Install**

   ```bash
   npm install
   ```

2. **Environment.** Copy `.env.example` to `.env.local` (git-ignored) and fill in the values. Never put a server-only key in a `NEXT_PUBLIC_*` variable.

   | Variable | Exposure | Value |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase Project URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | public | Publishable key (`sb_publishable_…`) or the legacy anon key |
   | `NEXT_PUBLIC_SITE_URL` (optional) | public | e.g. `http://localhost:3000`; used for auth email links and the Snap "finish" redirect |
   | `MIDTRANS_IS_PRODUCTION` | server | Must be `false` (Sandbox only) |
   | `MIDTRANS_SERVER_KEY` | **server only** | Midtrans **Sandbox** dashboard → Settings → Access Keys → Server Key |
   | `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY` | public | Same page → Client Key (Snap.js popup) |
   | `SUPABASE_SECRET_KEY` | **server only** | Supabase → Project Settings → API Keys → secret key, or the legacy `service_role` key. Bypasses RLS; only `src/server/payments` and `src/app/api` use it. |
   | `CRON_SECRET` | **server only** | Any long random string (`openssl rand -hex 32`) |

   Without the payment variables the app still runs; checkout then shows "Pembayaran belum dikonfigurasi".

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

7. **Payments (Midtrans Snap Sandbox).** No real money moves.
   - Locally there is no public webhook URL. After paying, the order page asks the Midtrans Status API server-side: when Snap reports success, when you come back to the tab, when the page loads, or when you click "Periksa status pembayaran".
   - Sandbox payments are completed in the Midtrans **Payment Simulator** (the order page has a "Cara membayar di mode Sandbox" guide with links). Verified 2026-11-13 for every enabled method:

     | Method in Snap | How to pay in the sandbox |
     |---|---|
     | QRIS, GoPay QRIS, ShopeePay QRIS (desktop) | Right-click the QR → copy image address → [QRIS simulator](https://simulator.sandbox.midtrans.com/v2/qris/index) → paste into "QR Code Image Url" → Scan QR → Pay → PIN `123456` → Confirm if asked. Snap then shows "Payment successful". |
     | GoPay / ShopeePay (phone) | "Pay now" opens the simulator. GoPay: Pay. ShopeePay: PIN `123456` → Confirm. Then return to the order page (GoPay's simulator does not redirect back). |
     | BCA, BNI, BRI, Permata, CIMB VA | Copy the VA number → the bank's simulator ([BCA](https://simulator.sandbox.midtrans.com/bca/va/index), [BNI](https://simulator.sandbox.midtrans.com/bni/va/index), [BRI](https://simulator.sandbox.midtrans.com/openapi/va/index?bank=bri), [Permata](https://simulator.sandbox.midtrans.com/openapi/va/index?bank=permata), [CIMB](https://simulator.sandbox.midtrans.com/openapi/va/index?bank=cimb)) → Inquire → Pay. Snap does not notice VA payments; return to the order tab. |
     | Mandiri Bill | [Mandiri simulator](https://simulator.sandbox.midtrans.com/openapi/va/index?bank=mandiri): Snap's *Company code* as Biller Code, the VA number as Bill Key → Inquire → Pay. |
     | Other banks | Snap issues a BNI VA (bank code 009): use the BNI simulator. |
   - **Deployed environment:** set the Midtrans Sandbox dashboard → Settings → Payment → **Notification URL** to `https://<your-domain>/api/payments/midtrans/notification`. The handler verifies the signature, logs every notification in `payment_notifications`, and applies only what the Status API confirms.
   - Unpaid orders are cancelled automatically 24 h + 15 min after creation by the `expire-unpaid-orders` `pg_cron` job, which the payments migration schedules. A daily Vercel Cron (`vercel.json`) calls `/api/cron/reconcile-payments` with `CRON_SECRET` to heal missed notifications.

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
