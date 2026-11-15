# Projekin

Student-powered freelance marketplace. Only verified university students can work as freelancers; anyone can hire them. See [`docs/`](docs/) for the full blueprint (PRD, architecture, database, API contract, implementation plan).

## Stack

Next.js 16 (App Router) · TypeScript (strict) · Tailwind CSS v4 · shadcn/ui · Supabase (Postgres, Auth, Storage, RLS) · Vitest + PGlite · Playwright · Midtrans Snap Sandbox

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
   - Unpaid orders are cancelled automatically 24 h + 15 min after creation by the `expire-unpaid-orders` `pg_cron` job, which the payments migration schedules. A daily Vercel Cron (`vercel.json`) calls `/api/cron/reconcile-payments` with `CRON_SECRET` to heal missed notifications. Delivered orders are completed automatically after 3 days by the `auto-complete-delivered-orders` `pg_cron` job (every 15 minutes).
   - **Vercel region:** `vercel.json` pins server functions to `sin1` (Singapore), next to the Supabase project in `ap-southeast-1`. If the Supabase project lives elsewhere, set `regions` to the closest Vercel region; every page makes several database round trips.
   - **Admin money operations:** `/admin` shows the queues. Resolve disputes at `/admin/disputes`. After refunding in the Midtrans dashboard (or by transfer), record the reference at `/admin/refunds`. After paying a freelancer off-platform, record it at `/admin/payouts`. Freelancers see their totals at `/dashboard/earnings`.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` · `npm run typecheck` · `npm run format:check` | Static checks |
| `npm test` | All tests (unit + database) |
| `npm run test:unit` | Unit tests (`tests/unit`) |
| `npm run test:db` | Database tests: applies `supabase/migrations` to an in-memory Postgres (PGlite) and checks RLS, grants, RPCs and storage policies |
| `npm run test:e2e` | Browser tests with Playwright (`e2e/`), see below |

CI (`.github/workflows/ci.yml`) runs lint, typecheck, tests and build, and applies the migrations to a real Supabase stack.

### Browser tests (Playwright)

The suite in `e2e/` opens the real app in Chromium: public pages, search, the 404 page, security headers, login redirects, every dashboard and admin page for each role, an order detail page, and phone-width layouts. Any browser error or console error (including CSP reports) fails the test. The tests **only read**: they sign in and open pages but never submit, upload or pay, because local development and production share one Supabase project.

```bash
npx playwright install chromium        # once
npm run build && npm run test:e2e      # starts `next start` on :3100
E2E_BASE_URL=https://projekin.vercel.app npm run test:e2e   # the deployed site
npx playwright test --ui               # watch the tests run
```

Signed-in tests use the demo accounts from `.demo-accounts` (git-ignored, one `role email password` line per account; the client role is `klien`) or the `E2E_{CLIENT,FREELANCER,ADMIN}_{EMAIL,PASSWORD}` environment variables. Tests for a role without credentials are skipped.

`.github/workflows/e2e.yml` runs the suite against `https://projekin.vercel.app` after each successful Vercel production deployment, and on demand (Actions → E2E → Run workflow). For the signed-in tests, add the six `E2E_…` values above as repository secrets (Settings → Secrets and variables → Actions).

### Demo data

`scripts/seed-demo/` replaces **all** data in the Supabase project from `.env.local` with a two-month demo history: 2 admins, 6 verified student freelancers, 1 pending and 1 rejected applicant, 6 clients; 17 services with covers, 12 portfolio items, 8 jobs with proposals, and 24 orders in every state (awaiting payment, in progress, delivered, completed with reviews and payouts, cancelled, disputed, refunded). All names are fictional and every e-mail uses `example.com`.

```bash
node scripts/seed-demo/seed.mjs --dry-run              # in-memory Postgres with the real migrations; writes nothing
node scripts/seed-demo/seed.mjs --dry-run --out /tmp/x # also renders every image and PDF for a visual check
node scripts/seed-demo/seed.mjs --remote --wipe        # DELETES every account, row and file, then seeds
```

The data goes through the app's own database functions as each user, so every business rule applies; only Midtrans is simulated (paid orders receive a `settlement` status). The run aborts and rolls back if any timestamp is in the future or any story is out of order. The remote run needs the linked Supabase CLI and `SUPABASE_SECRET_KEY`, keeps universities and categories, and writes the new logins (one shared password; set `DEMO_PASSWORD` to choose it) to `.demo-accounts`. Production shares this database, so run it only when you mean to reset the live demo. The two unpaid orders expire 24 hours after the run (the cron cancels them), as real ones would.

### Link previews

Shared links (WhatsApp, Facebook, X, LinkedIn, Telegram) show the title, description and `src/app/opengraph-image.jpg`, a 1200×630 screenshot of the home page, from the Open Graph metadata in `src/app/layout.tsx`. Service, job and profile links have their own preview (`generateMetadata` in their pages, built with `pagePreview` from `src/lib/site-metadata.ts`): a service shows its title, price, delivery time, freelancer and cover; a job its title, category, budget and deadline; a profile the person's name, avatar and, for verified students, campus, rating and number of services. After a visible change to the home page, regenerate the picture with `node scripts/og-image.mjs` (set `OG_SOURCE_URL` to capture a local server instead of the live site). Platforms cache previews: re-scrape with the [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/); WhatsApp refreshes after a while or for a URL it has not seen (e.g. with `?v=2`).

### Demo video

`scripts/demo-video/record.mjs` records the whole service flow on the live site as one take at 1920×1080, with a visible pointer, typing, Indonesian captions and title cards: Budi orders Rina's logo service, pays with GoPay QRIS through the Midtrans Sandbox simulator, Rina delivers a file, Budi approves and reviews, the admin records the payout, and Rina sees her earnings.

```bash
node scripts/demo-video/record.mjs --yes              # the real take (about 2.5 minutes)
node scripts/demo-video/record.mjs --yes --rehearsal  # same story with Maya and Nurul
FFMPEG=/path/to/ffmpeg node scripts/demo-video/finish.mjs scripts/demo-video/out/raw-final.webm \
  --start 0.9 --music track.mp3                       # MP4 with background music
```

Every take creates a real, completed order (paid in Sandbox) in the database behind `DEMO_BASE_URL` (default production, which shares the demo database), so it needs `--yes`. Logins come from `.demo-accounts`. Output goes to the git-ignored `scripts/demo-video/out/`: `projekin-demo.webm` always (Playwright's bundled ffmpeg), plus `projekin-demo.mp4` when `FFMPEG` points to a full ffmpeg build. A client can only have one unpaid order per service, so a failed take may need its unpaid order cancelled before the next one.

## Contributing

Read [`CLAUDE.md`](CLAUDE.md) and [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) before starting work.
