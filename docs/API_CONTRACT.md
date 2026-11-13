# Projekin — API Contract

| | |
|---|---|
| Status | Draft for approval |
| Version | 0.2 (2026-11-13), with product-owner decisions on Q1, Q3, Q6 and the database environment |
| Related | [DATABASE.md](DATABASE.md) (RPC names, error SQLSTATEs), [ARCHITECTURE.md](ARCHITECTURE.md), [PRD.md](PRD.md) |

Projekin has **no public REST API**. Its contract surface is:

1. **Server Actions** (`src/server/actions/*.ts`): every user mutation (§4).
2. **Route Handlers**: only for external callers (Midtrans, Vercel Cron, Supabase email links) (§3).
3. **Read contracts**: what each page loads through the user-scoped Supabase client under RLS, and the URL search params it accepts (§5).
4. **Outbound Midtrans calls** (§6).

The PostgREST/RPC surface is reachable directly by any signed-in user. Its security contract is defined in [DATABASE §7, §9](DATABASE.md#7-rpc-functions-public-schema) and does not rely on this layer.

---

## 1. Conventions

### 1.1 Auth levels

| Level | Meaning | Check |
|---|---|---|
| `public` | No session needed | — |
| `user` | Signed in (email confirmed) | `requireUser()` → `UNAUTHENTICATED` |
| `onboarded` | `user` + `profiles.onboarded_at` set | `requireOnboarded()` → `FORBIDDEN` (`NOT_ONBOARDED`) |
| `freelancer` | `onboarded` + eligible (BR-01) | Enforced in RPC/RLS → `FORBIDDEN` (`FREELANCER_NOT_ELIGIBLE`) |
| `admin` | Row in `admin_users` | `requireAdmin()` → `FORBIDDEN` |

Party-specific checks (order client, order freelancer, job owner, proposal owner) are done inside the RPC.

### 1.2 Result envelope

```ts
// src/server/actions/types.ts
export type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        code: ErrorCode;
        reason?: string;                      // stable machine reason, e.g. 'MAX_PAYMENT_ATTEMPTS'
        message: string;                      // safe, user-facing text
        fieldErrors?: Record<string, string[]>; // only for VALIDATION_ERROR
        correlationId?: string;               // only for INTERNAL_ERROR
      };
    };
```

Actions **never throw** for expected failures. `redirect()` is used only after a successful sign-in, sign-out or onboarding.

### 1.3 Error codes

| Code | When | Route-handler HTTP |
|---|---|---|
| `VALIDATION_ERROR` | Zod failure or `PJ422` | 400 |
| `UNAUTHENTICATED` | No session or `PJ401` | 401 |
| `FORBIDDEN` | Wrong role, not onboarded, not eligible, or `PJ403` | 403 |
| `NOT_FOUND` | Missing or invisible row, or `PJ404` | 404 |
| `INVALID_STATE` | Status transition not allowed (`PJ409` with a state reason) | 409 |
| `CONFLICT` | Duplicate (`PJ409` duplicate reasons, or `23505`) | 409 |
| `LIMIT_REACHED` | BR-11..BR-15 limits (`PJ409` with a `MAX_*` reason) | 429 |
| `PAYMENT_PROVIDER_ERROR` | Midtrans unreachable or returned an error | 502 |
| `INTERNAL_ERROR` | Anything else (logged with a correlation ID) | 500 |

### 1.4 Validation rules

- All inputs are parsed with Zod `z.object({...}).strict()`. Unknown keys are rejected.
- Strings are `.trim()`-ed before length checks. Empty optional strings become `null`.
- Money is `z.number().int()` in rupiah. IDs are `z.uuid()`.
- Actions receiving `FormData` convert it to an object first. The same schema is used client-side (react-hook-form) and server-side.

### 1.5 Direct writes and RLS

For direct table writes (§4.2, §4.4–§4.6, `sendOrderMessage`), an UPDATE or DELETE that RLS filters out affects **zero rows** and raises no error. Actions therefore:
1. Read the row first with the user client (missing → `NOT_FOUND`), and check the business precondition so they can return a specific reason (e.g. `JOB_NOT_EDITABLE`, `NOT_DRAFT`).
2. Write with `.select()` and treat zero returned rows as `INVALID_STATE` (the state changed concurrently).

An INSERT rejected by RLS raises `42501` → `FORBIDDEN`.

### 1.6 Revalidation

Each action lists the paths it revalidates. `revalidatePath` is called only on success.

---

## 2. Shared schemas

```ts
// src/lib/validation/common.ts
import { z } from 'zod';

export const uuid = z.uuid();
export const idr = z.number().int().min(10_000).max(50_000_000);           // BR-07
export const deliveryDays = z.number().int().min(1).max(60);               // BR-08
export const revisions = z.number().int().min(0).max(5);                   // BR-08
export const text = (min: number, max: number) => z.string().trim().min(min).max(max);
export const optionalText = (max: number) =>
  z.string().trim().max(max).transform((v) => (v === '' ? null : v)).nullable().optional();
export const username = z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,30}$/); // BR-28
export const httpsUrl = z.url().max(500).refine((u) => u.startsWith('https://'));
export const storagePath = z.string().max(300).regex(/^[a-zA-Z0-9/_.-]+$/).refine((p) => !p.includes('..'));
export const rating = z.number().int().min(1).max(5);
```

Domain schemas (in `src/lib/validation/<domain>.ts`) are named after the action input, e.g. `createServiceInput`. They are shown inline below.

### 2.1 Upload path conventions (browser → Storage)

| Bucket | Path built by the client | Checked by |
|---|---|---|
| `avatars`, `portfolio`, `service-media`, `student-documents` | `${uid}/${crypto.randomUUID()}.${ext}` | Storage policy `folder(1) = uid` |
| `order-files` | `${orderId}/${uid}/${crypto.randomUUID()}-${sanitize(name)}` | `private.can_upload_order_file` |

`sanitize(name)`: lower-case, replace characters outside `[a-z0-9._-]` with `-`, truncate to 80 characters. `ext` comes from an allow-list keyed by MIME type, never from the user's filename. Server Actions re-check that every path starts with the expected prefix before passing it to the database.

---

## 3. Route handlers

### 3.1 `GET /auth/confirm`

| | |
|---|---|
| Caller | User clicking a Supabase email link |
| Query | `token_hash: string`, `type: 'email' \| 'recovery' \| 'email_change'`, `next?: string` |
| Behaviour | `supabase.auth.verifyOtp({ type, token_hash })`. On success, redirect to `next` if it is safe (`/^\/(?!\/)/`), otherwise to `/onboarding` (`email`), `/reset-password` (`recovery`) or `/dashboard/settings/profile` (`email_change`). On failure, redirect to `/login?error=link_invalid`. |

### 3.2 `POST /api/payments/midtrans/notification`

| | |
|---|---|
| Caller | Midtrans (server to server) |
| Auth | `signature_key` in body = `sha512(order_id + status_code + gross_amount + MIDTRANS_SERVER_KEY)` (hex, timing-safe compare) |
| Request body (fields used) | `order_id`, `status_code`, `gross_amount` (string, e.g. `"150000.00"`), `signature_key`, `transaction_status`, `fraud_status?`, `transaction_id`, `payment_type`. All other fields are stored raw. |
| Processing | [ARCHITECTURE §9.3](ARCHITECTURE.md#93-notification-webhook-flow). Values passed to `apply_payment_status` come from the **Status API**, not the notification body. |
| Responses | `200 {"ok":true,"result":"<processing_result>"}`: processed, or deliberately ignored (`unknown_payment`, `amount_mismatch`, `no_change`, `ignored_regression`). `400`: malformed JSON or missing required fields. `401`: invalid signature. `500`: transient failure (Midtrans will retry). |
| Runtime | Node.js (`export const runtime = 'nodejs'`), `dynamic = 'force-dynamic'`. Body ≤ 64 KB. |

### 3.3 `GET /api/cron/reconcile-payments`

| | |
|---|---|
| Caller | Vercel Cron |
| Auth | `Authorization: Bearer ${CRON_SECRET}` (timing-safe). Otherwise `401`. |
| Behaviour | [ARCHITECTURE §9.5](ARCHITECTURE.md#95-reconciliation) |
| Response | `200 {"ok":true,"checked":n,"applied":n,"failedStale":n,"errors":n}` |

---

## 4. Server actions

Format: **Action** · file · auth · input → output · backing call · notable errors · revalidates.

### 4.0 Implementation status: identity actions (2026-11-13)

The identity actions are implemented in `src/server/actions/*.ts`. Exported names carry an `Action` suffix. Form actions use the React `useActionState` signature `(prev: FormState, formData: FormData) => Promise<FormState>`, where `FormState<T> = ActionResult<T> | null`. On failure the result also carries `values` (submitted values minus passwords) so forms can be refilled.

| Contract name (below) | Export | Notes |
|---|---|---|
| `signUp` | `registerAction` (`auth.ts`) | Also takes `fullName` (stored in user metadata, then copied to the profile by the sign-up trigger). Redirects to `/onboarding` if the project returns a session (email confirmation disabled). |
| `signIn` / `signOut` | `loginAction` / `logoutAction` | |
| `requestPasswordReset` / `updatePassword` | `forgotPasswordAction` / `resetPasswordAction` | `updatePassword` requires `confirmPassword` |
| `completeOnboarding` | `completeOnboardingAction` (`profile.ts`) | |
| `updateProfile` | `updateProfileAction` | `avatarPath` is **not** part of this action. See the avatar actions below. |
| — | `updateAvatarAction({ path })`, `removeAvatarAction()` | The path must match `{uid}/{uuid}.{jpg,png,webp}`. The previous object is removed (best effort). |
| `submitStudentVerification` / `reviewStudentVerification` | `submitVerificationAction` / `reviewVerificationAction` (`verification.ts`) | `validUntil` (date) is sent to the RPC as end of day Asia/Jakarta |
| `getStudentDocumentUrl` | — (not an action) | The admin detail page creates the 60 s signed URL server-side with the admin's own session. |
| `updateFreelancerProfile` | `updateFreelancerProfileAction` (`verification.ts`) | `skills` is submitted as a comma-separated string |
| portfolio actions | not yet implemented | Next phase |

Server-side guards live in `src/server/auth.ts` (`guardUser`, `guardOnboarded`, `guardAdmin`, `guardVerifiedFreelancer`). The last one is used by service and proposal actions when those phases arrive.

### 4.1 Auth (`actions/auth.ts`)

| Action | Auth | Input | Output | Backing | Errors |
|---|---|---|---|---|---|
| `signUp` | public | `{ email: z.email(), password: z.string().min(8).max(72) }` | `{ emailSent: true }` | `auth.signUp` with `emailRedirectTo = SITE_URL/auth/confirm` | `VALIDATION_ERROR`. Duplicate emails return the same success response (no account enumeration). |
| `signIn` | public | `{ email, password, next?: string }` | redirect to safe `next` or `/dashboard` | `auth.signInWithPassword` | `UNAUTHENTICATED` (generic "invalid credentials"), `FORBIDDEN`/`EMAIL_NOT_CONFIRMED` |
| `signOut` | user | `{}` | redirect to `/` | `auth.signOut` | — |
| `requestPasswordReset` | public | `{ email }` | `{ emailSent: true }` (always) | `auth.resetPasswordForEmail` (redirect to `/auth/confirm?type=recovery`) | — |
| `updatePassword` | user (recovery session) | `{ password: z.string().min(8).max(72) }` | `{ updated: true }` | `auth.updateUser` | `VALIDATION_ERROR` |

### 4.2 Profile (`actions/profile.ts`)

| Action | Auth | Input | Output | Backing | Errors · Revalidates |
|---|---|---|---|---|---|
| `completeOnboarding` | user | `{ fullName: text(1,100), username, acceptTerms: z.literal(true) }` | redirect to `/dashboard` | RPC `complete_onboarding` | `CONFLICT`/`USERNAME_TAKEN` · `/dashboard` |
| `updateProfile` | onboarded | `{ fullName: text(1,100), username, bio: optionalText(1000), location: optionalText(100), avatarPath: storagePath.nullable() }` | `{ profile }` | `update profiles` (granted columns) where `id = uid` | `CONFLICT`/`USERNAME_TAKEN`; `avatarPath` must start with `${uid}/` · `/u/[username]`, `/dashboard/settings/profile` |

### 4.3 Student verification (`actions/verification.ts`)

| Action | Auth | Input | Output | Backing | Errors · Revalidates |
|---|---|---|---|---|---|
| `submitStudentVerification` | onboarded | `z.discriminatedUnion('method', [ { method: 'email_domain', universityId }, { method: 'document', universityId, studentNumber: text(1,50), documentPath: storagePath } ])` | `{ verification: { id, status, validUntil } }` | RPC `submit_student_verification` | `VALIDATION_ERROR`/`EMAIL_DOMAIN_NOT_ELIGIBLE`, `CONFLICT`/`VERIFICATION_PENDING`, `INVALID_STATE`/`ALREADY_VERIFIED` · `/dashboard/verification`, `/dashboard` |
| `reviewStudentVerification` | admin | `z.discriminatedUnion('decision', [ { decision: 'approve', verificationId, validUntil: z.iso.datetime() }, { decision: 'reject', verificationId, reason: text(1,500) } ])` | `{ verification }` | RPC `review_student_verification` | `INVALID_STATE`/`NOT_PENDING`, `VALIDATION_ERROR`/`VALID_UNTIL_OUT_OF_RANGE` · `/admin/verifications` |
| `getStudentDocumentUrl` | user (owner) or admin | `{ verificationId }` | `{ url, expiresIn: 60 }` | Read row (RLS) → `storage.from('student-documents').createSignedUrl(path, 60)` with the user client | `NOT_FOUND` |

### 4.4 Freelancer profile and portfolio (`actions/freelancer.ts`)

| Action | Auth | Input | Output | Backing | Revalidates |
|---|---|---|---|---|---|
| `updateFreelancerProfile` | onboarded (row must exist) | `{ headline: optionalText(120), skills: z.array(text(1,30)).max(15), major: optionalText(100) }` | `{ freelancerProfile }` | `update freelancer_profiles` where `user_id = uid` (`NOT_FOUND` if not a freelancer) | `/u/[username]`, `/dashboard/freelancer` |
| `createPortfolioItem` | onboarded (freelancer row) | `{ title: text(1,100), description: optionalText(2000), externalUrl: httpsUrl.nullable(), imagePaths: z.array(storagePath).max(5), sortOrder: z.number().int().min(0).default(0) }` | `{ item }` | `insert portfolio_items` (`freelancer_id = uid`); paths must start with `${uid}/` | `/u/[username]`, `/dashboard/portfolio` |
| `updatePortfolioItem` | owner | `{ id } & partial(create input)` | `{ item }` | `update portfolio_items` | same |
| `deletePortfolioItem` | owner | `{ id }` | `{ deleted: true }` | `delete portfolio_items` (storage objects removed best effort) | same |

### 4.5 Services (`actions/services.ts`)

Shared input `serviceFields = { categoryId: uuid, title: text(10,100), description: text(50,5000), price: idr, deliveryDays, revisionsIncluded: revisions, requirementsPrompt: optionalText(1000), coverImagePath: storagePath.nullable() }`.

| Action | Auth | Input | Output | Backing | Errors · Revalidates |
|---|---|---|---|---|---|
| `createService` | freelancer | `serviceFields` | `{ serviceId }` (status `draft`) | `insert services` (RLS requires eligibility) | `FORBIDDEN`/`FREELANCER_NOT_ELIGIBLE` · `/dashboard/services` |
| `updateService` | owner | `{ id } & serviceFields` | `{ service }` | `update services` (RLS: not archived) | `NOT_FOUND`, `INVALID_STATE`/`SERVICE_ARCHIVED` · `/dashboard/services`, `/services`, `/services/[id]` |
| `setServiceStatus` | owner | `{ id, status: z.enum(['published','paused','archived']) }` | `{ service }` | RPC `set_service_status` | `INVALID_STATE`, `FORBIDDEN`/`FREELANCER_NOT_ELIGIBLE`, `VALIDATION_ERROR`/`COVER_IMAGE_REQUIRED`, `LIMIT_REACHED`/`MAX_PUBLISHED_SERVICES`, `FORBIDDEN`/`SERVICE_BLOCKED` · same + `/u/[username]` |
| `deleteService` | owner | `{ id }` | `{ deleted: true }` | `delete services` (draft only; FK blocks if ordered) | `INVALID_STATE`/`NOT_DRAFT`, `CONFLICT`/`SERVICE_HAS_ORDERS` |

### 4.6 Jobs (`actions/jobs.ts`)

Shared `jobFields = { categoryId, title: text(10,100), description: text(50,5000), budgetMin: idr, budgetMax: idr, deadline: z.iso.date().nullable() }`, with refinements `budgetMin <= budgetMax` and `deadline >= today (Asia/Jakarta)`.

| Action | Auth | Input | Output | Backing | Errors · Revalidates |
|---|---|---|---|---|---|
| `createJob` | onboarded | `jobFields` | `{ jobId }` | `insert jobs` (RLS: limit BR-13) | `LIMIT_REACHED`/`MAX_ACTIVE_JOBS` (RLS denial is mapped by checking `active_job_count` first in the action for a clear message) · `/jobs`, `/dashboard/jobs` |
| `updateJob` | owner | `{ id } & jobFields` | `{ job }` | `update jobs` (RLS: open, no proposals) | `INVALID_STATE`/`JOB_NOT_EDITABLE` · `/jobs`, `/jobs/[id]`, `/dashboard/jobs/[id]` |
| `closeJob` | owner or admin | `{ id, reason: optionalText(500) }` | `{ job }` | RPC `close_job` | `INVALID_STATE`/`JOB_NOT_OPEN` · same |

### 4.7 Proposals (`actions/proposals.ts`)

| Action | Auth | Input | Output | Backing | Errors · Revalidates |
|---|---|---|---|---|---|
| `submitProposal` | freelancer | `{ jobId, coverLetter: text(50,3000), price: idr, deliveryDays, revisionsIncluded: revisions }` | `{ proposalId }` | RPC `submit_proposal` | `FORBIDDEN`/`FREELANCER_NOT_ELIGIBLE`, `FORBIDDEN`/`OWN_JOB`, `INVALID_STATE`/`JOB_NOT_OPEN`, `CONFLICT`/`ALREADY_PROPOSED`, `LIMIT_REACHED`/`MAX_PROPOSALS_PER_DAY` · `/jobs/[id]`, `/dashboard/proposals` |
| `withdrawProposal` | proposal owner | `{ proposalId }` | `{ proposal }` | RPC `withdraw_proposal` | `INVALID_STATE`/`PROPOSAL_NOT_SUBMITTED` · `/dashboard/proposals` |
| `rejectProposal` | job owner | `{ proposalId, reason: optionalText(500) }` | `{ proposal }` | RPC `reject_proposal` | `INVALID_STATE` · `/dashboard/jobs/[id]` |
| `acceptProposal` | job owner | `{ proposalId }` | `{ orderId }` (client is then sent to `/dashboard/orders/{orderId}` to pay) | RPC `accept_proposal` | `INVALID_STATE`/`JOB_NOT_OPEN`, `INVALID_STATE`/`PROPOSAL_NOT_SUBMITTED`, `FORBIDDEN`/`FREELANCER_NOT_ELIGIBLE`, `LIMIT_REACHED`/`MAX_AWAITING_PAYMENT_ORDERS`, `CONFLICT` (unique live order per job) · `/dashboard/jobs/[id]`, `/jobs/[id]`, `/dashboard/orders` |

### 4.8 Orders (`actions/orders.ts`)

| Action | Auth | Input | Output | Backing | Errors · Revalidates |
|---|---|---|---|---|---|
| `createServiceOrder` | onboarded | `{ serviceId, requirements: text(10,5000) }` | `{ orderId }` | RPC `create_service_order` | `FORBIDDEN`/`OWN_SERVICE`, `INVALID_STATE`/`SERVICE_NOT_AVAILABLE`, `LIMIT_REACHED`/`MAX_AWAITING_PAYMENT_ORDERS` · `/dashboard/orders` |
| `cancelOrder` | client, freelancer or admin (`awaiting_payment`); freelancer (`in_progress`, no deliveries), per BR-20 | `{ orderId, reason: text(1,500) }` | `{ status: 'cancelled' }` | RPC `cancel_order` → for each returned `midtrans_order_id`, Midtrans `POST /v2/{id}/expire` (best effort; failures logged, not surfaced) | `INVALID_STATE`/`ORDER_NOT_CANCELLABLE`, `FORBIDDEN` · `/dashboard/orders`, `/dashboard/orders/[id]`, job pages |
| `deliverOrder` | order freelancer | `{ orderId, message: text(1,5000), attachmentPaths: z.array(storagePath).max(10) }` | `{ deliveryId }` | RPC `deliver_order` | `INVALID_STATE`/`ORDER_NOT_IN_PROGRESS`, `VALIDATION_ERROR`/`ATTACHMENT_NOT_FOUND` · `/dashboard/orders/[id]` |
| `requestRevision` | order client | `{ orderId, message: text(1,5000) }` | `{ order }` | RPC `request_revision` | `INVALID_STATE`/`ORDER_NOT_DELIVERED`, `INVALID_STATE`/`NO_REVISIONS_LEFT` |
| `completeOrder` | order client | `{ orderId }` | `{ order }` | RPC `complete_order` | `INVALID_STATE`/`ORDER_NOT_DELIVERED` · + `/dashboard/earnings` |
| `openDispute` | participant | `{ orderId, reason: text(20,2000) }` | `{ disputeId }` | RPC `open_dispute` | `INVALID_STATE`/`ORDER_NOT_DISPUTABLE`, `CONFLICT`/`DISPUTE_EXISTS` |
| `sendOrderMessage` | participant or admin | `{ orderId, body: text(1,5000) }` | `{ messageId }` | `insert order_messages` (RLS: status per BR-29) | `INVALID_STATE`/`MESSAGES_CLOSED` (the action pre-checks status for a clear error) |
| `getOrderFileUrl` | participant or admin | `{ orderId, path: storagePath }` | `{ url, expiresIn: 60 }` | Path must start with `${orderId}/` → `createSignedUrl(path, 60, { download: true })` with the user client | `NOT_FOUND` |

### 4.9 Payments (`actions/payments.ts`)

| Action | Auth | Input | Output | Backing | Errors |
|---|---|---|---|---|---|
| `startPayment` | order client | `{ orderId }` | `{ snapToken: string; redirectUrl: string; midtransOrderId: string; expiresAt: string }` | RPC `create_payment_attempt` (user client). If a new attempt was created: Midtrans Snap create (§6.1) → RPC `attach_snap_token`, or `fail_payment_attempt` on error (admin client). | `INVALID_STATE`/`ORDER_NOT_AWAITING_PAYMENT`, `INVALID_STATE`/`PAYMENT_WINDOW_CLOSING`, `CONFLICT`/`PAYMENT_IN_PROGRESS`, `LIMIT_REACHED`/`MAX_PAYMENT_ATTEMPTS`, `PAYMENT_PROVIDER_ERROR` |
| `syncPaymentStatus` | order client | `{ orderId }` | `{ orderStatus: OrderStatus; paymentStatus: PaymentStatus \| null }` | Authorize through a user-client read of the order → pick the latest live attempt (else the most recent) → Status API (§6.2) → RPC `apply_payment_status` (admin client). Idempotent. The UI debounces calls (at most one in flight). | `NOT_FOUND`, `PAYMENT_PROVIDER_ERROR` (UI shows "still checking") |

### 4.10 Reviews (`actions/reviews.ts`)

| Action | Auth | Input | Output | Backing | Errors · Revalidates |
|---|---|---|---|---|---|
| `submitReview` | participant | `{ orderId, rating, comment: optionalText(2000) }` | `{ reviewId }` | RPC `submit_review` | `INVALID_STATE`/`ORDER_NOT_COMPLETED`, `INVALID_STATE`/`REVIEW_WINDOW_CLOSED`, `CONFLICT`/`ALREADY_REVIEWED` · `/dashboard/orders/[id]`, `/u/[username]`, `/services/[id]` |

### 4.11 Admin (`actions/admin.ts`)

All require `admin`. Every action is also guarded inside its RPC by `private.is_admin()`.

| Action | Input | Backing | Revalidates |
|---|---|---|---|
| `setFreelancerStatus` | `{ userId, status: z.enum(['active','suspended']) }` | RPC `set_freelancer_status` | `/u/[username]`, `/services` |
| `setServiceBlock` | `z.discriminatedUnion('blocked', [{ blocked: true, serviceId, reason: text(1,500) }, { blocked: false, serviceId }])` | RPC `admin_set_service_block` | `/services`, `/services/[id]` |
| `resolveDispute` | `{ disputeId, resolution: z.enum(['release_to_freelancer','refund_client']), adminNote: text(1,2000) }` | RPC `resolve_dispute` | `/admin/disputes`, `/dashboard/orders/[id]` |
| `markRefundCompleted` | `{ paymentId, reference: text(1,200) }` | RPC `mark_refund_completed` | `/admin/refunds` |
| `markPayoutPaid` | `{ orderId, reference: text(1,200) }` | RPC `mark_payout_paid` | `/admin/payouts`, `/dashboard/earnings` |

`closeJob` (§4.6) and `reviewStudentVerification` / `getStudentDocumentUrl` (§4.3) are also used from the admin console.

---

## 5. Read contracts (pages and queries)

All reads use the user-scoped server client (anon role when signed out). "Data" lists what the page selects. RLS decides which rows come back.

### 5.1 Search params

```ts
// src/lib/validation/search.ts
export const servicesSearch = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().regex(/^[a-z0-9-]{2,50}$/).optional(),   // categories.slug
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().max(50_000_000).optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc', 'rating']).default('newest'),
  page: z.coerce.number().int().min(1).max(500).default(1),
});

export const jobsSearch = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().regex(/^[a-z0-9-]{2,50}$/).optional(),
  minBudget: z.coerce.number().int().min(0).optional(),   // matches jobs with budget_max >= minBudget
  maxBudget: z.coerce.number().int().max(50_000_000).optional(), // matches jobs with budget_min <= maxBudget
  sort: z.enum(['newest', 'budget_desc']).default('newest'),
  page: z.coerce.number().int().min(1).max(500).default(1),
});

export const ordersFilter = z.object({
  role: z.enum(['client', 'freelancer']).default('client'),
  status: z.enum(['awaiting_payment','in_progress','delivered','completed','cancelled','disputed']).optional(),
  page: z.coerce.number().int().min(1).default(1),
});
```

Invalid params fall back to their defaults (`safeParse`). They never produce an error page. Page size is 20. Keyword search uses `.textSearch('search', q, { type: 'websearch', config: 'simple' })`.

### 5.2 Page data

| Route | Auth | Data |
|---|---|---|
| `/` | public | Latest 8 published services, latest 8 open jobs, categories |
| `/login`, `/register`, `/forgot-password` | public (signed-in users are redirected to `/dashboard`) | — |
| `/reset-password` | user (recovery session from `/auth/confirm`) | — |
| `/terms`, `/privacy` | public | Static content (PRD Q5) |
| `/services` | public | `service_listings` view (RLS of `services` applies). `servicesSearch`. Total count (`count: 'exact'`). |
| `/services/[id]` | public | Service + freelancer card + `freelancer_rating_stats` + `service_rating_stats` + latest 10 reviews where `service_id = id` (with reviewer profile). 404 if not visible. |
| `/services/[id]/order` | onboarded | Service (must be orderable) + `requirements_prompt`. Form → `createServiceOrder`. |
| `/jobs` | public | `jobs` (status `open`) + client profile + `client_rating_stats`. `jobsSearch`. |
| `/jobs/[id]` | public | Job + client card. If the viewer is signed in: own proposal (if any) and eligibility (`freelancer_profiles` own row) to show the proposal form, or the reason it is unavailable. |
| `/u/[username]` | public | Profile, freelancer profile + university, portfolio items, published services, reviews received (as freelancer and as client) + both stats views |
| `/onboarding` | user | Own profile |
| `/dashboard` | onboarded | Counts: purchases and sales by status, "needs action" list (awaiting payment, delivered-awaiting-review, in-progress as freelancer), verification status |
| `/dashboard/settings/profile` | onboarded | Own profile |
| `/dashboard/verification` | onboarded | Own `student_verifications` (latest first), own `freelancer_profiles`, active `universities`, whether the account email domain matches each university (computed server-side from `auth.getUser()` email; domains are not secret) |
| `/dashboard/freelancer`, `/dashboard/portfolio` | onboarded + freelancer row | Own freelancer profile, own portfolio items |
| `/dashboard/services` (+ `/new`, `/[id]/edit`) | onboarded | Own services (all statuses), categories |
| `/dashboard/jobs` (+ `/new`, `/[id]/edit`) | onboarded | Own jobs with proposal counts (own jobs → RLS lets the owner read all proposals) |
| `/dashboard/jobs/[id]` | job owner | Job + proposals + each freelancer's profile, university and `freelancer_rating_stats` + linked order (if any) |
| `/dashboard/proposals` | onboarded | Own proposals + job title/status |
| `/dashboard/orders` | onboarded | `ordersFilter`. Orders where `client_id = uid` (role=client) or `freelancer_id = uid` (role=freelancer) + counterpart profile |
| `/dashboard/orders/[id]` | participant or admin | Order + counterpart profile + `order_events` + `order_messages` + `order_deliveries` + `disputes` + own `reviews` on the order + `payments` (client/admin only, via RLS). The page handles `?payment=finish` by calling `syncPaymentStatus`. |
| `/dashboard/earnings` | onboarded + freelancer row | Own orders where `status='completed'`: amount, fee, earnings, payout status, totals |
| `/admin/verifications` (+ `/[id]`) | admin | Pending verifications (oldest first) + profile + university; signed document URL on the detail page |
| `/admin/disputes` (+ `/[id]`) | admin | Open disputes + order + full thread, deliveries and events |
| `/admin/refunds` | admin | `payments` where `refund_status='pending'` + order |
| `/admin/payouts` | admin | `orders` where `payout_status='pending'` + freelancer profile (bank details are exchanged off-platform in the MVP) |
| `/admin/moderation` | admin | Lookup by username, service ID or job ID → actions `setFreelancerStatus`, `setServiceBlock`, `closeJob` |

---

## 6. Midtrans integration contract (outbound)

Auth for all calls: `Authorization: Basic base64(MIDTRANS_SERVER_KEY + ':')`, `Accept: application/json`, `Content-Type: application/json`. Timeout 10 s, no automatic retries (the caller decides).

### 6.1 Create Snap transaction

`POST https://app.sandbox.midtrans.com/snap/v1/transactions`

Request: see [ARCHITECTURE §9.2](ARCHITECTURE.md#92-checkout-flow). Invariants:
- `transaction_details.order_id = payments.midtrans_order_id`
- `transaction_details.gross_amount = payments.gross_amount = sum(item_details.price × quantity)`
- `expiry` ends at or before `orders.payment_due_at`

Success `201`: `{ "token": string, "redirect_url": string }`. Anything else → `fail_payment_attempt(reason = 'snap_<status>')` and `PAYMENT_PROVIDER_ERROR`.

### 6.2 Get transaction status

`GET https://api.sandbox.midtrans.com/v2/{midtrans_order_id}/status`

The response fields used are `transaction_status`, `fraud_status`, `status_code`, `gross_amount`, `payment_type` and `transaction_id`. `gross_amount` (a string like `"150000.00"`) is parsed to an integer. A non-integer value is treated as `amount_mismatch`.
- `status_code` `404` in the JSON body (transaction not found) → not an error. Nothing is applied.
- HTTP or network error → `PAYMENT_PROVIDER_ERROR` (sync action) or `500` (webhook, so Midtrans retries).

### 6.3 Expire transaction

`POST https://api.sandbox.midtrans.com/v2/{midtrans_order_id}/expire`. Used only after `cancel_order`. Best effort. Any result is logged and not surfaced.

---

## 7. Postgres → ActionResult mapping

`src/server/errors.ts`:

| Supabase/PostgREST error | ActionResult code | `reason` |
|---|---|---|
| `code = 'PJ401'` | `UNAUTHENTICATED` | message |
| `code = 'PJ403'` | `FORBIDDEN` | message |
| `code = 'PJ404'` | `NOT_FOUND` | message |
| `code = 'PJ409'`, message starts with `MAX_` | `LIMIT_REACHED` | message |
| `code = 'PJ409'`, message in {`ALREADY_PROPOSED`, `ALREADY_REVIEWED`, `DISPUTE_EXISTS`, `VERIFICATION_PENDING`, `USERNAME_TAKEN`, `PAYMENT_IN_PROGRESS`} | `CONFLICT` | message |
| `code = 'PJ409'` (other) | `INVALID_STATE` | message |
| `code = 'PJ422'` | `VALIDATION_ERROR` | message |
| `code = '23505'` (unique) | `CONFLICT` | constraint name → reason (e.g. `profiles_username_key` → `USERNAME_TAKEN`) |
| `code = '23503'` (FK, e.g. deleting an ordered draft) | `CONFLICT` | e.g. `SERVICE_HAS_ORDERS` |
| `code = '23514'` (check) | `VALIDATION_ERROR` | constraint name |
| `code = '42501'` (RLS / privilege) | `FORBIDDEN` | — |
| `PGRST116` (no rows for `.single()`) | `NOT_FOUND` | — |
| anything else | `INTERNAL_ERROR` | — (logged with `correlationId`) |

User-facing `message` strings are in **Bahasa Indonesia** (PRD NFR-11) and are looked up from `reason` in `src/server/error-messages.ts` (for example, `MAX_PAYMENT_ATTEMPTS` → "Batas percobaan pembayaran untuk pesanan ini sudah tercapai."). `fieldErrors` use the shared Indonesian Zod error map. Database messages and `reason` codes are never shown raw.
