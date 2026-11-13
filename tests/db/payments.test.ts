import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import {
  anon,
  as,
  createOnboardedUser,
  createTestDb,
  createUser,
  expectPgError,
  firstCategoryId,
  makeAdmin,
  makeFreelancer,
  putObject,
  service,
  user,
  type Actor,
} from "./harness";

let db: PGlite;
let categoryId: string;

const DESCRIPTION =
  "Desain logo profesional untuk UMKM di Tarakan, termasuk tiga konsep awal.";
const REQUIREMENTS = "Logo untuk kedai kopi bernama Kopi Pesisir.";
const JOB_DESCRIPTION =
  "Kami membutuhkan landing page untuk usaha kuliner di Tarakan, responsif.";
const COVER =
  "Saya mahasiswa Sistem Informasi dan sudah membuat beberapa landing page serupa.";

beforeAll(async () => {
  db = await createTestDb();
  categoryId = await firstCategoryId(db);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const q = <T extends Record<string, unknown>>(
  actor: Actor,
  sql: string,
  params: unknown[] = [],
) => as(db, actor, (tx) => tx.query<T>(sql, params));

async function count(actor: Actor, sql: string, params: unknown[] = []) {
  return (await q(actor, sql, params)).rows.length;
}

async function freelancer(): Promise<string> {
  const id = await createOnboardedUser(db);
  await makeFreelancer(db, id);
  return id;
}

/** Inserts a service directly (as superuser); services have their own tests. */
async function createService(
  freelancerId: string,
  opts: {
    price?: number;
    status?: string;
    blocked?: boolean;
    deliveryDays?: number;
  } = {},
): Promise<string> {
  const r = await db.query<{ id: string }>(
    `insert into public.services
       (freelancer_id, category_id, title, description, price, delivery_days,
        revisions_included, cover_image_path, status, published_at, blocked_at, blocked_reason)
     values ($1, $2, 'Desain logo UMKM', $3, $4, $5, 2, $8, $6::public.service_status,
             now(), case when $7 then now() end, case when $7 then 'Melanggar aturan' end)
     returning id`,
    [
      freelancerId,
      categoryId,
      DESCRIPTION,
      opts.price ?? 150000,
      opts.deliveryDays ?? 5,
      opts.status ?? "published",
      opts.blocked ?? false,
      `${freelancerId}/cover.png`,
    ],
  );
  return r.rows[0]!.id;
}

async function orderService(client: string, serviceId: string) {
  const r = await q<{ id: string }>(
    user(client),
    "select public.create_service_order($1, $2) as id",
    [serviceId, REQUIREMENTS],
  );
  return r.rows[0]!.id;
}

/** A fresh client + verified freelancer + published service + order. */
async function serviceOrder(opts: { price?: number } = {}) {
  const client = await createOnboardedUser(db);
  const f = await freelancer();
  const serviceId = await createService(f, opts);
  const orderId = await orderService(client, serviceId);
  return { client, freelancer: f, serviceId, orderId };
}

/** Job flow: job with two proposals, the first one accepted. */
async function jobOrder() {
  const client = await createOnboardedUser(db);
  const job = (
    await q<{ id: string }>(
      user(client),
      `insert into public.jobs (client_id, category_id, title, description, budget_min, budget_max)
       values ($1, $2, 'Landing page usaha kuliner', $3, 500000, 1500000) returning id`,
      [client, categoryId, JOB_DESCRIPTION],
    )
  ).rows[0]!.id;
  const propose = async (f: string) =>
    (
      await q<{ id: string }>(
        user(f),
        "select id from public.submit_proposal($1, $2, 1000000, 7, 1)",
        [job, COVER],
      )
    ).rows[0]!.id;
  const hired = await freelancer();
  const other = await freelancer();
  const hiredProposal = await propose(hired);
  const otherProposal = await propose(other);
  const orderId = (
    await q<{ id: string }>(
      user(client),
      "select public.accept_proposal($1) as id",
      [hiredProposal],
    )
  ).rows[0]!.id;
  return {
    client,
    freelancer: hired,
    job,
    orderId,
    hiredProposal,
    otherProposal,
  };
}

type PaymentRow = {
  id: string;
  order_id: string;
  attempt_no: number;
  midtrans_order_id: string;
  gross_amount: string;
  status: string;
  snap_token: string | null;
  refund_status: string;
  paid_at: string | null;
};

async function attempt(client: string, orderId: string): Promise<PaymentRow> {
  const r = await q<PaymentRow>(
    user(client),
    "select * from public.create_payment_attempt($1)",
    [orderId],
  );
  return r.rows[0]!;
}

async function attach(paymentId: string, minutes = 60) {
  await q(
    service,
    `select public.attach_snap_token($1, $3, 'https://app.sandbox.midtrans.com/snap/v4/redirection/x',
       now() + make_interval(mins => $2))`,
    [paymentId, minutes, `snap-token-${paymentId}`],
  );
}

async function apply(
  midtransOrderId: string,
  transactionStatus: string,
  grossAmount: number,
  fraudStatus: string | null = null,
): Promise<string> {
  const r = await q<{ result: string }>(
    service,
    "select public.apply_payment_status($1, $2, $3, '200', $4, 'bank_transfer', 'tx-' || $1) as result",
    [midtransOrderId, transactionStatus, fraudStatus, grossAmount],
  );
  return r.rows[0]!.result;
}

async function payment(id: string) {
  return (
    await db.query<PaymentRow>("select * from public.payments where id = $1", [
      id,
    ])
  ).rows[0]!;
}

async function order(id: string) {
  return (
    await db.query<{
      status: string;
      amount: string;
      platform_fee: string;
      freelancer_earnings: string;
      paid_at: string | null;
      due_at: string | null;
      delivery_days: number;
      cancelled_by: string | null;
      cancellation_reason: string | null;
      payout_status: string;
      completed_at: string | null;
    }>("select * from public.orders where id = $1", [id])
  ).rows[0]!;
}

async function events(orderId: string): Promise<string[]> {
  return (
    await db.query<{ event_type: string }>(
      "select event_type from public.order_events where order_id = $1 order by id",
      [orderId],
    )
  ).rows.map((r) => r.event_type);
}

const one = async <T>(sql: string, params: unknown[]) =>
  (await db.query<Record<string, T>>(sql, params)).rows[0]!;

// ---------------------------------------------------------------------------
// create_service_order
// ---------------------------------------------------------------------------

describe("create_service_order", () => {
  it("creates an awaiting-payment order with amounts taken from the service (BR-09)", async () => {
    const {
      client,
      freelancer: f,
      serviceId,
      orderId,
    } = await serviceOrder({
      price: 155555,
    });
    const o = await db.query<Record<string, unknown>>(
      `select source, service_id, client_id, freelancer_id, title, requirements, amount, platform_fee,
              freelancer_earnings, delivery_days, revisions_allowed, status,
              payment_due_at - created_at as window
         from public.orders where id = $1`,
      [orderId],
    );
    expect(o.rows[0]).toMatchObject({
      source: "service",
      service_id: serviceId,
      client_id: client,
      freelancer_id: f,
      title: "Desain logo UMKM",
      requirements: REQUIREMENTS,
      amount: 155555,
      platform_fee: 15555,
      freelancer_earnings: 140000,
      delivery_days: 5,
      revisions_allowed: 2,
      status: "awaiting_payment",
    });
    expect(String((o.rows[0] as { window: unknown }).window)).toMatch(
      /24:00:00|1 day/,
    );
    expect(await events(orderId)).toEqual(["created"]);
  });

  it("rejects anon, non-onboarded users, own services and bad requirements", async () => {
    const f = await freelancer();
    const serviceId = await createService(f);
    await expectPgError(
      q(anon, "select public.create_service_order($1, $2)", [
        serviceId,
        REQUIREMENTS,
      ]),
      "42501",
    );
    await expectPgError(
      q(
        user(await createUser(db)),
        "select public.create_service_order($1, $2)",
        [serviceId, REQUIREMENTS],
      ),
      "PJ403",
      "NOT_ONBOARDED",
    );
    await expectPgError(
      q(user(f), "select public.create_service_order($1, $2)", [
        serviceId,
        REQUIREMENTS,
      ]),
      "PJ403",
      "OWN_SERVICE",
    );
    const client = await createOnboardedUser(db);
    await expectPgError(
      q(user(client), "select public.create_service_order($1, 'terlalu')", [
        serviceId,
      ]),
      "PJ422",
      "INVALID_REQUIREMENTS",
    );
    await expectPgError(
      q(user(client), "select public.create_service_order($1, $2)", [
        "00000000-0000-4000-8000-000000000000",
        REQUIREMENTS,
      ]),
      "PJ404",
      "SERVICE_NOT_FOUND",
    );
  });

  it("only orders published, unblocked services from eligible freelancers", async () => {
    const client = await createOnboardedUser(db);
    const f = await freelancer();
    for (const svc of [
      await createService(f, { status: "draft" }),
      await createService(f, { status: "paused" }),
      await createService(f, { blocked: true }),
    ]) {
      await expectPgError(
        q(user(client), "select public.create_service_order($1, $2)", [
          svc,
          REQUIREMENTS,
        ]),
        "PJ409",
        "SERVICE_NOT_AVAILABLE",
      );
    }
    const lapsed = await freelancer();
    const lapsedService = await createService(lapsed);
    await makeFreelancer(db, lapsed, { status: "suspended" });
    await expectPgError(
      q(user(client), "select public.create_service_order($1, $2)", [
        lapsedService,
        REQUIREMENTS,
      ]),
      "PJ409",
      "SERVICE_NOT_AVAILABLE",
    );
  });

  it("prevents a duplicate unpaid order for the same service and enforces BR-12", async () => {
    const client = await createOnboardedUser(db);
    const f = await freelancer();
    const first = await createService(f);
    await orderService(client, first);
    await expectPgError(
      orderService(client, first),
      "PJ409",
      "SERVICE_ORDER_PENDING",
    );
    for (let i = 0; i < 4; i += 1) {
      await orderService(client, await createService(f));
    }
    await expectPgError(
      orderService(client, await createService(f)),
      "PJ409",
      "MAX_AWAITING_PAYMENT_ORDERS",
    );
  });
});

// ---------------------------------------------------------------------------
// create_payment_attempt
// ---------------------------------------------------------------------------

describe("create_payment_attempt", () => {
  it("creates an initiated attempt priced from the order, for the order client only", async () => {
    const { client, freelancer: f, orderId } = await serviceOrder();
    await expectPgError(
      q(anon, "select public.create_payment_attempt($1)", [orderId]),
      "42501",
    );
    for (const other of [f, await createOnboardedUser(db)]) {
      await expectPgError(
        q(user(other), "select public.create_payment_attempt($1)", [orderId]),
        "PJ404",
        "ORDER_NOT_FOUND",
      );
    }

    const p = await attempt(client, orderId);
    const number = (
      await one<number>(
        "select order_number from public.orders where id = $1",
        [orderId],
      )
    ).order_number;
    expect(p).toMatchObject({
      attempt_no: 1,
      status: "initiated",
      gross_amount: 150000,
      snap_token: null,
    });
    expect(p.midtrans_order_id).toMatch(
      new RegExp(`^PJK-${String(number).padStart(6, "0")}-1-[0-9a-f]{8}$`),
    );
    expect(await events(orderId)).toEqual([
      "created",
      "payment_attempt_created",
    ]);
  });

  it("refuses a second attempt while the first Snap call is in flight, then reuses the valid token", async () => {
    const { client, orderId } = await serviceOrder();
    const p = await attempt(client, orderId);
    await expectPgError(
      attempt(client, orderId),
      "PJ409",
      "PAYMENT_IN_PROGRESS",
    );
    await attach(p.id);
    const again = await attempt(client, orderId);
    expect(again.id).toBe(p.id);
    expect(again.snap_token).toBe(`snap-token-${p.id}`);
  });

  it("replaces a stale initiated attempt and an expired token", async () => {
    const { client, orderId } = await serviceOrder();
    const first = await attempt(client, orderId);
    await db.query(
      "update public.payments set created_at = now() - interval '3 minutes' where id = $1",
      [first.id],
    );
    const second = await attempt(client, orderId);
    expect(second.attempt_no).toBe(2);
    expect(await payment(first.id)).toMatchObject({ status: "failed" });

    await attach(second.id);
    await db.query(
      "update public.payments set token_expires_at = now() - interval '1 minute' where id = $1",
      [second.id],
    );
    const third = await attempt(client, orderId);
    expect(third.attempt_no).toBe(3);
    expect(await payment(second.id)).toMatchObject({ status: "expired" });
  });

  it("limits attempts per order (BR-11: 5)", async () => {
    const { client, orderId } = await serviceOrder();
    for (let i = 0; i < 5; i += 1) {
      const p = await attempt(client, orderId);
      await q(service, "select public.fail_payment_attempt($1, 'snap_500')", [
        p.id,
      ]);
    }
    await expectPgError(
      attempt(client, orderId),
      "PJ409",
      "MAX_PAYMENT_ATTEMPTS",
    );
  });

  it("refuses orders that are not awaiting payment or whose window is closing", async () => {
    const a = await serviceOrder();
    await q(user(a.client), "select public.cancel_order($1, 'Batal')", [
      a.orderId,
    ]);
    await expectPgError(
      attempt(a.client, a.orderId),
      "PJ409",
      "ORDER_NOT_AWAITING_PAYMENT",
    );

    const b = await serviceOrder();
    await db.query(
      "update public.orders set payment_due_at = now() + interval '4 minutes' where id = $1",
      [b.orderId],
    );
    await expectPgError(
      attempt(b.client, b.orderId),
      "PJ409",
      "PAYMENT_WINDOW_CLOSING",
    );
  });
});

// ---------------------------------------------------------------------------
// Service-role-only functions
// ---------------------------------------------------------------------------

describe("service-role-only payment functions", () => {
  it("cannot be executed by anon or any authenticated user, including the order client and admins", async () => {
    const { client, orderId } = await serviceOrder();
    const p = await attempt(client, orderId);
    const admin = await createOnboardedUser(db);
    await makeAdmin(db, admin);
    const calls: [string, unknown[]][] = [
      [
        "select public.attach_snap_token($1, 't', 'https://x', now() + interval '1 hour')",
        [p.id],
      ],
      ["select public.fail_payment_attempt($1, 'x')", [p.id]],
      [
        "select public.apply_payment_status($1, 'settlement', null, '200', 150000, 'gopay', 't')",
        [p.midtrans_order_id],
      ],
      ["select public.expire_unpaid_orders()", []],
    ];
    for (const actor of [anon, user(client), user(admin)]) {
      for (const [sql, params] of calls) {
        await expectPgError(q(actor, sql, params), "42501");
      }
    }
    expect(await order(orderId)).toMatchObject({
      status: "awaiting_payment",
    });
  });

  it("attach_snap_token validates the token and the expiry against the payment window", async () => {
    const { client, orderId } = await serviceOrder();
    const p = await attempt(client, orderId);
    await expectPgError(
      q(
        service,
        "select public.attach_snap_token($1, '', 'https://x', now() + interval '1 hour')",
        [p.id],
      ),
      "PJ422",
      "INVALID_SNAP_TOKEN",
    );
    await expectPgError(
      q(
        service,
        "select public.attach_snap_token($1, 't', 'https://x', now() + interval '25 hours')",
        [p.id],
      ),
      "PJ422",
      "INVALID_TOKEN_EXPIRY",
    );
    await attach(p.id);
    expect(await payment(p.id)).toMatchObject({ status: "pending" });
    await expectPgError(
      q(
        service,
        "select public.attach_snap_token($1, 't', 'https://x', now() + interval '1 hour')",
        [p.id],
      ),
      "PJ409",
      "PAYMENT_NOT_INITIATED",
    );
  });

  it("fail_payment_attempt fails an initiated attempt once (idempotent)", async () => {
    const { client, orderId } = await serviceOrder();
    const p = await attempt(client, orderId);
    await q(service, "select public.fail_payment_attempt($1, 'snap_502')", [
      p.id,
    ]);
    await q(service, "select public.fail_payment_attempt($1, 'snap_502')", [
      p.id,
    ]);
    expect(await payment(p.id)).toMatchObject({ status: "failed" });
    expect(await events(orderId)).toEqual([
      "created",
      "payment_attempt_created",
      "payment_failed",
    ]);
    const next = await attempt(client, orderId);
    await attach(next.id);
    await expectPgError(
      q(service, "select public.fail_payment_attempt($1, 'x')", [next.id]),
      "PJ409",
      "PAYMENT_NOT_INITIATED",
    );
  });
});

// ---------------------------------------------------------------------------
// apply_payment_status (DATABASE §8.2, IMPLEMENTATION_PLAN §4.3)
// ---------------------------------------------------------------------------

describe("apply_payment_status", () => {
  it("settlement marks the payment paid and starts the order; repeats are no-ops", async () => {
    const { client, orderId } = await serviceOrder();
    const p = await attempt(client, orderId);
    await attach(p.id);

    expect(await apply(p.midtrans_order_id, "settlement", 150000)).toBe(
      "applied",
    );
    expect(await payment(p.id)).toMatchObject({
      status: "paid",
      refund_status: "none",
    });
    const o = await order(orderId);
    expect(o.status).toBe("in_progress");
    const delta = await one<string>(
      "select (due_at - paid_at)::text as delta from public.orders where id = $1",
      [orderId],
    );
    expect(delta.delta).toBe("5 days");
    expect(await events(orderId)).toContain("payment_paid");

    expect(await apply(p.midtrans_order_id, "settlement", 150000)).toBe(
      "no_change",
    );
    expect(await apply(p.midtrans_order_id, "pending", 150000)).toBe(
      "ignored_regression",
    );
    expect(await apply(p.midtrans_order_id, "expire", 150000)).toBe(
      "ignored_regression",
    );
    expect(await payment(p.id)).toMatchObject({ status: "paid" });
    expect(
      (await events(orderId)).filter((e) => e === "payment_paid"),
    ).toHaveLength(1);
  });

  it("ignores amount mismatches, unknown IDs and unknown statuses without changing anything", async () => {
    const { client, orderId } = await serviceOrder();
    const p = await attempt(client, orderId);
    await attach(p.id);
    expect(await apply(p.midtrans_order_id, "settlement", 10000)).toBe(
      "amount_mismatch",
    );
    expect(await apply("PJK-999999-1-deadbeef", "settlement", 150000)).toBe(
      "unknown_payment",
    );
    expect(await apply(p.midtrans_order_id, "weird_status", 150000)).toBe(
      "error",
    );
    expect(await payment(p.id)).toMatchObject({ status: "pending" });
    expect(await order(orderId)).toMatchObject({
      status: "awaiting_payment",
    });
  });

  it("maps Midtrans statuses (incl. card fraud status and upper-case values)", async () => {
    const cases: [string, string | null, string][] = [
      ["capture", "challenge", "pending"],
      ["PENDING", null, "pending"],
      ["deny", null, "failed"],
      ["failure", null, "failed"],
      ["cancel", null, "cancelled"],
      ["expire", null, "expired"],
      ["capture", "deny", "failed"],
      ["capture", "accept", "paid"],
      ["capture", null, "paid"],
    ];
    for (const [tx, fraud, expected] of cases) {
      const { client, orderId } = await serviceOrder();
      const p = await attempt(client, orderId);
      await attach(p.id);
      await apply(p.midtrans_order_id, tx, 150000, fraud);
      expect((await payment(p.id)).status, `${tx}/${fraud}`).toBe(expected);
      expect((await order(orderId)).status).toBe(
        expected === "paid" ? "in_progress" : "awaiting_payment",
      );
    }
  });

  it("an expired attempt keeps the order waiting and allows a retry", async () => {
    const { client, orderId } = await serviceOrder();
    const p = await attempt(client, orderId);
    await attach(p.id);
    expect(await apply(p.midtrans_order_id, "expire", 150000)).toBe("applied");
    expect(await order(orderId)).toMatchObject({
      status: "awaiting_payment",
    });
    expect(await events(orderId)).toContain("payment_expired");
    const retry = await attempt(client, orderId);
    expect(retry.attempt_no).toBe(2);
  });

  it("captured money wins over an earlier failure; a provider refund is final", async () => {
    const { client, orderId } = await serviceOrder();
    const p = await attempt(client, orderId);
    await attach(p.id);
    await apply(p.midtrans_order_id, "expire", 150000);
    expect(await apply(p.midtrans_order_id, "settlement", 150000)).toBe(
      "applied",
    );
    expect(await order(orderId)).toMatchObject({ status: "in_progress" });

    expect(await apply(p.midtrans_order_id, "refund", 150000)).toBe("applied");
    expect(await payment(p.id)).toMatchObject({
      status: "refunded",
      refund_status: "refunded",
    });
    expect(await events(orderId)).toContain("payment_refunded_by_provider");
    expect(await apply(p.midtrans_order_id, "settlement", 150000)).toBe(
      "ignored_regression",
    );
  });

  it("a settlement after cancellation is recorded as a late payment with refund pending", async () => {
    const { client, orderId } = await serviceOrder();
    const p = await attempt(client, orderId);
    await attach(p.id);
    const live = await q<{ ids: string[] }>(
      user(client),
      "select public.cancel_order($1, 'Berubah pikiran') as ids",
      [orderId],
    );
    expect(live.rows[0]!.ids).toEqual([p.midtrans_order_id]);
    expect(await payment(p.id)).toMatchObject({ status: "cancelled" });

    expect(await apply(p.midtrans_order_id, "settlement", 150000)).toBe(
      "applied",
    );
    expect(await payment(p.id)).toMatchObject({
      status: "paid",
      refund_status: "pending",
    });
    expect(await order(orderId)).toMatchObject({ status: "cancelled" });
    expect(await events(orderId)).toContain("late_payment_detected");
  });

  it("a second paid attempt is flagged as a duplicate with refund pending", async () => {
    const { client, orderId } = await serviceOrder();
    const first = await attempt(client, orderId);
    await attach(first.id);
    await apply(first.midtrans_order_id, "expire", 150000);
    const second = await attempt(client, orderId);
    await attach(second.id);
    await apply(second.midtrans_order_id, "settlement", 150000);
    expect(await order(orderId)).toMatchObject({ status: "in_progress" });

    expect(await apply(first.midtrans_order_id, "settlement", 150000)).toBe(
      "applied",
    );
    expect(await payment(first.id)).toMatchObject({
      status: "paid",
      refund_status: "pending",
    });
    expect(await payment(second.id)).toMatchObject({ refund_status: "none" });
    expect(await events(orderId)).toContain("duplicate_payment_detected");
  });

  it("paying a job order fills the job and rejects the other proposals (BR-16)", async () => {
    const j = await jobOrder();
    const p = await attempt(j.client, j.orderId);
    await attach(p.id);
    expect(await apply(p.midtrans_order_id, "settlement", 1000000)).toBe(
      "applied",
    );
    expect(await order(j.orderId)).toMatchObject({ status: "in_progress" });
    expect(
      await one<string>("select status from public.jobs where id = $1", [
        j.job,
      ]),
    ).toEqual({ status: "filled" });
    expect(
      await one<string>(
        "select status, status_reason from public.proposals where id = $1",
        [j.otherProposal],
      ),
    ).toEqual({ status: "rejected", status_reason: "job_filled" });
    expect(
      await one<string>("select status from public.proposals where id = $1", [
        j.hiredProposal,
      ]),
    ).toEqual({ status: "accepted" });
  });
});

// ---------------------------------------------------------------------------
// cancel_order (BR-20) and expire_unpaid_orders (BR-10)
// ---------------------------------------------------------------------------

async function paidServiceOrder() {
  const o = await serviceOrder();
  const p = await attempt(o.client, o.orderId);
  await attach(p.id);
  await apply(p.midtrans_order_id, "settlement", 150000);
  return { ...o, payment: p };
}

describe("cancel_order after payment", () => {
  it("the client cannot cancel a paid order; the freelancer can before delivering (refund pending)", async () => {
    const o = await paidServiceOrder();
    await expectPgError(
      q(user(o.client), "select public.cancel_order($1, 'Tidak jadi')", [
        o.orderId,
      ]),
      "PJ409",
      "ORDER_NOT_CANCELLABLE",
    );
    await expectPgError(
      q(user(o.freelancer), "select public.cancel_order($1, '')", [o.orderId]),
      "PJ422",
      "INVALID_CANCEL_REASON",
    );
    const r = await q<{ ids: string[] }>(
      user(o.freelancer),
      "select public.cancel_order($1, 'Sakit') as ids",
      [o.orderId],
    );
    expect(r.rows[0]!.ids).toEqual([]);
    expect(await order(o.orderId)).toMatchObject({
      status: "cancelled",
      cancelled_by: o.freelancer,
    });
    expect(await payment(o.payment.id)).toMatchObject({
      status: "paid",
      refund_status: "pending",
    });
  });

  it("a paid job order cancelled by the freelancer leaves the job filled", async () => {
    const j = await jobOrder();
    const p = await attempt(j.client, j.orderId);
    await attach(p.id);
    await apply(p.midtrans_order_id, "settlement", 1000000);
    await q(user(j.freelancer), "select public.cancel_order($1, 'Sakit')", [
      j.orderId,
    ]);
    expect(
      await one<string>("select status from public.jobs where id = $1", [
        j.job,
      ]),
    ).toEqual({ status: "filled" });
  });

  it("the freelancer cannot cancel after the first delivery", async () => {
    const o = await paidServiceOrder();
    await q(user(o.freelancer), "select public.deliver_order($1, 'Hasil')", [
      o.orderId,
    ]);
    await q(user(o.client), "select public.complete_order($1)", [o.orderId]);
    await expectPgError(
      q(user(o.freelancer), "select public.cancel_order($1, 'x')", [o.orderId]),
      "PJ409",
      "ORDER_NOT_CANCELLABLE",
    );
  });
});

describe("expire_unpaid_orders", () => {
  it("cancels orders past the window plus grace, expires live attempts and reopens jobs", async () => {
    const late = await jobOrder();
    const p = await attempt(late.client, late.orderId);
    await attach(p.id);
    const inGrace = await serviceOrder();
    const fresh = await serviceOrder();
    await db.query(
      "update public.orders set payment_due_at = now() - interval '16 minutes' where id = $1",
      [late.orderId],
    );
    await db.query(
      "update public.orders set payment_due_at = now() - interval '10 minutes' where id = $1",
      [inGrace.orderId],
    );

    const r = await q<{ n: number }>(
      service,
      "select public.expire_unpaid_orders() as n",
    );
    expect(r.rows[0]!.n).toBeGreaterThanOrEqual(1);
    expect(await order(late.orderId)).toMatchObject({
      status: "cancelled",
      cancelled_by: null,
      cancellation_reason: "payment_window_expired",
    });
    expect(await payment(p.id)).toMatchObject({ status: "expired" });
    expect(
      await one<string>("select status from public.jobs where id = $1", [
        late.job,
      ]),
    ).toEqual({ status: "open" });
    expect(await order(inGrace.orderId)).toMatchObject({
      status: "awaiting_payment",
    });
    expect(await order(fresh.orderId)).toMatchObject({
      status: "awaiting_payment",
    });

    // A payment that still settles afterwards is a late payment (refund).
    await apply(p.midtrans_order_id, "settlement", 1000000);
    expect(await payment(p.id)).toMatchObject({ refund_status: "pending" });
  });
});

// ---------------------------------------------------------------------------
// deliver_order and complete_order
// ---------------------------------------------------------------------------

describe("deliver_order and complete_order", () => {
  it("only the freelancer delivers an in-progress order; only the client completes it", async () => {
    const unpaid = await serviceOrder();
    await expectPgError(
      q(user(unpaid.freelancer), "select public.deliver_order($1, 'Hasil')", [
        unpaid.orderId,
      ]),
      "PJ409",
      "ORDER_NOT_IN_PROGRESS",
    );

    const o = await paidServiceOrder();
    const stranger = await createOnboardedUser(db);
    await expectPgError(
      q(user(stranger), "select public.deliver_order($1, 'Hasil')", [
        o.orderId,
      ]),
      "PJ404",
      "ORDER_NOT_FOUND",
    );
    await expectPgError(
      q(user(o.client), "select public.deliver_order($1, 'Hasil')", [
        o.orderId,
      ]),
      "PJ403",
      "NOT_ORDER_FREELANCER",
    );
    await expectPgError(
      q(user(o.freelancer), "select public.deliver_order($1, '  ')", [
        o.orderId,
      ]),
      "PJ422",
      "INVALID_MESSAGE",
    );
    await expectPgError(
      q(user(o.freelancer), "select public.complete_order($1)", [o.orderId]),
      "PJ403",
      "NOT_ORDER_CLIENT",
    );
    await expectPgError(
      q(user(o.client), "select public.complete_order($1)", [o.orderId]),
      "PJ409",
      "ORDER_NOT_DELIVERED",
    );

    const d = await q<{ delivery_number: number }>(
      user(o.freelancer),
      "select delivery_number from public.deliver_order($1, 'Berikut hasil logo final.')",
      [o.orderId],
    );
    expect(d.rows[0]!.delivery_number).toBe(1);
    expect(await order(o.orderId)).toMatchObject({ status: "delivered" });

    await q(user(o.client), "select public.complete_order($1)", [o.orderId]);
    const done = await order(o.orderId);
    expect(done).toMatchObject({
      status: "completed",
      payout_status: "pending",
    });
    expect(done.completed_at).not.toBeNull();
    expect(await events(o.orderId)).toEqual([
      "created",
      "payment_attempt_created",
      "payment_paid",
      "delivered",
      "completed",
    ]);
    await expectPgError(
      q(user(o.client), "select public.complete_order($1)", [o.orderId]),
      "PJ409",
      "ORDER_NOT_DELIVERED",
    );
  });

  it("validates attachment paths against the caller's own order folder", async () => {
    const o = await paidServiceOrder();
    const own = `${o.orderId}/${o.freelancer}/file.pdf`;
    const foreign = `${o.orderId}/${o.client}/file.pdf`;
    await expectPgError(
      q(
        user(o.freelancer),
        "select public.deliver_order($1, 'Hasil', array[$2])",
        [o.orderId, own],
      ),
      "PJ422",
      "ATTACHMENT_NOT_FOUND",
    );
    await db.query(
      "insert into storage.buckets (id, name) values ('order-files', 'order-files') on conflict do nothing",
    );
    await putObject(db, "order-files", foreign);
    await expectPgError(
      q(
        user(o.freelancer),
        "select public.deliver_order($1, 'Hasil', array[$2])",
        [o.orderId, foreign],
      ),
      "PJ422",
      "ATTACHMENT_NOT_FOUND",
    );
    await expectPgError(
      q(
        user(o.freelancer),
        "select public.deliver_order($1, 'Hasil', array_fill($2::text, array[11]))",
        [o.orderId, own],
      ),
      "PJ422",
      "TOO_MANY_ATTACHMENTS",
    );
    await putObject(db, "order-files", own);
    await q(
      user(o.freelancer),
      "select public.deliver_order($1, 'Hasil', array[$2])",
      [o.orderId, own],
    );
    expect(await order(o.orderId)).toMatchObject({ status: "delivered" });
  });
});

// ---------------------------------------------------------------------------
// RLS and grants
// ---------------------------------------------------------------------------

describe("payments RLS and grants", () => {
  it("payments are visible to the order client and admins only; nobody writes directly", async () => {
    const o = await paidServiceOrder();
    const admin = await createOnboardedUser(db);
    await makeAdmin(db, admin);
    const stranger = await createOnboardedUser(db);
    const sql = "select 1 from public.payments where order_id = $1";
    expect(await count(user(o.client), sql, [o.orderId])).toBe(1);
    expect(await count(user(admin), sql, [o.orderId])).toBe(1);
    expect(await count(user(o.freelancer), sql, [o.orderId])).toBe(0);
    expect(await count(user(stranger), sql, [o.orderId])).toBe(0);
    await expectPgError(q(anon, sql, [o.orderId]), "42501");

    await expectPgError(
      q(
        user(o.client),
        "update public.payments set status = 'paid' where order_id = $1",
        [o.orderId],
      ),
      "42501",
    );
    await expectPgError(
      q(
        user(o.client),
        `insert into public.payments (order_id, attempt_no, midtrans_order_id, gross_amount, status)
         values ($1, 2, 'PJK-000001-2-abcdef12', 10000, 'paid')`,
        [o.orderId],
      ),
      "42501",
    );
  });

  it("payment notifications are admin-readable and written only by the service role", async () => {
    const admin = await createOnboardedUser(db);
    await makeAdmin(db, admin);
    const someone = await createOnboardedUser(db);
    await q(
      service,
      "insert into public.payment_notifications (midtrans_order_id, signature_valid, payload) values ('PJK-1', false, '{}')",
    );
    const sql = "select 1 from public.payment_notifications";
    expect(await count(user(admin), sql)).toBeGreaterThan(0);
    expect(await count(user(someone), sql)).toBe(0);
    await expectPgError(
      q(
        user(someone),
        "insert into public.payment_notifications (signature_valid, payload) values (true, '{}')",
      ),
      "42501",
    );
  });

  it("deliveries are visible to the two parties and admins", async () => {
    const o = await paidServiceOrder();
    await q(user(o.freelancer), "select public.deliver_order($1, 'Hasil')", [
      o.orderId,
    ]);
    const sql = "select 1 from public.order_deliveries where order_id = $1";
    expect(await count(user(o.client), sql, [o.orderId])).toBe(1);
    expect(await count(user(o.freelancer), sql, [o.orderId])).toBe(1);
    expect(
      await count(user(await createOnboardedUser(db)), sql, [o.orderId]),
    ).toBe(0);
    await expectPgError(
      q(
        user(o.freelancer),
        "insert into public.order_deliveries (order_id, freelancer_id, delivery_number, message) values ($1, $2, 9, 'x')",
        [o.orderId, o.freelancer],
      ),
      "42501",
    );
  });
});
