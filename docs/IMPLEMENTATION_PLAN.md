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
| Still open | Not started | Payments (Phase 6: Midtrans, `expire_unpaid_orders` cron, `create_service_order`); order fulfilment (Phase 7); reviews (Phase 8); Playwright E2E; translating the landing page to Bahasa Indonesia |

### 0.1 Known issues

- **Firefox on the product owner's machine did not run the page JavaScript** (the "Terima & rekrut" confirmation needs JS; plain form submissions still worked through progressive enhancement). A stock Firefox 159 (Playwright) and Chrome both run the flow correctly. The console warning "The execution of microtasks on this page was reordered…" also appears in the working Firefox and is harmless. Likely a local extension or setting. Not an app bug, but the JS-only disclosure could be swapped for `<details>` so the step also works without JS (optional hardening).
- **Not yet manually verified:** reject, withdraw, close job, edit job, and order cancellation (covered by DB and unit tests only).
- **Hires wait in `awaiting_payment` with no payment flow yet.** The job stays in `hiring` until the client or freelancer cancels the order. The 24-hour auto-expiry (`expire_unpaid_orders` + `pg_cron`) arrives with payments (Phase 6), because without a way to pay it would cancel every hire.
- **Race-condition tests are sequential.** PGlite has a single connection, so "conflicting hires" is tested as double-accept plus the unique-index backstop (`orders_one_live_order_per_job`), not as truly parallel transactions. The row locks (`FOR UPDATE` on accept/close, `FOR SHARE` on submit) are designed for concurrency but only exercised on a real database.
- **CI has not run yet.** It runs once the branch is pushed, including the job that applies all migrations to a real Supabase stack.
- **Database tests use PGlite plus a Supabase shim.** Playwright E2E against a real stack is still missing. Playwright with Chromium and Firefox runs in the dev container once `npx playwright install-deps` has been run (it needs sudo; it was used ad hoc for this diagnosis and is not yet a project dependency).
- **Email links opened on another device** need the token-hash email templates (README step 4).
- **`npm audit`:** 7 moderate advisories in the dev-only ESLint chain (pre-existing). Production dependencies: 0.
- **Lint:** 2 `no-img-element` warnings in Copilot's service pages.
- **Changing the password from settings** does not ask for the current password (consider Supabase "Secure password change").

### 0.2 Phase 4 handoff

**Phase 4 completion:** portfolio CRUD and admin moderation are implemented. Do not start payments in this handoff.

1. **Migration** (new file; never edit applied ones): RPCs `set_freelancer_status` and `admin_set_service_block` (DATABASE §7.2, admin only), plus the `portfolio` bucket and own-folder policies (DATABASE §11). `portfolio_items` already exists with RLS and correct grants (`080600` + `080700`). Patterns to follow: `revoke all` **before** any grant, `SECURITY DEFINER SET search_path = ''`, `PJxxx` codes with `message = 'REASON'`, and an Indonesian message for every reason (`src/server/error-messages.ts`; a unit test enforces this).
2. **Database tests first** with `tests/db/harness.ts` (`makeFreelancer`, `makeAdmin`, `as`, `expectPgError`): anon, stranger, owner and admin for every operation; the 5-image limit; non-admins cannot block or suspend; a blocked service cannot be republished.
3. **Actions and UI:** portfolio CRUD at `/dashboard/portfolio` (uploads via `isOwnObjectPath`), and suspend/reactivate plus block/unblock controls in `/admin`. Bahasa Indonesia copy. Run Prettier on the files you touch.
4. Hosted migration push and E2E remain follow-up work; local lint, typecheck, tests, and build have passed.

**After that (Claude Code recommended): Phase 6, payments** (Midtrans Snap Sandbox, webhook, `create_service_order`, `expire_unpaid_orders`). It is security-critical, and the RPC and state-machine design is already in DATABASE §7–§8.

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

### Phase 7: Order fulfilment (≈ 3 days)

Tasks:
1. RPCs `deliver_order`, `request_revision`, `complete_order`, `open_dispute`, `auto_complete_delivered_orders` + `pg_cron` schedule.
2. Delivery form with uploads to `order-files`. Signed download links (`getOrderFileUrl`).
3. Message thread (`sendOrderMessage`), activity timeline from `order_events`, deadline and overdue display.
4. Freelancer cancellation before the first delivery (UI for the existing `cancel_order` rule). Dispute dialog.

Tests: pgTAP (each transition, including the wrong-actor and wrong-state matrix; revision count; auto-complete; file path validation; message status gating); E2E (J7, J8 up to "disputed", J9).

Exit: orders complete end to end through every path in [DATABASE §8.1](DATABASE.md#81-order) except admin resolution.

### Phase 8: Reviews and ratings (≈ 1.5 days)

Tasks: RPC `submit_review`. Review form on completed orders. Rating display on service cards and detail, profile, and proposal cards. Reviews lists.

Tests: pgTAP (completed only; 14-day window; one per party; `service_id` only for client reviews of service orders); E2E (review after J7).

Exit: ratings appear correctly on all surfaces.

### Phase 9: Admin money operations and earnings (≈ 2 days)

Tasks: RPCs `resolve_dispute`, `mark_refund_completed`, `mark_payout_paid`. `/admin/disputes`, `/admin/refunds`, `/admin/payouts`, `/admin` overview counts. `/dashboard/earnings`.

Tests: pgTAP (admin-only; resolution outcomes; refund and payout transitions; `payout_status` constraint); E2E (J8 resolution, J10).

Exit: every money-affecting state can be closed out by an admin.

### Phase 10: Hardening and launch (≈ 3 days)

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

Run against an environment whose Notification URL is configured. Take test card numbers, simulator URLs and OTPs from the **current Midtrans Sandbox testing documentation** at run time; they are not hard-coded here.

1. Service order, card payment success → order `in_progress` (webhook) without refreshing.
2. Service order, bank transfer VA → pending → pay through the Midtrans simulator → `in_progress`.
3. Close Snap without paying → reopen "Pay" → same token reused.
4. Card denied → attempt `failed` → retry works.
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
