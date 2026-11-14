# Projekin — Product Requirements Document (MVP)

| | |
|---|---|
| Status | Draft for approval |
| Version | 0.2 (2026-11-13), with product-owner decisions on Q1, Q3, Q6 and the database environment |
| Companion docs | [ARCHITECTURE.md](ARCHITECTURE.md), [DATABASE.md](DATABASE.md), [API_CONTRACT.md](API_CONTRACT.md), [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) |

**Source-of-truth rule.** This document owns *scope*, *business rules* and *numbers* (fees, limits, time windows). The other documents reference the rule IDs (`BR-xx`) instead of restating values. If a number changes, change it here first, then in the SQL constants listed in [DATABASE.md §6.4](DATABASE.md#64-business-constants).

---

## 1. Overview

Projekin is a freelance marketplace where **only verified university students can work as freelancers**. Anyone (students or external parties such as businesses, organisations and individuals) can hire them.

Two hiring flows feed **one unified order system**:

1. **Service marketplace.** A freelancer publishes a fixed-price service, and a client orders it.
2. **Job marketplace.** A client posts a job, freelancers submit proposals, and the client accepts one, which creates an order.

Clients pay through **Midtrans Snap (Sandbox)**. Projekin holds the funds until the order is completed and then records a payout to the freelancer.

### 1.1 Problem

- Students have marketable skills but few trusted channels to earn from them.
- Clients who want affordable student talent cannot tell real students from non-students.
- Informal arrangements (chat groups, social media) carry no payment protection for either side.

### 1.2 Goals (MVP)

| ID | Goal |
|---|---|
| G1 | Make sure every freelancer is a currently verified university student. |
| G2 | Let clients hire through either a fixed-price service or a job post with proposals. |
| G3 | Protect both sides: the client pays up front, funds are held, and the freelancer is paid after completion. |
| G4 | Build trust through profiles, portfolios, verified-student badges and reviews. |
| G5 | Run end to end on Midtrans Snap **Sandbox**, with no real money moving. |

### 1.3 Non-goals (MVP)

Real-money production payments, automated payouts, and anything listed in [§4.2](#42-out-of-scope-exclusions).

---

## 2. Users and roles

One account can hold several roles. Roles are **capabilities**, not account types.

| Role | Who | How obtained |
|---|---|---|
| **Visitor** | Anyone not signed in | — |
| **Client** | Every signed-in user | Default for every account |
| **Freelancer** | Signed-in user with an active student verification | Approved student verification ([BR-01](#5-business-rules)) |
| **Admin** | Projekin staff | Inserted into `admin_users` by SQL or service role only. No UI to self-assign. |

Personas:

- **Rina, design student (freelancer + client).** Sells logo design services. Sometimes hires another student for copywriting.
- **Budi, small-business owner (external client).** Needs a landing page and posts a job to compare proposals.
- **Sari, operations admin.** Reviews student ID documents, resolves disputes, records refunds and payouts.

---

## 3. Glossary

| Term | Meaning |
|---|---|
| Service | A fixed-price offering published by a freelancer (title, description, price, delivery days, included revisions). |
| Job | A request posted by a client, with a budget range and optional deadline. |
| Proposal | A freelancer's offer on a job (cover letter, price, delivery days, included revisions). |
| Order | The single contract object for both flows. Holds snapshot terms, money amounts and lifecycle status. |
| Payment attempt | One Midtrans Snap transaction for an order. An order may have several attempts (for example, retrying after an expired attempt). |
| Delivery | A freelancer's submission of work on an order (message plus files). |
| Revision | A client's request to change a delivery. Uses up one of the order's included revisions. |
| Dispute | Escalation of a paid order to an admin, who either releases funds to the freelancer or refunds the client. |
| Payout | Transfer of the freelancer's earnings, made manually off-platform in the MVP and recorded by an admin. |
| Verified student | A user whose student verification is approved and not expired. |

---

## 4. Scope

### 4.1 In scope (MVP)

1. **Accounts:** email/password sign-up with email confirmation, sign-in, sign-out, password reset.
2. **Profiles:** public profile (username, name, avatar, bio, location) and reviews received.
3. **Student verification:** automatic approval through a university email domain, or manual approval of an uploaded student ID document by an admin. Verification expires.
4. **Freelancer profile and portfolio:** headline, skills, major, verified university badge, and portfolio items with images.
5. **Service marketplace:** create, edit, publish, pause and archive services. Public browsing with search, category filter and price filter.
6. **Job marketplace:** post, edit (while it has no proposals) and close jobs. Public browsing with search and filters.
7. **Proposals and hiring:** submit, withdraw, reject and accept proposals. Accepting creates an order.
8. **Unified orders:** one lifecycle for both flows, covering payment, work, delivery, revisions, completion, cancellation and disputes. Includes an order message thread and an activity timeline.
9. **Payments:** Midtrans Snap Sandbox checkout, webhook processing, status sync on return, reconciliation, and expiry.
10. **Reviews and ratings:** two-way (client ↔ freelancer), 1–5 stars, one per party per completed order.
11. **Admin console (minimal):** verification queue, freelancer suspension, service blocking, job closing, dispute resolution, refund recording, payout recording.
12. **Earnings view:** freelancer sees per-order earnings and payout status.

### 4.2 Out of scope (exclusions)

| Area | Excluded from MVP | MVP substitute |
|---|---|---|
| Payments | Production (real-money) Midtrans, multi-currency, coupons, tips, partial payments, milestones, hourly contracts | Sandbox only, IDR only, single full payment per order |
| Payouts | Automated disbursement (for example, Midtrans Iris), freelancer bank-account management, withdrawal requests | Admin pays off-platform and marks the payout as paid |
| Refunds | Refund API calls, partial refunds, chargeback workflows | Admin refunds in the Midtrans dashboard and records it |
| Services | Package tiers (basic/standard/premium), add-ons, custom offers | One price tier per service |
| Jobs | Multiple hires per job, inviting freelancers, job attachments, pre-hire Q&A | One hire per job. The job description is the brief. |
| Communication | General direct messages, real-time chat, typing indicators | Order-scoped message thread (refresh-based) |
| Notifications | In-app notification centre, transactional email (other than Supabase Auth emails), push | Dashboard status badges. Transactional email is deferred to post-MVP ([Q3, decided](#102-decided)). |
| Identity | Social login, phone OTP, 2FA, automated ID OCR | Email/password and manual document review |
| Discovery | Recommendations, saved/favourites, advanced search engine | Postgres full-text search and filters |
| Trust & safety | User reporting/flagging workflow, automated content moderation | Admin can block services, close jobs and suspend freelancers |
| Account | Self-service account deletion and data export | Admin handles requests manually (see [open questions](#10-assumptions-and-open-questions)) |
| Other | Mobile apps, i18n framework, teams/agencies, freelancer levels, tax invoices, analytics dashboards | — |

---

## 5. Business rules

All money is in **IDR, stored as integer rupiah** (no fractional amounts). All timestamps are stored in UTC and displayed in `Asia/Jakarta`.

| ID | Rule |
|---|---|
| BR-01 | Only a **verified student** can publish services, submit proposals or receive new orders. Verified means: a `freelancer_profiles` row with `status = 'active'` and `verified_until > now()`. |
| BR-02 | **Automatic verification:** if the user's *confirmed* account email ends with a domain listed for an active university, a verification request is approved immediately. **Manual verification:** the user uploads a student ID document (KTM) and an admin approves or rejects it. |
| BR-03 | Verification validity: default **12 months** from approval. Admins may set a shorter date (for example, the expected graduation date). The maximum is 24 months. |
| BR-04 | A user can have at most **1 pending** verification request at a time. |
| BR-05 | When verification expires or the freelancer is suspended, their services are hidden from the marketplace and they cannot publish, propose or receive new orders. **Existing orders continue** to completion. |
| BR-06 | A user can never order their own service, propose on their own job, or be both client and freelancer on the same order. |
| BR-07 | Price limits for services, proposals and job budgets: **Rp 10.000 – Rp 50.000.000** (integer rupiah). |
| BR-08 | Delivery days: **1–60**. Included revisions: **0–5**. |
| BR-09 | **Platform fee: 10%** of the order amount, deducted from the freelancer's earnings. The client pays exactly the listed or proposed price. `platform_fee = floor(amount × 1000 / 10000)` and `freelancer_earnings = amount − platform_fee`. Values are snapshotted on the order. |
| BR-10 | **Payment window: 24 hours** from order creation (`payment_due_at`). Snap transaction expiry is aligned to this deadline. Unpaid orders are cancelled automatically after `payment_due_at` plus a **15-minute** grace period. |
| BR-11 | Max **5 payment attempts** per order. A pending attempt with a still-valid Snap token is reused rather than replaced. |
| BR-12 | Max **5** orders in `awaiting_payment` per client at any time, and at most **one** unpaid order per client for the same service (prevents duplicate orders from double submits). |
| BR-13 | Max **10** jobs with status `open` or `hiring` per client. |
| BR-14 | Max **30** proposals per freelancer per rolling 24 hours. Max **one** proposal per freelancer per job (a withdrawn proposal cannot be resubmitted). |
| BR-15 | Max **20** published services per freelancer. |
| BR-16 | Each job can produce **at most one** paid order. Accepting a proposal moves the job to `hiring`. Payment moves it to `filled`. If the unpaid order is cancelled, the job returns to `open`. |
| BR-17 | Order deadline: `due_at = paid_at + delivery_days`. Revisions do not extend `due_at`. Lateness is shown in the UI and lets the client open a dispute. It has no automatic penalty. |
| BR-18 | **Auto-completion:** a delivered order with no client action for **3 days** becomes `completed`. |
| BR-19 | Revisions: the client may request a revision only while `revisions_used < revisions_allowed`. |
| BR-20 | Cancellation: the **client** and the **freelancer** may each cancel an order that is `awaiting_payment` (admins may too). The **freelancer** may also cancel an `in_progress` order before the first delivery, which triggers a full refund. Every other cancellation after payment goes through a **dispute**. |
| BR-21 | Disputes can be opened by either party while the order is `in_progress` or `delivered`. An admin resolves each dispute with **release to freelancer** (order completed) or **refund client** (order cancelled, full refund). Partial outcomes are excluded. |
| BR-22 | Reviews: allowed only on `completed` orders, within **14 days** of completion. One review per reviewer per order. Rating is an integer 1–5. Comment is optional (≤ 2.000 characters). Reviews cannot be edited or deleted by users. |
| BR-23 | Payouts: when an order completes, `payout_status` becomes `pending`. An admin pays off-platform and marks it `paid` with a reference. |
| BR-24 | Refunds: when a paid order is cancelled, the paid payment's `refund_status` becomes `pending`. An admin refunds through the Midtrans dashboard (or off-platform) and marks it `refunded` with a reference. Late or duplicate payments also become `refund_status = pending` (see [ARCHITECTURE §9.6](ARCHITECTURE.md#96-edge-cases)). |
| BR-25 | Prohibited content: academic dishonesty services (for example, writing theses or assignments for others), illegal goods/services, and contact-detail harvesting. Admins can block services and close jobs that violate this. |
| BR-26 | User-generated text is stored and rendered as **plain text** (line breaks preserved). HTML and Markdown are not rendered. |
| BR-27 | Upload limits: images ≤ **5 MB** (JPEG/PNG/WebP). Student documents ≤ **5 MB** (JPEG/PNG/PDF). Order attachments ≤ **25 MB** each, max **10** per delivery (PDF, ZIP, images, Office documents, plain text). Portfolio items: max **5** images each. Services: 1 cover image. |
| BR-28 | Usernames: 3–30 characters, `[a-z0-9_]`, unique (case-insensitive), changeable. |
| BR-29 | Messages in an order thread are allowed only while the order is `in_progress`, `delivered` or `disputed`. Each message is ≤ 5.000 characters. |
| BR-30 | Job edits (title, description, category, budget, deadline) are allowed only while the job is `open` **and has no proposals**. After that, the client must close the job and repost it. |

---

## 6. Functional requirements

Priority is **M** (must, MVP) unless marked **S** (should, MVP if time allows).

### 6.1 Accounts and profiles

| ID | Requirement |
|---|---|
| FR-AUTH-01 | Users sign up with email and password. Email confirmation is required before any write action. |
| FR-AUTH-02 | Users can sign in, sign out and reset their password through an emailed link. |
| FR-AUTH-03 | A profile row is created automatically on sign-up, with a generated temporary username. |
| FR-AUTH-04 | After first sign-in, onboarding asks for full name and username and requires accepting the Terms of Service (`profiles.terms_accepted_at`). Write actions are blocked until onboarding is complete (`profiles.onboarded_at` set). |
| FR-PROF-01 | Users edit their full name, username, bio (≤ 1.000 characters), location (≤ 100 characters) and avatar. |
| FR-PROF-02 | Public profile at `/u/{username}` shows profile info, the freelancer section (if any), portfolio, published services, and reviews received as freelancer and as client, with their averages. |
| FR-PROF-03 | Email addresses are never shown publicly. |

### 6.2 Student verification and freelancer profile

| ID | Requirement |
|---|---|
| FR-VER-01 | The user picks their university from the active list and submits a verification request. The request uses either the `email_domain` method (when eligible) or the `document` method (upload KTM plus student number). |
| FR-VER-02 | `email_domain` requests are approved instantly if [BR-02](#5-business-rules) holds. Otherwise the system tells the user to use the document method. |
| FR-VER-03 | Admins see a queue of pending document requests, view the document through a short-lived signed URL, and approve (with `valid_until`) or reject (with a reason). |
| FR-VER-04 | Approval creates or updates the user's `freelancer_profiles` row (university, `verified_until`, status `active`). |
| FR-VER-05 | Users see their verification status, rejection reason and expiry date. They can re-apply after rejection or expiry, and submit an early renewal within 30 days of expiry. |
| FR-VER-06 | Freelancers edit their headline (≤ 120 characters), skills (≤ 15 tags, each ≤ 30 characters) and major (≤ 100 characters). |
| FR-PORT-01 | Freelancers create, edit and delete portfolio items (title ≤ 100 characters, description ≤ 2.000 characters, optional external URL (https only), up to 5 images). |
| FR-ADM-01 | Admins can suspend and reactivate a freelancer. |

### 6.3 Service marketplace

| ID | Requirement |
|---|---|
| FR-SVC-01 | Verified students create services: title (10–100 characters), category, description (50–5.000 characters), price, delivery days, included revisions, optional requirements prompt (≤ 1.000 characters), and cover image. New services start as `draft`. |
| FR-SVC-02 | The owner can publish, pause, unpause and archive. Publishing requires BR-01, a cover image, and fewer than BR-15 published services. |
| FR-SVC-03 | The owner can edit content in any non-archived state. Edits never change existing orders (snapshot). |
| FR-SVC-04 | The owner can delete a `draft` service that has never been ordered. |
| FR-SVC-05 | Public listing `/services`: published, unblocked services of eligible freelancers. Supports keyword search, category, price range and sort (newest, price ascending/descending, rating), with pagination (20 per page). |
| FR-SVC-06 | Service detail page shows the service, freelancer card (verified badge, university), rating summary, reviews from that service's orders, and an "Order" button. |
| FR-ADM-02 | Admins can block or unblock a service (blocked services are hidden and cannot be republished by the owner). |

### 6.4 Job marketplace and proposals

| ID | Requirement |
|---|---|
| FR-JOB-01 | Any onboarded client posts a job: title (10–100 characters), category, description (50–5.000 characters), optional requirements (≤ 3.000 characters), budget min/max (BR-07, min ≤ max), optional deadline (a future date). |
| FR-JOB-02 | Public listing `/jobs` shows `open` jobs, with search, category, budget filter, sort (newest, budget) and pagination. |
| FR-JOB-03 | The client edits the job under BR-30, and can close (cancel) it while it is `open`, with an optional reason. Closing rejects all `submitted` proposals. A job in `hiring` is reopened by cancelling the unpaid order. |
| FR-PROP-01 | Verified students submit one proposal per open job (not their own): cover letter (50–3.000 characters), price (BR-07), delivery days, included revisions. Budget is advisory: price outside the range is allowed and flagged in the UI. |
| FR-PROP-02 | The freelancer sees their proposals and statuses, and can withdraw a `submitted` proposal. |
| FR-PROP-03 | The job owner sees all proposals on their job, with the freelancer's profile summary and rating, and can reject a proposal. |
| FR-PROP-04 | The job owner accepts one `submitted` proposal while the job is `open`. The system atomically marks the proposal `accepted`, moves the job to `hiring`, creates an order in `awaiting_payment`, and sends the client to payment. |
| FR-PROP-05 | When that order is paid, the job becomes `filled` and the remaining `submitted` proposals become `rejected`. If the order is cancelled before payment, the job returns to `open` and the accepted proposal becomes `rejected`. If the order is cancelled **after** payment (freelancer cancellation or dispute refund), the job stays `filled` and the client may post a new job. |

### 6.5 Orders

| ID | Requirement |
|---|---|
| FR-ORD-01 | A client orders a published service by entering requirements (10–5.000 characters, guided by the service's requirements prompt). This creates an order in `awaiting_payment` with snapshot terms and amounts computed server-side. |
| FR-ORD-02 | Order detail `/dashboard/orders/{id}` is visible only to the two parties and admins. It shows terms, amounts (the client sees the price; the freelancer sees price, fee and earnings), status, deadline, deliveries, message thread and activity timeline. |
| FR-ORD-03 | Status transitions follow the state machine in [DATABASE §8.1](DATABASE.md#81-order). Every transition writes an `order_events` row. |
| FR-ORD-04 | The freelancer delivers (message 1–5.000 characters plus 0–10 files) while the order is `in_progress`. |
| FR-ORD-05 | The client accepts the delivery (completes the order) or requests a revision (message required) while the order is `delivered`. |
| FR-ORD-06 | Cancellation follows BR-20. Disputes follow BR-21. |
| FR-ORD-07 | Order lists for the client ("Purchases") and freelancer ("Sales"), filterable by status. |
| FR-ORD-08 | Order message thread follows BR-29. |
| FR-ORD-09 | Order files are private: only parties and admins can access them, through signed URLs. |

### 6.6 Payments

| ID | Requirement |
|---|---|
| FR-PAY-01 | The client clicks "Pay" on an `awaiting_payment` order. The server creates (or reuses) a payment attempt, obtains a Snap token, and the UI opens the Snap popup. |
| FR-PAY-02 | The order becomes `in_progress` **only** on a server-verified Midtrans status (a signed notification confirmed through the Status API, or a direct Status API sync). Client-side Snap callbacks are never trusted. |
| FR-PAY-03 | When the client returns from Snap, the order page triggers a server-side status sync, so local development works without a public webhook URL. |
| FR-PAY-04 | Failed, denied, cancelled or expired attempts leave the order in `awaiting_payment` until `payment_due_at`. The client may retry within BR-11. |
| FR-PAY-05 | Unpaid orders are cancelled automatically under BR-10. |
| FR-PAY-06 | Every notification is logged with its signature-validity result. Processing is idempotent. |
| FR-PAY-07 | The client sees payment status and history on the order page. |

### 6.7 Reviews

| ID | Requirement |
|---|---|
| FR-REV-01 | After completion, each party may review the other under BR-22. |
| FR-REV-02 | Freelancer rating (average, count) appears on the profile, service cards and proposal cards. Service rating aggregates reviews from orders of that service. Client rating appears on the client's profile and on the proposal-review screen. |

### 6.8 Admin

| ID | Requirement |
|---|---|
| FR-ADM-03 | Admin console at `/admin` (admins only): verifications, disputes, refunds pending, payouts pending, plus freelancer/service/job moderation actions. |
| FR-ADM-04 | Admins resolve disputes under BR-21 with a required note. |
| FR-ADM-05 | Admins mark refunds (BR-24) and payouts (BR-23) as done with a reference string. |
| FR-ADM-06 | Admins can read all orders, messages and files for dispute handling. Every admin write is logged in `order_events` (order-related) or in the affected row's reviewer fields. |

### 6.9 Earnings

| ID | Requirement |
|---|---|
| FR-EARN-01 (S) | `/dashboard/earnings` lists completed orders with amount, fee, earnings and payout status, plus totals (pending and paid). |

---

## 7. User journeys

Each journey lists the happy path and its key alternatives. Detailed flows and sequence diagrams are in [ARCHITECTURE.md §9](ARCHITECTURE.md#9-payment-architecture).

### J1. Sign up and onboarding (any user)

1. The visitor opens `/signup` and enters email and password. Supabase sends a confirmation email.
2. The user clicks the link, which goes to `/auth/confirm` (session established) and then to `/onboarding`.
3. The user sets full name and username and accepts the Terms of Service. `onboarded_at` is set and the user lands on `/dashboard`.
- *Alternative:* unconfirmed users who try to sign in see "confirm your email" with a resend option.

### J2. Become a freelancer (student)

1. On `/dashboard/verification`, the user selects a university.
2. **If** the account email domain matches that university's domains (and the email is confirmed), the user clicks "Verify with university email". The request is approved instantly and the freelancer profile is created.
3. **Otherwise** the user uploads a KTM image/PDF and enters their student number. The status is `pending` and the user is told to expect a review.
4. An admin approves it (setting `valid_until`) and the freelancer profile becomes active. Or the admin rejects it with a reason, and the user may re-apply.
5. The user completes the freelancer profile (headline, skills, major) and adds portfolio items.
- *Alternative:* the user changes their account email to their university email (Supabase confirms the change) to qualify for automatic verification.

### J3. Publish a service (freelancer)

1. `/dashboard/services/new` creates a draft (fields per FR-SVC-01) and uploads a cover image.
2. "Publish" makes the service visible on `/services` and on the freelancer's profile.
3. The freelancer may pause it (hidden, no new orders), edit it, or archive it.

### J4. Order a service and pay (client)

1. The client browses `/services`, opens a service and clicks "Order".
2. The client enters requirements and sees the price and the "pay within 24 hours" notice, then clicks "Continue to payment".
3. The order is created (`awaiting_payment`) and the Snap popup opens. The client pays with a sandbox method.
4. On Snap close or finish, the order page syncs status. A settlement moves the order to `in_progress`, and the freelancer sees it under Sales.
- *Alternatives:* bank-transfer VA stays `pending`, and the client can reopen the same Snap token to see the instructions. An expired or denied attempt lets the client retry. With no payment within 24 hours, the order is auto-cancelled. The client can cancel before paying.

### J5. Post a job and hire (client)

1. `/dashboard/jobs/new` posts a job, which appears on `/jobs`.
2. Freelancers submit proposals (J6). The client reviews them on `/dashboard/jobs/{id}`.
3. The client clicks "Hire" on a proposal and confirms. The proposal is accepted, the job moves to `hiring`, an order is created, and the client is sent to pay (same as J4 step 3).
4. Payment settles: the order is `in_progress`, the job is `filled`, and the other proposals are rejected.
- *Alternatives:* the client rejects individual proposals, or closes the job without hiring (all submitted proposals are rejected). If the hire order is cancelled or expires before payment, the job is `open` again and the client may hire someone else.

### J6. Submit a proposal (freelancer)

1. A verified student opens an open job on `/jobs/{id}` and clicks "Submit proposal".
2. The freelancer enters cover letter, price, delivery days and revisions, and submits.
3. They track it on `/dashboard/proposals` and may withdraw while it is `submitted`.

### J7. Work, deliver, revise, complete (both)

1. The freelancer works on the `in_progress` order and uses the message thread for clarifications.
2. The freelancer delivers (message plus files), and the order moves to `delivered`.
3. The client either accepts (`completed`, payout pending), or requests a revision (`in_progress`, `revisions_used + 1`) and the cycle repeats.
4. If the client does nothing for 3 days after delivery, the order auto-completes.
5. Both parties may leave a review within 14 days.

### J8. Dispute (both, plus admin)

1. Either party opens a dispute with a reason (`in_progress` or `delivered`). The order moves to `disputed`.
2. Messages remain available. The admin reviews the thread, deliveries and files.
3. The admin resolves the dispute. **Release:** the order is `completed` and the payout is pending. **Refund:** the order is `cancelled` and the refund is pending.
4. The admin later records the refund or payout with a reference.

### J9. Freelancer cancels before starting

1. The freelancer cannot fulfil a paid order (with no delivery yet), clicks "Cancel order" and gives a reason.
2. The order is `cancelled` and the payment's refund is `pending`. The admin records the refund.

### J10. Admin operations

1. Verification queue: view document, then approve or reject.
2. Disputes queue: resolve.
3. Refunds pending and payouts pending: mark done.
4. Moderation: block a service, close a job, suspend a freelancer.

---

## 8. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-01 Security | Authorization is enforced in **both** server code and Supabase RLS. Secrets never reach the browser. See [ARCHITECTURE §12](ARCHITECTURE.md#12-security). |
| NFR-02 Privacy | Student documents and student numbers are visible only to the owner and admins. Emails are never public. Order content is visible only to the parties and admins. |
| NFR-03 Integrity | Money amounts are computed server-side from database rows. Status transitions are atomic and idempotent. |
| NFR-04 Performance | Marketplace list pages render with p95 server time < 800 ms at MVP data volume (≤ 10k services/jobs). |
| NFR-05 Availability | Uses Vercel and Supabase managed availability. Missed webhooks are recovered by status sync and reconciliation. |
| NFR-06 Accessibility | WCAG 2.1 AA for core flows (shadcn/ui primitives, labelled form fields, keyboard navigation). |
| NFR-07 Responsiveness | All pages usable from 360 px width upward. |
| NFR-08 Browser support | Latest two versions of Chrome, Firefox, Safari and Edge, including mobile Safari and Chrome. |
| NFR-09 Code quality | TypeScript `strict`. Lint, type check, unit tests, DB tests and build pass in CI. |
| NFR-10 Observability | Structured server logs for payment and webhook paths, with no secrets or PII in logs. |
| NFR-11 Language | All user-facing text is in **Bahasa Indonesia**: UI copy, validation and error messages, empty states, and Supabase Auth email templates. Pages set `<html lang="id">`. Code, identifiers, database enums, URLs, logs and documentation stay in English. |

---

## 9. Success metrics (MVP demo / pilot)

| Metric | Target |
|---|---|
| End-to-end sandbox flow (service order → pay → deliver → complete → review) | Works without manual DB intervention |
| End-to-end job flow (post → propose → hire → pay → complete) | Works without manual DB intervention |
| RLS negative tests | 100% of the policy matrix in DATABASE §9 covered by pgTAP tests |
| Webhook correctness | 0 orders moved to `in_progress` without a verified paid status (tested) |
| Verification turnaround (manual) | Median < 48 h during pilot |

---

## 10. Assumptions and open questions

### 10.1 Assumptions

- A1. Market is Indonesia, currency IDR, timezone `Asia/Jakarta`.
- A2. Midtrans Sandbox is enough for the MVP. Going to production requires merchant onboarding and is out of scope.
- A3. Universities and their student email domains are maintained by admins through reviewed data migrations.
- A4. Platform holds funds conceptually. Legal and licensing review of the escrow-style flow is required before production.
- A5. Supabase built-in email is fine for development. A custom SMTP provider is configured before any pilot (Supabase's default sender is heavily rate-limited).

### 10.2 Decided

| ID | Question | Decision (2026-11-13) |
|---|---|---|
| Q1 | UI language | **Bahasa Indonesia** (NFR-11). One language only, so no i18n framework. Copy lives in components. Route paths stay English (`/services`, `/jobs`), while visible labels are Indonesian ("Jasa", "Pekerjaan"). |
| Q3 | Transactional email (order paid, delivered, etc.) in MVP? | "Include it if easy." It is **not easy** here, so it is **excluded from the MVP**. It would need an email provider account, a verified sending domain, and an outbox worker, because many transitions (payment webhook, `pg_cron` expiry and auto-complete) happen outside a request where email could be sent. Post-MVP design: treat `order_events` as the outbox and send from a cron worker. Supabase Auth emails still need custom SMTP before pilot (A5). |
| Q6 | Which universities to seed? | Start with universities in **Tarakan**, including **STMIK PPKIA Tarakanita Rahmawati**. Seeded with empty `email_domains`, so verification uses the **document method** until the official **student** email domains are confirmed (DATABASE §13). |

### 10.3 Open questions (need product owner decision)

| ID | Question | Default used in this blueprint |
|---|---|---|
| Q2 | Is the 10% platform fee (charged to the freelancer) correct, or should the client pay a service fee on top? | 10% from freelancer (BR-09) |
| Q4 | Retention period for student documents after decision (Indonesian PDP Law, UU 27/2022)? | Kept until the verification expires. Purge is a post-MVP job (see IMPLEMENTATION_PLAN risks). |
| Q5 | Minimum age / ToS acceptance flow? | ToS checkbox at onboarding (stored as `profiles.terms_accepted_at`). No age gate. ToS and Privacy page **content** (in Bahasa Indonesia) must be supplied by the product owner. |
| Q6a | Complete list of Tarakan universities to seed, and each one's official student email domain (if any) | Seed only the universities named in DATABASE §13 until the list is confirmed |
| Q7 | How do students whose university is not listed get verified? | They contact support and an admin adds the university (SQL in the MVP). There is no self-service "request a university" flow. |
