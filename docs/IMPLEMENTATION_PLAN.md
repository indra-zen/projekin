# Projekin — Implementation Plan

| | |
|---|---|
| Status | Draft for approval |
| Version | 0.2 (2026-11-13), with product-owner decisions on Q1, Q3, Q6 and the database environment |
| Related | [PRD.md](PRD.md), [ARCHITECTURE.md](ARCHITECTURE.md), [DATABASE.md](DATABASE.md), [API_CONTRACT.md](API_CONTRACT.md) |

---

## 0. Implementation status

| Milestone | Status | Notes |
|---|---|---|
| Foundation (Phase 0 subset) | Done (Copilot, `46b1093`) | Next.js 16, strict TS, Tailwind, shadcn/ui config, layout, placeholder pages |
| Auth & profiles (Phases 1–3, identity subset) | Done on `feature/auth-profiles` (Claude Code) | Identity migrations + RLS + RPCs + storage; register/login/logout/password reset/email confirm; proxy session refresh and route protection; onboarding; profile edit and avatar upload; student verification (KTM upload or email domain); admin review queue; freelancer profile; public profile `/u/[username]`; Bahasa Indonesia UI for these flows; Vitest unit and PGlite database tests; CI workflow. Migrations applied to the hosted dev project; `src/types/database.ts` generated from it (matches the migrations: 5 tables, 4 RPCs, 4 enums, no private helpers exposed). **Manually verified on hosted dev by the product owner (2026-11-13):** register, login, onboarding, file upload, student verification. |
| Service marketplace (Phase 4, partial) | Done (Copilot, `7485086`) + security fix (Claude Code) | `services`, `categories`, `portfolio_items` (read-only), `service_listings`, `service-media` bucket, `set_service_status`, `/services`, `/dashboard/services`. **Fix `20261113080700_services_hardening.sql`:** the Copilot migration left Supabase's default `ALL` grants in place, so owners could set `status`/`blocked_at` directly and bypass publishing rules and admin blocks. The fix revokes them, recreates `set_service_status` as `SECURITY DEFINER`, aligns the publish limit to BR-15 (20), and adds admin read. Covered by `tests/db/services.test.ts`. |
| Job marketplace & proposals (Phase 5) + order creation | Done on `feature/auth-profiles` (Claude Code) | `jobs` (with `requirements`), `proposals`, unified `orders`, `order_events`; RLS + column grants; RPCs `close_job`, `submit_proposal`, `withdraw_proposal`, `reject_proposal`, `accept_proposal` (locks the job row; one live order per job enforced by a unique index), `cancel_order` (pre-payment only). Pages `/jobs` (search, category and budget filters, sort, pagination), `/jobs/[id]` (proposal form), `/dashboard/jobs` (+ new, edit, manage with accept/reject), `/dashboard/proposals`, `/dashboard/orders` (+ detail with cancel). Tests: `tests/db/jobs.test.ts`, `tests/unit/jobs.test.ts`, `tests/components/proposal-decision.test.tsx`. Migrations `080600`–`080800` applied to hosted dev; `src/types/database.ts` regenerated from it (`c124ea8`, which also fixed the service pages for the generated nullable view types). **Manually verified on hosted dev by the product owner (2026-11-13, Chrome):** post a job, submit a proposal, accept (order created, `accept_proposal` → 200). |
| Portfolio & moderation (Phase 4 completion) | Done (Copilot, `a39ffa9`) | Portfolio CRUD, `set_freelancer_status`, `admin_set_service_block`, `portfolio` bucket. Its migration was committed with the same version as the jobs migration (`080800`), so `db push` skipped it; renamed to `080900` and applied to hosted dev by Claude Code (2026-11-13). `moderation.ts` adjusted for the generated `p_reason` type. |
| Orders & payments (Phase 6) + completion | Done on `feature/auth-profiles` (Claude Code) | Migration `081000`: `payments`, `payment_notifications`, `order_deliveries`; RPCs `create_service_order`, `create_payment_attempt`, `attach_snap_token`, `fail_payment_attempt`, `apply_payment_status`, full `cancel_order` (BR-20), `expire_unpaid_orders` + `pg_cron` (every 5 min), `deliver_order` (message only), `complete_order`. Server: `src/server/payments/*` (sandbox-only config, Midtrans client, signature, status map, Snap builder, checkout, `syncAndApply`), admin client restricted by ESLint. Routes: `POST /api/payments/midtrans/notification`, `GET /api/cron/reconcile-payments` (+ `vercel.json`). UI: `/services/[id]/order`, order list filters and pagination, order detail with Snap payment panel (QRIS, GoPay, ShopeePay, bank VA), return-sync, payment history, deliver, confirm completion, cancel. Tests: `tests/db/payments.test.ts`, `tests/unit/payments.test.ts`, `tests/unit/payment-flow.test.ts`, `tests/components/payment-panel.test.tsx`. Applied to hosted dev; types regenerated. **Verified live (2026-11-13):** Snap create against the sandbox (201, token), Status API 404 handling, webhook on the real dev DB (forged → 401 logged, malformed → 400, signed unknown → 200 `not_found`), cron auth. **Manually verified by the product owner (2026-11-14, Chrome):** service order → VA payment → `in_progress` → deliver → confirm completion, and job flow hire → pay → job `filled`. Every other enabled method (QRIS, GoPay, ShopeePay, all VAs) was paid in the sandbox simulator by Claude Code (see §0.1). Follow-up `63d5cb5` added the sandbox payment guide, the tab-return status check, and fixed the on-load check under React StrictMode. |
| Fulfilment & reviews (Phases 7–8) | Done (Copilot, `674e208`) + QA fixes (Claude Code) | Migrations `20261114000000`–`000200`: `order_messages`, `disputes`, `reviews`, `order-files` bucket; RPCs `send_order_message`, `request_order_revision`, `open_order_dispute`, `create_order_review`, `auto_complete_delivered_orders` (+ `pg_cron`, every 15 min). The milestone shipped without tests for these RPCs and policies; they were added in the QA review below (`tests/db/fulfilment.test.ts`). |
| QA & security review (2026-11-14) | Done on `feature/auth-profiles` (Claude Code) | Full review of RLS, RPCs, grants, storage, actions, payments, webhook, secrets and UI. Fixed in migration `20261114010000_qa_security_fixes.sql` (applied to hosted dev with the product owner's approval; types regenerated): reviews were unreadable for signed-out visitors (anon had no `SELECT` grant); freelancers could delete already-delivered order files (dispute evidence); `send_order_message` accepted completed orders (BR-29) and refused admins; a NULL review rating surfaced as an internal error; service cover and portfolio image paths were not checked in direct PostgREST writes; the DATABASE §4.19 rating views were missing. App fixes: security headers (no framing protection at all before, ARCHITECTURE §12.1); `/services` filtered the category in JavaScript after `limit(24)` and had no pagination or sort (FR-SVC-05); profile ratings averaged only the latest 10 reviews and mixed freelancer and client reviews (FR-PROF-02); ratings missing from service detail and cards, proposal cards and the job page (FR-SVC-06, FR-REV-02; Phase 8 exit criterion); freelancers had no dispute form (BR-21); admins saw participant-only forms; the review form stayed after the 14-day window; delivery files used 1-hour inline signed URLs (now 60 s, download, created on click); dashboard header and `/jobs` filter layouts broke at 640–1023 px; past-the-end pages showed a load error; `deleteServiceAction` reported success when nothing was deleted. Tests: +42 (`tests/db/fulfilment.test.ts`, catalog checks in `tests/db/structure.test.ts`, draft-only deletion in `tests/db/services.test.ts`, `tests/unit/fulfilment.test.ts`, `tests/components/delivery-attachments.test.tsx`). Handoff check in §0.2. |
| Phase 9 + pre-deployment fixes (2026-11-14) | Done on `feature/auth-profiles` (Claude Code) | The product owner asked for everything to be fixed before deployment. **Phase 9** (migration `20261114020000_admin_money_operations.sql`, applied to hosted dev with approval; types regenerated): RPCs `resolve_dispute`, `mark_refund_completed`, `mark_payout_paid`; `/admin` overview with queue counts and an admin navigation bar; `/admin/disputes`, `/admin/refunds`, `/admin/payouts`; `/dashboard/earnings`; the order page shows the admin's decision and note, and refunds once done. **Fixes found by the first live end-to-end run:** every service action returned HTTP 500 in production builds because `src/server/actions/services.ts` re-exported a string from a `"use server"` file (Copilot, Phase 4; unit tests import the file directly and could not see it; now guarded by `tests/unit/use-server-exports.test.ts`); the service detail page nested a second `<main>`. **Other fixes:** payment-status sync throttled to one Midtrans call per attempt every 5 s (`payments.last_synced_at`); at most 50 files per order in `order-files`; the landing page translated to Bahasa Indonesia with real categories instead of sample listings; Terms and Privacy content; a favicon (`src/app/icon.svg`); Indonesian service and freelancer status labels; doubled card padding removed; the 5 unformatted Copilot files formatted; local secret files `chmod 600`. **Verified live on hosted dev (Chrome, production build, Midtrans Sandbox):** onboarding; KTM upload and admin approval; freelancer profile; two services created with covers and published; three service orders paid by BCA VA in the simulator (Snap popup works with the security headers); messages both ways; delivery with an attachment and its download; revision; a client dispute resolved as a refund and the refund marked; a freelancer dispute released to the freelancer; completion; reviews both ways; payouts marked; earnings totals; ratings for signed-out visitors on `/services` (incl. sort by rating), the service page and both profiles; a job posted and a proposal submitted (left open for the demo). Tests: +11 (Phase 9 DB rules, admin actions, sync throttle, use-server exports). |
| University email domains (2026-11-14) | Done (Claude Code) | Product-owner request: `/admin/universities` lets admins edit each campus's student email domains (migration `20261114030000`, applied to dev; replaces "data migrations only", PRD A3). STMIK PPKIA has `student.ppkia.ac.id`, so those students are verified instantly; Universitas Borneo Tarakan has none yet. Tests in `tests/db/universities.test.ts` and `tests/unit/fulfilment.test.ts`; checked live. |
| Still open | Deployment, Phase 10 | **Next: deployment** to Vercel against the existing `projekin-dev` Supabase project (product-owner decision, 2026-11-14; §0.2). Later (Phase 10): full CSP, Playwright E2E in CI. |

### 0.1 Known issues

- **Not verified by hand:** reject, withdraw, close job, edit job and order cancellation, and the time-based jobs (24 h expiry, 3-day auto-completion) on the live database. All are covered by DB and unit tests.
- **Demo data on dev (2026-11-14).** Three demo accounts (`demo.admin@example.com`, `demo.freelancer@example.com` as "Rina Pratiwi", `demo.klien@example.com` as "Budi Santoso") were created through the Auth admin API with confirmed emails. Their passwords exist only in the git-ignored `.demo-accounts` file on the product owner's machine. Their services, orders, reviews and an open job remain as demo content.
- **Firefox on the product owner's machine did not run the page JavaScript** (the "Terima & rekrut" confirmation needs JS). Stock Firefox and Chrome run the flow correctly; likely a local extension or setting.
- **Payment methods verified (2026-11-13 and 2026-11-14).** Every enabled method was paid in the sandbox simulator. QR payments report `payment_type = qris`. Snap does not notice VA payments, so the order page re-checks when the user returns to the tab. The steps are in the README and in the order page's sandbox guide.
- **Webhook needs a public URL.** Until the Midtrans Notification URL points at the deployed site, orders update through return-sync and the daily reconcile cron.
- **`SUPABASE_SECRET_KEY` on dev is the legacy `service_role` JWT.** Switch to an `sb_secret_` key from the dashboard when convenient; no code change is needed.
- **Race-condition tests are sequential.** PGlite has a single connection, so concurrency is tested through the unique-index backstops, not truly parallel transactions.
- **CI has not run yet.** The branch could not be pushed from the agent shell (no GitHub credentials there). The first run comes with the pull request, including the job that applies all migrations to a real Supabase stack.
- **Database tests use PGlite plus a Supabase shim.** CI's `migrations` job applies every migration to a real Supabase stack. Playwright E2E is not part of CI (the live run above used an ad-hoc script).
- **Email links opened on another device** need the token-hash email templates (README step 4). Supabase's built-in email sender is heavily rate-limited (PRD A5).
- **`npm audit`:** 7 moderate advisories in the dev-only ESLint chain. Production dependencies: 0.
- **Residual risks accepted (2026-11-14):** (1) while payments are Sandbox, a user with two accounts can buy their own service and review it; (2) the webhook logs every notification, including forged ones (by design, §4.3); (3) count-based limits (BR-13, BR-14, BR-15) are checked without a lock and can be exceeded by truly parallel requests; (4) `request_order_revision`, `open_order_dispute` and `auto_complete_delivered_orders` lock only the order row (no deadlock is possible).
- **Changing the password from settings** does not ask for the current password. Turn on Supabase Auth → Email → "Secure password change" in the dashboard (no code change).
- **The full Content-Security-Policy** (Report-Only, then enforced) is still Phase 10; only framing protection and basic headers ship.

### 0.2 Next steps (2026-11-14)

1. **Push and merge:** `git push -u origin feature/auth-profiles`, open a pull request into `main`, and merge once both CI jobs are green (`main` has no commits the branch lacks, so there are no conflicts).
2. **Deploy** (ARCHITECTURE §14, README). The Supabase project stays `projekin-dev` (product-owner decision), so no migration push is needed.
   - Vercel: import the repo (production branch `main`), set the env vars from ARCHITECTURE §4.1 with `NEXT_PUBLIC_SITE_URL` = the Vercel URL, and set `CRON_SECRET`.
   - Supabase dashboard → Auth → URL configuration: site URL = the Vercel URL; add `https://<domain>/auth/confirm` to the redirect URLs. Optionally turn on "Secure password change".
   - Midtrans Sandbox dashboard → Notification URL: `https://<domain>/api/payments/midtrans/notification`.
3. **Smoke test on the deployed site** with the demo accounts: one Snap payment (the webhook should move the order without pressing "Periksa status pembayaran"), then a quick look at `/admin`.
4. **Later (Phase 10):** full CSP, Playwright E2E in CI. Rules for new migrations: a unique version later than `20261114030000`; `revoke all … from anon, authenticated` before granting; database tests first; an Indonesian message for every new reason; regenerate `src/types/database.ts` after each push.

---

## 1. Working agreement

- **Sequential agents.** Claude Code and GitHub Copilot work one at a time. Before starting a phase, an agent reads `CLAUDE.md` and this plan, checks `git status`/`git log`, and confirms that the previous phase's exit criteria are met. It does not assume unfinished work is complete.
- **Branching.** One branch per phase: `phase-<n>-<slug>`. Commit at meaningful milestones inside the phase. Open a PR at the end of the phase. No merges without review. No force-push. No history rewriting.
- **Docs first.** If implementation needs a decision that differs from these documents, update the relevant document in the same PR and note it in §6 (Decision log).
- **Database changes** are new migration files only. Destructive changes need explicit approval.
- **Each phase ends green:** `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:db`, `npm run build` (and `npm run test:e2e` from Phase 4 on). Results are reported as they actually ran.

---

## 2. Prerequisites and decisions needed before Phase 1

| # | Item | Owner | Blocking |
|---|---|---|---|
| P1 | Approve this blueprint (or list changes) | Product owner | Phase 0 |
| P2 | ~~Database environment~~ **Decided:** hosted supabase.com projects ([ARCHITECTURE §4.2](ARCHITECTURE.md#42-database-workflow-hosted-supabase)). Still needed: create `projekin-dev` and share its project ref, URL and keys through `.env.local` (not chat or commits). | Product owner | Phase 1 |
| P2a | Approve the dev container change: add `postgresql-client` and `pg_prove` so that DB tests can run against dev from the container | Product owner | Phase 1 (local DB tests). CI works without it. |
| P3 | Supabase projects (dev, prod) and Midtrans Sandbox account keys, provided as env vars only, never committed | Product owner | Phase 1 (Supabase), Phase 6 (Midtrans) |
| P4 | Answers to the remaining PRD open questions Q2, Q4, Q5, Q6a, Q7 (Q1, Q3, Q6 are decided; defaults are used until then) | Product owner | Not blocking |
| P5 | Full Tarakan university list and official student email domains (Q6a) | Product owner | Not blocking. The document method works without domains. |

---

## 3. Phases

Each phase lists its **scope**, **tasks**, **tests** and **exit criteria**. Estimates assume one agent working sequentially and are only indicative.

### Phase 0: Project foundation (≈ 1 day)

**Scope.** An empty but production-shaped Next.js app.

Tasks:
1. `create-next-app` (TypeScript, App Router, `src/`, Tailwind, ESLint) with the latest stable Next.js. Pin exact versions.
2. `tsconfig`: `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`. Path alias `@/*`.
3. shadcn/ui init. Add base components (button, input, textarea, label, form, card, badge, dialog, dropdown-menu, select, tabs, table, sonner, skeleton, avatar, separator).
4. ESLint flat config: `typescript-eslint` strict, `no-restricted-imports` for `@/lib/supabase/admin` ([ARCHITECTURE §6.3](ARCHITECTURE.md#63-supabase-clients)), ban `dangerouslySetInnerHTML` (`react/no-danger`). Prettier.
5. Vitest + Testing Library config. Playwright config (not yet used).
6. `src/lib/env/{server,client}.ts` with Zod validation and the `MIDTRANS_IS_PRODUCTION=false` guard. `.env.example`.
7. Supabase CLI as an npm dev dependency: `npx supabase init`, `supabase/config.toml` (auth: confirm email on, site URL, redirect URLs, used by the CI local stack), `npx supabase link` to `projekin-dev`.
7a. Bahasa Indonesia baseline: `<html lang="id">`, the Indonesian Zod error map, and the `error-messages.ts` skeleton (ARCHITECTURE §11.6).
7b. If P2a is approved: add `postgresql-client` and `pg_prove` to `.devcontainer/Dockerfile`.
8. GitHub Actions CI: install → lint → typecheck → unit → build. (The DB test job is added in Phase 1.)
9. npm scripts: `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:db`, `test:e2e`, `db:types`.

Tests: unit tests for env validation (rejects a missing key and rejects `MIDTRANS_IS_PRODUCTION=true`).

Exit: CI green. App renders a placeholder home page. No secrets in the repo.

### Phase 1: Database foundation (≈ 3 days)

**Scope.** The complete schema, security model and storage. RPCs come later, phase by phase.

Tasks (migrations in the order of [DATABASE §14](DATABASE.md#14-migration-plan), except `rpc_functions`, which is split across phases):
1. Extensions, the `private` schema, enums.
2. All tables, constraints, indexes, the `updated_at` trigger, and the `handle_new_user` trigger.
3. `private` helpers and business-constant functions.
4. RLS enabled on all tables. Policies per [DATABASE §9](DATABASE.md#9-rls-policy-matrix). Grants per §10.
5. Views (`*_rating_stats`, `service_listings`).
6. Storage buckets with size and MIME limits, and policies per §11.
7. `pg_cron` extension enabled. Schedules are added in Phases 6–7, together with their functions.
8. `reference_data` migration (categories and Tarakan universities, DATABASE §13). `seed.sql` and fixtures for CI test users (client, student-freelancer, admin).
9. Generate `src/types/database.ts`.
10. pgTAP test helpers: `tests.as_anon()`, `tests.as_user(uid)` (set `role` and `request.jwt.claims`), `tests.create_user(email)`.

Tests (pgTAP):
- Structure: tables, RLS enabled on **every** table (a query over `pg_class` asserting `relrowsecurity`), no table without policies except where intended.
- RLS matrix: for every table and operation, anon, a stranger, the owner and an admin each produce the expected allow/deny.
- Column grants: an owner cannot update `status`, `verified_until`, `blocked_at`, `onboarded_at` or money columns.
- Storage: path-prefix policies for each bucket. `student-documents` is not readable by other users.

Exit: migrations apply cleanly from scratch in CI (`supabase db reset` on the ephemeral stack) **and** incrementally to `projekin-dev` (`npx supabase db push`). `npm run test:db` is green in CI (and locally against dev if P2a is approved). Generated types are committed.

### Phase 2: Auth, onboarding, profiles (≈ 2 days)

Tasks:
1. Supabase clients (`browser`, `server`, `admin`), `proxy.ts` session refresh, `requireUser`/`requireOnboarded`/`requireAdmin`.
2. `/signup`, `/login`, `/forgot-password`, `/reset-password`, `/auth/confirm`, sign-out.
3. RPC `complete_onboarding` plus `/onboarding`.
4. `/dashboard/settings/profile` (avatar upload to `avatars`), public `/u/[username]` (profile section only).
5. `src/server/errors.ts` mapping and `ActionResult` types.
6. Layouts: public header (auth-aware), dashboard shell, admin shell (`notFound` for non-admins).

Tests: unit (safe `next` redirect, error mapping, Indonesian messages exist for every `reason`); pgTAP (`complete_onboarding`); integration (actions reject unauthenticated calls); E2E in CI (J1 sign-up → confirm through the CI stack's Mailpit inbox → onboarding). Manual check on dev with a dashboard-created, auto-confirmed user.

Exit: J1 works locally. Protected routes redirect. Admin routes 404 for non-admins.

### Phase 3: Student verification, freelancer profile, portfolio (≈ 3 days)

Tasks:
1. RPCs `submit_student_verification`, `review_student_verification`, `set_freelancer_status`.
2. `/dashboard/verification` (both methods, status display, renewal).
3. `/admin/verifications` (+ detail with signed document URL).
4. `/dashboard/freelancer` and `/dashboard/portfolio`. Portfolio and freelancer sections on `/u/[username]`.
5. Verified-student badge component.

Tests: pgTAP (auto-approval only for a confirmed exact-domain match; a pending-request conflict; renewal window; admin-only review; approval upserts `freelancer_profiles`; suspended status preserved); integration (document path must belong to the caller); E2E (J2 both paths).

Exit: a student can become an eligible freelancer by both methods. Non-students cannot.

### Phase 4: Service marketplace (≈ 3 days) — Implemented

Tasks:
1. RPCs `set_service_status`, `admin_set_service_block`.
2. `/dashboard/services` (list, new, edit, publish, pause, archive, delete draft) with cover upload.
3. `/services` (search, filters, sort, pagination using `service_listings`) and `/services/[id]`.
4. Landing page sections.
5. `/admin/moderation` (service block, freelancer suspend).

Tests: pgTAP (publish preconditions; hidden when the freelancer is ineligible, suspended or blocked; publish limit); unit (search param parsing); E2E (J3; browse and search).

Exit: published services are discoverable. Visibility rules hold. The initial implementation is available at `/services`, `/services/[id]`, and `/dashboard/services`; it includes the `services`, `categories`, `portfolio_items`, `service_listings`, storage bucket, RLS policies, and `set_service_status` migration. Portfolio records are readable on public profiles and service details; portfolio CRUD, ordering, moderation, and E2E coverage remain planned.

### Phase 5: Job marketplace and proposals (≈ 3 days)

Tasks:
1. RPCs `close_job`, `submit_proposal`, `withdraw_proposal`, `reject_proposal`. (`accept_proposal` comes in Phase 6, because it creates orders.)
2. `/dashboard/jobs` (new, edit under BR-30, close), `/jobs`, `/jobs/[id]` with the proposal form and eligibility messaging.
3. `/dashboard/jobs/[id]` (proposal review list), `/dashboard/proposals`.
4. Admin `closeJob` in moderation.

Tests: pgTAP (own-job proposal blocked; duplicate blocked; daily limit; job edit blocked after the first proposal; proposals visible only to the owner and the job owner; RLS recursion check: querying jobs and proposals as each role does not error); E2E (J6; J5 up to the hire button).

Exit: jobs and proposals work end to end, except hiring.

### Phase 6: Orders and payments (≈ 5 days)

**Scope.** Order creation for both flows, plus Midtrans Snap payment until `in_progress`.

Tasks:
1. RPCs `create_service_order`, `accept_proposal`, `create_payment_attempt`, `attach_snap_token`, `fail_payment_attempt`, `apply_payment_status`, `cancel_order`, `expire_unpaid_orders` + `pg_cron` schedule.
2. `src/server/payments/*`: Midtrans client, signature verification, status map, `syncAndApply`.
3. Actions `createServiceOrder`, `acceptProposal`, `startPayment`, `syncPaymentStatus`, `cancelOrder`.
4. Route handlers: Midtrans notification and reconcile cron. `vercel.json` cron.
5. `/services/[id]/order`, the hire confirmation dialog, `/dashboard/orders` (list) and `/dashboard/orders/[id]` (summary, payment panel, pay button with Snap.js, cancel, payment history).

Tests:
- Unit: signature (valid, tampered field, wrong key); status mapping table (every row of DATABASE §8.2); Snap request builder (amount equals item sum, expiry ≤ due, name truncation); `gross_amount` parsing.
- pgTAP: amounts and fee computed from DB; BR-06/BR-12 limits; `accept_proposal` atomicity (job `hiring`, unique live order per job); every `apply_payment_status` branch (paid → in_progress and job filled and proposals rejected; late payment → refund pending; duplicate → refund pending; regression ignored; amount mismatch; unknown); `cancel_order` pre-payment reopens the job; `expire_unpaid_orders`; RPCs denied for anon and non-parties; service-role-only functions denied for `authenticated`.
- Integration: notification route with mocked Midtrans (`fetch` mocked): invalid signature → 401 and no change; valid → Status API consulted → applied; Status API down → 500.
- E2E: J4 and J5 through to `in_progress`. The payment is simulated by a test fixture that calls `apply_payment_status` through the service role (no production mock mode). The real Snap popup is tagged `@sandbox` and run manually.

Exit: both flows reach `in_progress` only through verified payment status. Manual sandbox checklist §4.6 items 1–6 pass.

**Status (2026-11-13):** implemented as described in §0, plus `deliver_order` and `complete_order` for completion confirmation (product request). E2E with Playwright is still missing; the integration layer is covered by route/action tests with mocked `fetch` and a mocked admin client (`tests/unit/payment-flow.test.ts`). The §4.6 manual run is pending.

### Phase 7: Order fulfilment (≈ 3 days) — Implemented

Implemented in migration `20261114000000_fulfilment_reviews.sql`: order-scoped messages, revision requests, disputes, private delivery-file storage and signed downloads, and the 3-day auto-completion job. The order detail screen exposes these flows with validation, loading states, and participant-only access. Corrected in `20261114010000` (QA review): delivered files are immutable, messages follow BR-29 and admins may post, and either party can open a dispute from the order page.

Tests: `tests/db/fulfilment.test.ts` (added in the QA review: every RPC's actor, state and input rules, RLS on messages and disputes, the `order-files` policies, auto-completion) and `tests/unit/fulfilment.test.ts`. Playwright coverage remains open.

Exit: orders complete end to end through every path in [DATABASE §8.1](DATABASE.md#81-order) except admin resolution.

### Phase 8: Reviews and ratings (≈ 1.5 days) — Implemented

Tasks: RPC `create_order_review`. Review form on completed orders, one review per reviewer, 1–5 validation and the 14-day window. Ratings (from the `freelancer_rating_stats`, `client_rating_stats` and `service_rating_stats` views added in `20261114010000`) appear on public profiles (as freelancer and as client, separately), service detail and cards, proposal cards and the job page; the service detail page lists that service's reviews.

Tests: `tests/db/fulfilment.test.ts` (review rules, public read including anon, immutability, view aggregation). Playwright coverage remains open.

Exit: ratings appear correctly on all surfaces.

### Phase 9: Admin money operations and earnings (≈ 2 days) — Implemented

**Status (2026-11-14):** implemented in `20261114020000_admin_money_operations.sql` with the admin pages and `/dashboard/earnings` (§0). Tests: the Phase 9 block in `tests/db/fulfilment.test.ts` and `tests/unit/fulfilment.test.ts`. Verified live on dev, including both dispute outcomes.

Tasks: RPCs `resolve_dispute`, `mark_refund_completed`, `mark_payout_paid`. `/admin/disputes`, `/admin/refunds`, `/admin/payouts`, `/admin` overview counts. `/dashboard/earnings`.

Tests: pgTAP (admin-only; resolution outcomes; refund and payout transitions; `payout_status` constraint); E2E (J8 resolution, J10).

Exit: every money-affecting state can be closed out by an admin.

### Phase 10: Hardening and launch (≈ 3 days)

**Status (2026-11-14):** Phase 9 was finished first (§0). Task 5 (deploy) is next (§0.2). Done or mostly done: task 1 (QA review), task 3 (labels and the 360 px check), task 7 (README). Remaining: the full CSP (task 2), `error.tsx` coverage (task 4), and task 6 on the deployed site.

Tasks:
1. Security review against the [risk register](ARCHITECTURE.md#122-risk-register). Run `/security-review`. Fix findings.
2. CSP in Report-Only → tune for Snap and Supabase → enforce.
3. Accessibility pass (keyboard, labels, contrast) on core flows. Responsive check at 360 px.
4. Error and empty states. `error.tsx` and `not-found.tsx` everywhere.
5. Deploy: Supabase prod migrations, Vercel env, Midtrans notification URL, first admin user ([ARCHITECTURE §14](ARCHITECTURE.md#14-deployment)).
6. Full manual sandbox QA (§4.6) on the deployed environment.
7. Update the README with setup and run instructions.

Exit: all CI checks green. The QA checklist passes on production (sandbox). Known issues documented.

**Total indicative effort:** ≈ 29.5 agent-days.

---

## 4. Testing strategy

### 4.1 Layers

| Layer | Tool | What | Runs |
|---|---|---|---|
| Static | `tsc --noEmit`, ESLint | Types, banned patterns (admin client imports, `dangerouslySetInnerHTML`) | Every push |
| Component | Vitest + React Testing Library + jsdom (`tests/components/*.test.tsx`, `// @vitest-environment jsdom`) | Client component behaviour, e.g. the accept-proposal confirmation submits the proposal id | Every push |
| Unit | Vitest | Pure logic: Zod schemas, signature, status map, Snap body builder, formatting, safe redirect, error mapping, env guard | Every push |
| Database | Vitest + **PGlite** (`tests/db`): real migrations on embedded Postgres with a Supabase shim | RLS matrix, column grants, storage policies, every RPC (happy path + wrong actor + wrong state + limits), constraints | Every push, and locally (no Docker needed). CI additionally applies the migrations to a real Supabase stack (`migrations` job). |
| Integration | Vitest + CI ephemeral Supabase stack | Route handlers called as functions with `Request` objects. Actions' auth and validation behaviour. Real user JWTs from seeded users. Midtrans HTTP mocked by stubbing `fetch`. | Every push |
| E2E | Playwright | Journeys J1–J10 against `next build && next start` + CI ephemeral Supabase stack. Payment simulated by a service-role fixture. | PRs to `main` |
| Sandbox E2E | Playwright `@sandbox` tag + manual | Real Snap popup and sandbox payment methods | Manual before release |

### 4.2 Database test conventions

> **Decision (2026-11-13):** database tests are written in TypeScript (Vitest) against PGlite instead of pgTAP. They run in the dev container without Docker, which satisfies "run relevant tests" locally. `tests/db/harness.ts` provides `createTestDb()` (shim + every migration), `as(db, actor, fn)` (impersonates `anon`/`authenticated`/`service_role` with JWT claims, like PostgREST) and `expectPgError()`. The shim mimics Supabase's default grants, so tests also prove that the migrations revoke them. **Limitation:** the shim is not Supabase. The CI `migrations` job is the check that the SQL applies on real Supabase. The conventions below still apply, with "pgTAP file" read as "Vitest file in `tests/db`".


- One file per area: `supabase/tests/rls_<table>.test.sql`, `rpc_<function>.test.sql`, `storage.test.sql`, `structure.test.sql`.
- Each test runs in a transaction (`begin; select plan(n); … select * from finish(); rollback;`).
- Impersonation: `set local role authenticated; set local request.jwt.claims = '{"sub":"<uuid>","role":"authenticated"}';`, wrapped in helpers.
- **RLS coverage rule:** every cell of the [DATABASE §9](DATABASE.md#9-rls-policy-matrix) matrix has at least one positive and one negative assertion.
- **RPC coverage rule:** every precondition listed in [DATABASE §7.2](DATABASE.md#72-function-catalogue) has a test that it raises the documented SQLSTATE and reason.
- Concurrency (best effort): double `accept_proposal` and pay-vs-cancel races are covered through constraint tests (unique live order per job, one live attempt). True parallel-session tests are optional.

### 4.3 Payment-specific test matrix

| Scenario | Expected |
|---|---|
| Valid `settlement` notification, Status API agrees | Payment `paid`, order `in_progress`, `due_at` set |
| Notification with tampered `gross_amount` | 401, no change, logged `signature_valid=false` |
| Valid signature but Status API returns a different amount | `amount_mismatch`, 200, no change |
| Duplicate `settlement` notification | `no_change` |
| `pending` after `paid` | `ignored_regression` |
| `expire` on a live attempt | Attempt `expired`, order still `awaiting_payment`, retry allowed |
| Settlement after the order was cancelled | Payment `paid`, `refund_status='pending'`, event `late_payment_detected` |
| Second attempt paid | `duplicate_payment_detected`, refund pending |
| Unknown `order_id` | 200 `unknown_payment` |
| Status API timeout | 500 (Midtrans will retry) |
| Snap create fails | Attempt `failed`, `PAYMENT_PROVIDER_ERROR`, retry creates attempt 2 |
| 6th attempt | `LIMIT_REACHED`/`MAX_PAYMENT_ATTEMPTS` |
| `onSuccess` fired client-side but no transaction at Midtrans | Order stays `awaiting_payment` |

### 4.4 Test data

- Reference data (categories, universities) is a data migration (DATABASE §13). `supabase/seed.sql` holds CI-only test data.
- `tests/fixtures/` holds TypeScript factories that create users through the Auth admin API and data through RPCs. They run only against the **CI local stack**.
- Against hosted projects, only rolled-back pgTAP files may run, and only on **dev**. Integration and E2E tests, which commit data, never run against hosted projects. **Nothing** runs against prod.

### 4.5 CI pipeline (GitHub Actions)

```
jobs:
  quality:  npm ci → lint → typecheck → test (unit) → build
  database: supabase start → supabase db reset → supabase test db → integration tests
  e2e:      (PR to main) supabase start → build → playwright
```

Secrets in CI: none needed for these jobs (the local stack has well-known local keys, and Midtrans is mocked).

### 4.6 Manual sandbox QA checklist

Run against an environment whose Notification URL is configured (locally, return-sync stands in for the webhook). Enabled methods: QRIS, GoPay, ShopeePay and bank VAs (no cards). The simulator steps verified on 2026-11-13 are in the README ("Payments"); re-check the **current Midtrans Sandbox testing documentation** if a simulator page has changed.

1. Service order, QRIS / GoPay QRIS / ShopeePay QRIS paid in the QRIS simulator → Snap shows success → order `in_progress` without refreshing.
2. Service order, bank transfer VA → pending → pay through the bank's simulator → return to the tab → `in_progress`.
3. Close Snap without paying → reopen "Pay" → same token reused.
4. An attempt expires or fails (e.g. expire it in the Midtrans dashboard) → attempt `expired`/`failed` → "Bayar sekarang" creates a new attempt.
5. Let an attempt expire (short-window environment or wait) → order auto-cancelled after the grace period.
6. Job flow: hire → pay → job `filled`, other proposals rejected.
7. Deliver → revision → deliver → accept → payout pending → admin marks paid.
8. Freelancer cancels before delivery → refund pending → admin marks refunded (after refunding in the Midtrans dashboard).
9. Dispute → refund outcome, and dispute → release outcome.
10. Reviews both ways, ratings visible.
11. Notification log shows signature-valid entries. A manually posted forged notification is rejected (401).

---

## 5. Definition of done (per phase / PR)

- Scope tasks done. Docs updated if a decision changed.
- Lint, typecheck, unit, DB, integration and build pass locally and in CI. E2E passes from Phase 4 on.
- New RPCs and policies have pgTAP tests per the coverage rules in §4.2.
- No secrets, no `console.log` of sensitive data, no `any` without a justification comment.
- Completion report: what was implemented, files changed, tests run with actual results, known issues, remaining work, recommended next step (CLAUDE.md).

---

## 6. Blueprint review log

This section records the review of the five documents for contradictions and missing requirements, done before approval.

### 6.1 Contradictions found and resolved

| # | Issue | Resolution |
|---|---|---|
| R1 | The PRD put ToS acceptance at sign-up, but the schema records it in `complete_onboarding`. | ToS moved to onboarding (PRD FR-AUTH-04, J1, Q5). |
| R2 | A `freelancer_profiles.skills` CHECK referenced an undefined helper. | Defined `private.skills_valid(text[])` (DATABASE §6.2). |
| R3 | ARCHITECTURE listed `cancelOrder` as an admin-DB-client user, contradicting the "payments only" rule. Its ESLint restriction would also have blocked the payment actions themselves. | `cancelOrder` uses only the Midtrans client. The admin client is reachable only through `src/server/payments/**` (ARCHITECTURE §6.3). |
| R4 | The reconciliation scope differed: DATABASE §12 said `pending` only, ARCHITECTURE §9.5 said `initiated` and `pending`. | Aligned on `initiated`/`pending` plus stale-initiated failure. |
| R5 | `syncPaymentStatus` rate limiting depended on `last_synced_at`, which is not written when the Status API returns 404. | Removed the server rate-limit claim. The action is idempotent and the UI debounces. `apply_payment_status` now always sets `last_synced_at`. |
| R6 | `sort=rating` on `/services` needed ordering by an aggregate view, which PostgREST cannot reliably embed. | Added the `security_invoker` view `service_listings` (DATABASE §4.19, API §5.2). |
| R7 | Direct writes blocked by RLS on UPDATE/DELETE affect zero rows silently, but API errors such as `JOB_NOT_EDITABLE` assumed an exception. | Added API §1.5 (pre-read plus a zero-row check). |
| R8 | Lock ordering: `apply_payment_status` naturally locks the payment first, while `cancel_order` locks the order first (deadlock risk). | Global lock order `jobs → proposals → orders → payments`. `apply_payment_status` looks up IDs without locking, then locks in order (DATABASE §7, §8.2). |

### 6.2 Missing requirements found and added

| # | Gap | Resolution |
|---|---|---|
| M1 | A freelancer could not back out of an accepted-but-unpaid hire, which would leave the client paying for someone unavailable. | The freelancer may cancel an `awaiting_payment` order (BR-20, DATABASE `cancel_order`, API `cancelOrder`). |
| M2 | Job status after a **paid** job order is cancelled was undefined. | The job stays `filled`, and the client reposts (PRD FR-PROP-05, DATABASE `cancel_order`). |
| M3 | No path existed for students whose university is not listed. | Admin adds the university. Recorded as PRD Q7. |
| M4 | Auth and legal pages were missing from the route contract. | Added `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/terms`, `/privacy` (API §5.2). ToS content is the product owner's (Q5). |
| M5 | Midtrans order IDs could collide across environments sharing one sandbox merchant. | A random suffix in `midtrans_order_id`. Unknown IDs are acknowledged with 200 (DATABASE §4.16, ARCHITECTURE §9.3). |
| M6 | A user could cancel while a VA was still payable, leading to money received for a cancelled order. | Best-effort Midtrans `expire` after `cancel_order`, plus the late-payment refund path (ARCHITECTURE §9.6). |
| M7 | Academic-dishonesty listings are a known risk for student marketplaces. | BR-25, SR-21, admin block. |

### 6.3 Known limitations accepted for MVP

- Refunds and payouts are manual. Admin workload grows with volume (ADR-07).
- Without a public webhook URL (local/preview), payment confirmation relies on return-sync and reconciliation. Reconciliation is daily on the Vercel Hobby plan.
- There is no notification system. Users must open the dashboard to see changes (PRD Q3).
- The student document purge job and self-service account deletion are post-MVP (PRD Q4, DATABASE §15). They need a decision before any real pilot under UU PDP.
- Orphaned storage uploads (uploaded but never referenced) are not cleaned up.
- The `is_eligible_freelancer()` per-row check in the services policy is fine at MVP scale and may need denormalisation later.
- The dev database is shared by local development and Vercel previews, so test and preview data mix. Free-plan projects pause when inactive.
- Without P2a, DB tests run only in CI, so local feedback on SQL changes needs a push to a branch.
- Transactional email is excluded (PRD Q3, decided). Users must check the dashboard.
- Automatic student-email verification is off for every seeded university until student email domains are confirmed (Q6a).

### 6.4 Decision log

| Date | Decision | Docs updated |
|---|---|---|
| 2026-11-13 | Initial blueprint v0.1 | All |
| 2026-11-13 | Database environment: hosted supabase.com (dev + prod) instead of a local Docker stack. CI uses an ephemeral local stack. | ARCHITECTURE §4, §14; DATABASE §13, §14; IMPLEMENTATION_PLAN §2, §3, §4.4, §6.3 |
| 2026-11-13 | Q1: UI in Bahasa Indonesia (NFR-11) | PRD; ARCHITECTURE §3, §11.6; API_CONTRACT §7; IMPLEMENTATION_PLAN Phase 0/2 |
| 2026-11-13 | Q3: transactional email excluded from MVP (not "easy": needs provider, domain and outbox worker) | PRD §4.2, §10.2 |
| 2026-11-13 | Schema added incrementally per phase (identity first) instead of the whole schema in Phase 1 | DATABASE §14 |
| 2026-11-13 | Account-level verification states `unverified/pending/verified/rejected`, derived in SQL (never stored or client-writable) | DATABASE §3, §6.1, §7.2, §8.6 |
| 2026-11-13 | Forms: Server Actions + `useActionState` (no react-hook-form). DB tests: Vitest + PGlite (no pgTAP). `proxy.ts` replaces the deprecated `middleware.ts`. Route `/register` (existing) instead of `/signup`. | ARCHITECTURE §3, §5; API_CONTRACT §4.0, §5.2; IMPLEMENTATION_PLAN §4 |
| 2026-11-13 | Jobs get an optional `requirements` field (product request) and `closed_reason`; "close" and "cancel" a posting are the same action (`close_job`, status `closed`). Job orders copy `requirements` from the job. `cancel_order` is implemented for `awaiting_payment` only until payments exist. | DATABASE §4.9, §4.11, §7.2; PRD FR-JOB-01/03 |
| 2026-11-13 | Services hardening: revoke default grants, `set_service_status` as `SECURITY DEFINER`, publish limit 20 (BR-15) instead of Copilot's 10 | DATABASE §14 |
| 2026-11-13 | Q6: seed Tarakan universities, starting with STMIK PPKIA Tarakanita Rahmawati and Universitas Borneo Tarakan, without email domains (document method) until confirmed. Reference data moved into a data migration. Category names in Bahasa Indonesia. | PRD §10.2; DATABASE §4.3, §13, §14 |
| 2026-11-13 | Payments: Snap `enabled_payments` limited to QRIS, GoPay, ShopeePay and bank VAs (product requirement; DANA left out because its status lookup needs the transaction ID). Server secrets validated lazily (app builds without them). One unpaid order per client per service (BR-12). `deliver_order` and `complete_order` pulled forward from Phase 7 for completion confirmation. Stored notification payloads omit `signature_key`. | PRD BR-12; ARCHITECTURE §4.1, §9; DATABASE §4.17, §7.2; API_CONTRACT §4, §6 |
| 2026-11-13 | Copilot's `080800_portfolio_moderation.sql` renamed to `080900` (version collision; it had never been applied). | DATABASE §14 |
| 2026-11-14 | Phase 7/8 RPC names as implemented: `send_order_message` (an RPC instead of a direct insert), `request_order_revision` (reason 10–2.000 characters), `open_order_dispute`, `create_order_review`. | DATABASE §7.2, §14; API_CONTRACT §4.0 |
| 2026-11-14 | QA review: delivered order files are immutable (no delete policy); admins may post order messages; rating views added and `service_listings` gains `rating_avg`/`rating_count`; service cover and portfolio image paths are checked in the database; framing-protection and basic security headers ship now (the full CSP stays in Phase 10); order-file downloads use a 60-second download URL created on click with the viewer's session. | DATABASE §4.19, §7.2, §11.2, §14; API_CONTRACT §4.0, §5.1; ARCHITECTURE §12.1 |
| 2026-11-14 | Deployment and demo preparation is the next milestone, ahead of Phase 9 (product owner). Until Phase 9 ships, disputes, refunds and payouts cannot be closed out by an admin. | IMPLEMENTATION_PLAN §0, §0.2, Phase 10 |
| 2026-11-14 | Reversed the same day by the product owner: fix everything, including Phase 9, before deploying. Deployment uses the existing `projekin-dev` Supabase project (no separate prod project for this college assignment). Demo accounts and data were created on dev with the product owner's approval. | IMPLEMENTATION_PLAN §0, §0.2, Phase 9, Phase 10 |
| 2026-11-14 | Student email domains are managed by admins in the app (`/admin/universities`) instead of reviewed data migrations (product owner; PRD A3/Q6a superseded for domains). STMIK PPKIA: `student.ppkia.ac.id`. | IMPLEMENTATION_PLAN §0; DATABASE §14 |
