import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import {
  anon,
  as,
  createOnboardedUser,
  createTestDb,
  expectPgError,
  firstCategoryId,
  makeAdmin,
  makeFreelancer,
  putObject,
  service,
  user,
  type Actor,
} from "./harness";

// Phase 7/8 (20261114000000) and its fixes (20261114010000): order messages,
// revisions, disputes, reviews, rating views, auto-completion, order files.

let db: PGlite;
let categoryId: string;

const DESCRIPTION =
  "Desain logo profesional untuk UMKM di Tarakan, termasuk tiga konsep awal.";
const REQUIREMENTS = "Logo untuk kedai kopi bernama Kopi Pesisir.";
const DISPUTE_REASON =
  "Hasil kerja tidak sesuai dengan kebutuhan yang disepakati.";

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

async function orderRow(id: string) {
  return (
    await db.query<{
      status: string;
      revisions_used: number;
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

/** Client + verified freelancer + published service + unpaid service order. */
async function unpaidOrder(opts: { revisions?: number } = {}) {
  const client = await createOnboardedUser(db);
  const freelancer = await createOnboardedUser(db);
  await makeFreelancer(db, freelancer);
  const serviceId = (
    await db.query<{ id: string }>(
      `insert into public.services
         (freelancer_id, category_id, title, description, price, delivery_days,
          revisions_included, cover_image_path, status, published_at)
       values ($1, $2, 'Desain logo UMKM', $3, 150000, 5, $4, $5, 'published', now())
       returning id`,
      [
        freelancer,
        categoryId,
        DESCRIPTION,
        opts.revisions ?? 1,
        `${freelancer}/c.png`,
      ],
    )
  ).rows[0]!.id;
  const orderId = (
    await q<{ id: string }>(
      user(client),
      "select public.create_service_order($1, $2) as id",
      [serviceId, REQUIREMENTS],
    )
  ).rows[0]!.id;
  return { client, freelancer, serviceId, orderId };
}

/** Pays the order through the real payment RPCs (Status API values). */
async function pay(client: string, orderId: string) {
  const p = (
    await q<{ id: string; midtrans_order_id: string }>(
      user(client),
      "select * from public.create_payment_attempt($1)",
      [orderId],
    )
  ).rows[0]!;
  await q(
    service,
    "select public.attach_snap_token($1, 'tok', 'https://app.sandbox.midtrans.com/x', now() + interval '1 hour')",
    [p.id],
  );
  await q(
    service,
    "select public.apply_payment_status($1, 'settlement', null, '200', 150000, 'qris', 'tx-1')",
    [p.midtrans_order_id],
  );
}

async function paidOrder(opts: { revisions?: number } = {}) {
  const o = await unpaidOrder(opts);
  await pay(o.client, o.orderId);
  return o;
}

async function deliver(
  freelancer: string,
  orderId: string,
  file = "hasil.pdf",
) {
  const path = `${orderId}/${freelancer}/${file}`;
  await putObject(db, "order-files", path);
  await q(
    user(freelancer),
    "select public.deliver_order($1, 'Hasil kerja', $2)",
    [orderId, [path]],
  );
  return path;
}

async function deliveredOrder(opts: { revisions?: number } = {}) {
  const o = await paidOrder(opts);
  const path = await deliver(o.freelancer, o.orderId);
  return { ...o, path };
}

async function completedOrder() {
  const o = await deliveredOrder();
  await q(user(o.client), "select public.complete_order($1)", [o.orderId]);
  return o;
}

async function admin() {
  const id = await createOnboardedUser(db);
  await makeAdmin(db, id);
  return id;
}

const message = (
  actor: Actor,
  orderId: string,
  body = "Halo, ada pertanyaan.",
) =>
  q(actor, "select id from public.send_order_message($1, $2)", [orderId, body]);

const review = (
  actor: Actor,
  orderId: string,
  rating: number | null,
  comment: string | null = null,
) =>
  q<{ id: string }>(
    actor,
    "select id from public.create_order_review($1, $2::smallint, $3)",
    [orderId, rating, comment],
  );

// ---------------------------------------------------------------------------
// Order messages (BR-29)
// ---------------------------------------------------------------------------

describe("send_order_message", () => {
  it("is closed before payment, then open to both parties", async () => {
    const o = await unpaidOrder();
    await expectPgError(
      message(user(o.client), o.orderId),
      "PJ409",
      "MESSAGES_NOT_AVAILABLE",
    );

    await pay(o.client, o.orderId);
    await message(user(o.client), o.orderId);
    await message(user(o.freelancer), o.orderId, "Baik, segera saya kerjakan.");
    const r = await db.query<{ sender_id: string; body: string }>(
      "select sender_id, body from public.order_messages where order_id = $1 order by created_at, id",
      [o.orderId],
    );
    expect(r.rows.map((m) => m.sender_id).sort()).toEqual(
      [o.client, o.freelancer].sort(),
    );
  });

  it("stays open while delivered and disputed, and closes after completion or cancellation", async () => {
    const delivered = await deliveredOrder();
    await message(user(delivered.client), delivered.orderId);
    await q(
      user(delivered.client),
      "select public.open_order_dispute($1, $2)",
      [delivered.orderId, DISPUTE_REASON],
    );
    await message(user(delivered.freelancer), delivered.orderId);

    const completed = await completedOrder();
    await expectPgError(
      message(user(completed.client), completed.orderId),
      "PJ409",
      "MESSAGES_CLOSED",
    );

    const cancelled = await paidOrder();
    await q(
      user(cancelled.freelancer),
      "select public.cancel_order($1, 'Tidak sanggup')",
      [cancelled.orderId],
    );
    await expectPgError(
      message(user(cancelled.freelancer), cancelled.orderId),
      "PJ409",
      "MESSAGES_CLOSED",
    );
  });

  it("lets admins post, hides the order from strangers and rejects anon and bad bodies", async () => {
    const o = await paidOrder();
    const adminId = await admin();
    const stranger = await createOnboardedUser(db);

    await message(user(adminId), o.orderId, "Admin: mohon lampirkan bukti.");
    await expectPgError(
      message(user(stranger), o.orderId),
      "PJ404",
      "ORDER_NOT_FOUND",
    );
    await expectPgError(message(anon, o.orderId), "42501");
    await expectPgError(
      message(user(o.client), o.orderId, "   "),
      "PJ422",
      "INVALID_MESSAGE",
    );
    await expectPgError(
      message(user(o.client), o.orderId, "x".repeat(5001)),
      "PJ422",
      "INVALID_MESSAGE",
    );
  });

  it("messages are readable by the parties and admins only and never written directly", async () => {
    const o = await paidOrder();
    const adminId = await admin();
    const stranger = await createOnboardedUser(db);
    await message(user(o.client), o.orderId);

    const sql = "select id from public.order_messages where order_id = $1";
    expect(await count(user(o.client), sql, [o.orderId])).toBe(1);
    expect(await count(user(o.freelancer), sql, [o.orderId])).toBe(1);
    expect(await count(user(adminId), sql, [o.orderId])).toBe(1);
    expect(await count(user(stranger), sql, [o.orderId])).toBe(0);
    await expectPgError(q(anon, sql, [o.orderId]), "42501");

    await expectPgError(
      q(
        user(o.client),
        "insert into public.order_messages (order_id, sender_id, body) values ($1, $2, 'x')",
        [o.orderId, o.client],
      ),
      "42501",
    );
    await expectPgError(
      q(
        user(o.client),
        "update public.order_messages set body = 'diubah' where order_id = $1",
        [o.orderId],
      ),
      "42501",
    );
  });
});

// ---------------------------------------------------------------------------
// Revisions (BR-19)
// ---------------------------------------------------------------------------

describe("request_order_revision", () => {
  it("returns a delivered order to the freelancer and uses up the allowance", async () => {
    const o = await deliveredOrder({ revisions: 1 });
    await expectPgError(
      q(
        user(o.freelancer),
        "select public.request_order_revision($1, 'Tolong ubah warnanya')",
        [o.orderId],
      ),
      "PJ404",
      "ORDER_NOT_FOUND",
    );
    await expectPgError(
      q(user(o.client), "select public.request_order_revision($1, 'pendek')", [
        o.orderId,
      ]),
      "PJ422",
      "INVALID_REVISION_REASON",
    );

    await q(
      user(o.client),
      "select public.request_order_revision($1, 'Tolong ubah warnanya')",
      [o.orderId],
    );
    expect(await orderRow(o.orderId)).toMatchObject({
      status: "in_progress",
      revisions_used: 1,
    });
    expect(await events(o.orderId)).toContain("revision_requested");
    // The reason is also posted to the order thread.
    expect(
      await count(
        user(o.freelancer),
        "select id from public.order_messages where order_id = $1",
        [o.orderId],
      ),
    ).toBe(1);

    // Not delivered any more, then no revisions left after the next delivery.
    await expectPgError(
      q(
        user(o.client),
        "select public.request_order_revision($1, 'Tolong ubah lagi')",
        [o.orderId],
      ),
      "PJ409",
      "ORDER_NOT_DELIVERED",
    );
    await deliver(o.freelancer, o.orderId, "revisi.pdf");
    await expectPgError(
      q(
        user(o.client),
        "select public.request_order_revision($1, 'Tolong ubah lagi')",
        [o.orderId],
      ),
      "PJ409",
      "NO_REVISIONS_REMAINING",
    );
  });
});

// ---------------------------------------------------------------------------
// Disputes (BR-21)
// ---------------------------------------------------------------------------

describe("open_order_dispute", () => {
  it("either party can open one dispute while the order is in progress or delivered", async () => {
    const byFreelancer = await paidOrder();
    const d = await q<{ status: string; opened_by: string }>(
      user(byFreelancer.freelancer),
      "select status, opened_by from public.open_order_dispute($1, $2)",
      [byFreelancer.orderId, DISPUTE_REASON],
    );
    expect(d.rows[0]).toEqual({
      status: "open",
      opened_by: byFreelancer.freelancer,
    });
    expect((await orderRow(byFreelancer.orderId)).status).toBe("disputed");
    expect(await events(byFreelancer.orderId)).toContain("dispute_opened");
    await expectPgError(
      q(user(byFreelancer.client), "select public.open_order_dispute($1, $2)", [
        byFreelancer.orderId,
        DISPUTE_REASON,
      ]),
      "PJ409",
      "ORDER_NOT_DISPUTABLE",
    );

    const byClient = await deliveredOrder();
    await q(user(byClient.client), "select public.open_order_dispute($1, $2)", [
      byClient.orderId,
      DISPUTE_REASON,
    ]);
    expect((await orderRow(byClient.orderId)).status).toBe("disputed");
  });

  it("is refused before payment, after completion, for strangers and with a short reason", async () => {
    const unpaid = await unpaidOrder();
    await expectPgError(
      q(user(unpaid.client), "select public.open_order_dispute($1, $2)", [
        unpaid.orderId,
        DISPUTE_REASON,
      ]),
      "PJ409",
      "ORDER_NOT_DISPUTABLE",
    );
    const completed = await completedOrder();
    await expectPgError(
      q(user(completed.client), "select public.open_order_dispute($1, $2)", [
        completed.orderId,
        DISPUTE_REASON,
      ]),
      "PJ409",
      "ORDER_NOT_DISPUTABLE",
    );
    const paid = await paidOrder();
    const stranger = await createOnboardedUser(db);
    await expectPgError(
      q(user(stranger), "select public.open_order_dispute($1, $2)", [
        paid.orderId,
        DISPUTE_REASON,
      ]),
      "PJ404",
      "ORDER_NOT_FOUND",
    );
    await expectPgError(
      q(
        user(paid.client),
        "select public.open_order_dispute($1, 'terlalu pendek')",
        [paid.orderId],
      ),
      "PJ422",
      "INVALID_DISPUTE_REASON",
    );
  });

  it("freezes the order: no delivery, completion, cancellation or auto-completion", async () => {
    const o = await deliveredOrder();
    await q(user(o.client), "select public.open_order_dispute($1, $2)", [
      o.orderId,
      DISPUTE_REASON,
    ]);
    await expectPgError(
      q(user(o.client), "select public.complete_order($1)", [o.orderId]),
      "PJ409",
      "ORDER_NOT_DELIVERED",
    );
    await expectPgError(
      q(user(o.freelancer), "select public.deliver_order($1, 'lagi', '{}')", [
        o.orderId,
      ]),
      "PJ409",
      "ORDER_NOT_IN_PROGRESS",
    );
    await expectPgError(
      q(user(o.freelancer), "select public.cancel_order($1, 'batal')", [
        o.orderId,
      ]),
      "PJ409",
      "ORDER_NOT_CANCELLABLE",
    );
    await db.query(
      "update public.orders set delivered_at = now() - interval '10 days' where id = $1",
      [o.orderId],
    );
    await q(service, "select public.auto_complete_delivered_orders()");
    expect((await orderRow(o.orderId)).status).toBe("disputed");
  });

  it("disputes are visible to the parties and admins only and never written directly", async () => {
    const o = await paidOrder();
    const adminId = await admin();
    const stranger = await createOnboardedUser(db);
    await q(user(o.client), "select public.open_order_dispute($1, $2)", [
      o.orderId,
      DISPUTE_REASON,
    ]);
    const sql = "select id from public.disputes where order_id = $1";
    expect(await count(user(o.freelancer), sql, [o.orderId])).toBe(1);
    expect(await count(user(adminId), sql, [o.orderId])).toBe(1);
    expect(await count(user(stranger), sql, [o.orderId])).toBe(0);
    await expectPgError(
      q(
        user(o.client),
        "update public.disputes set status = 'resolved' where order_id = $1",
        [o.orderId],
      ),
      "42501",
    );
  });
});

// ---------------------------------------------------------------------------
// Auto-completion (BR-18)
// ---------------------------------------------------------------------------

describe("auto_complete_delivered_orders", () => {
  it("completes deliveries older than 3 days (payout pending) and is service-role only", async () => {
    const old = await deliveredOrder();
    const recent = await deliveredOrder();
    await db.query(
      "update public.orders set delivered_at = now() - interval '3 days 1 minute' where id = $1",
      [old.orderId],
    );

    await expectPgError(
      q(user(old.client), "select public.auto_complete_delivered_orders()"),
      "42501",
    );
    const r = await q<{ n: number }>(
      service,
      "select public.auto_complete_delivered_orders() as n",
    );
    expect(r.rows[0]!.n).toBeGreaterThanOrEqual(1);

    expect(await orderRow(old.orderId)).toMatchObject({
      status: "completed",
      payout_status: "pending",
    });
    expect(await events(old.orderId)).toContain("auto_completed");
    expect((await orderRow(recent.orderId)).status).toBe("delivered");
  });
});

// ---------------------------------------------------------------------------
// Reviews (BR-22) and rating views (DATABASE §4.19)
// ---------------------------------------------------------------------------

describe("create_order_review", () => {
  it("lets each party review the other once after completion", async () => {
    const o = await completedOrder();
    await review(user(o.client), o.orderId, 5, "Cepat dan rapi.");
    await review(user(o.freelancer), o.orderId, 4);

    const r = await db.query<{
      reviewer_role: string;
      reviewee_id: string;
      service_id: string | null;
    }>(
      "select reviewer_role, reviewee_id, service_id from public.reviews where order_id = $1 order by reviewer_role",
      [o.orderId],
    );
    expect(r.rows).toEqual([
      {
        reviewer_role: "client",
        reviewee_id: o.freelancer,
        service_id: o.serviceId,
      },
      { reviewer_role: "freelancer", reviewee_id: o.client, service_id: null },
    ]);
    await expectPgError(
      review(user(o.client), o.orderId, 3),
      "PJ409",
      "ALREADY_REVIEWED",
    );
  });

  it("is refused before completion, after 14 days, for strangers and with invalid input", async () => {
    const delivered = await deliveredOrder();
    await expectPgError(
      review(user(delivered.client), delivered.orderId, 5),
      "PJ409",
      "REVIEW_WINDOW_CLOSED",
    );

    const o = await completedOrder();
    const stranger = await createOnboardedUser(db);
    await expectPgError(
      review(user(stranger), o.orderId, 5),
      "PJ404",
      "ORDER_NOT_FOUND",
    );
    await expectPgError(review(anon, o.orderId, 5), "42501");
    await expectPgError(
      review(user(o.client), o.orderId, 0),
      "PJ422",
      "INVALID_RATING",
    );
    await expectPgError(
      review(user(o.client), o.orderId, 6),
      "PJ422",
      "INVALID_RATING",
    );
    await expectPgError(
      review(user(o.client), o.orderId, null),
      "PJ422",
      "INVALID_RATING",
    );
    await expectPgError(
      review(user(o.client), o.orderId, 5, "x".repeat(2001)),
      "PJ422",
      "INVALID_REVIEW_COMMENT",
    );

    await db.query(
      "update public.orders set completed_at = now() - interval '15 days' where id = $1",
      [o.orderId],
    );
    await expectPgError(
      review(user(o.client), o.orderId, 5),
      "PJ409",
      "REVIEW_WINDOW_CLOSED",
    );
  });

  it("reviews are public (including anon) and immutable", async () => {
    const o = await completedOrder();
    const { id } = (await review(user(o.client), o.orderId, 5, "Mantap."))
      .rows[0]!;

    expect(
      await count(anon, "select id from public.reviews where id = $1", [id]),
    ).toBe(1);
    expect(
      await count(
        user(o.freelancer),
        "select id from public.reviews where id = $1",
        [id],
      ),
    ).toBe(1);

    await expectPgError(
      q(user(o.client), "update public.reviews set rating = 1 where id = $1", [
        id,
      ]),
      "42501",
    );
    await expectPgError(
      q(user(o.client), "delete from public.reviews where id = $1", [id]),
      "42501",
    );
    await expectPgError(
      q(
        user(o.client),
        "insert into public.reviews (order_id, reviewer_id, reviewee_id, reviewer_role, rating) values ($1, $2, $3, 'client', 5)",
        [o.orderId, o.client, o.freelancer],
      ),
      "42501",
    );
  });
});

describe("rating views", () => {
  it("aggregate freelancer, client and service ratings and are readable by anon", async () => {
    const first = await completedOrder();
    await review(user(first.client), first.orderId, 5);
    await review(user(first.freelancer), first.orderId, 3);

    // A second order of the same service, by another client.
    const client2 = await createOnboardedUser(db);
    const order2 = (
      await q<{ id: string }>(
        user(client2),
        "select public.create_service_order($1, $2) as id",
        [first.serviceId, REQUIREMENTS],
      )
    ).rows[0]!.id;
    await pay(client2, order2);
    await deliver(first.freelancer, order2);
    await q(user(client2), "select public.complete_order($1)", [order2]);
    await review(user(client2), order2, 4);

    const freelancerStats = await q<{
      rating_avg: string;
      rating_count: number;
    }>(
      anon,
      "select rating_avg, rating_count from public.freelancer_rating_stats where user_id = $1",
      [first.freelancer],
    );
    expect(freelancerStats.rows[0]).toMatchObject({ rating_count: 2 });
    expect(Number(freelancerStats.rows[0]!.rating_avg)).toBe(4.5);

    const clientStats = await q<{ rating_avg: string; rating_count: number }>(
      anon,
      "select rating_avg, rating_count from public.client_rating_stats where user_id = $1",
      [first.client],
    );
    expect(clientStats.rows[0]).toMatchObject({ rating_count: 1 });
    expect(Number(clientStats.rows[0]!.rating_avg)).toBe(3);

    const serviceStats = await q<{ rating_avg: string; rating_count: number }>(
      anon,
      "select rating_avg, rating_count from public.service_rating_stats where service_id = $1",
      [first.serviceId],
    );
    expect(serviceStats.rows[0]).toMatchObject({ rating_count: 2 });
    expect(Number(serviceStats.rows[0]!.rating_avg)).toBe(4.5);

    const listing = await q<{ rating_avg: string; rating_count: number }>(
      anon,
      "select rating_avg, rating_count from public.service_listings where id = $1",
      [first.serviceId],
    );
    expect(listing.rows[0]).toMatchObject({ rating_count: 2 });
    expect(Number(listing.rows[0]!.rating_avg)).toBe(4.5);
  });

  it("lists unrated services with a zero rating", async () => {
    const o = await unpaidOrder();
    const listing = await q<{ rating_avg: string; rating_count: number }>(
      anon,
      "select rating_avg, rating_count from public.service_listings where id = $1",
      [o.serviceId],
    );
    expect(listing.rows[0]).toMatchObject({ rating_count: 0 });
    expect(Number(listing.rows[0]!.rating_avg)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// order-files storage (DATABASE §11.2)
// ---------------------------------------------------------------------------

describe("order-files bucket policies", () => {
  const insert = (actor: Actor, name: string) =>
    q(
      actor,
      "insert into storage.objects (bucket_id, name) values ('order-files', $1)",
      [name],
    );

  it("only the order's freelancer uploads, into their own folder, while in progress", async () => {
    const o = await paidOrder();
    await insert(user(o.freelancer), `${o.orderId}/${o.freelancer}/draft.pdf`);
    await expectPgError(
      insert(user(o.client), `${o.orderId}/${o.client}/x.pdf`),
      "42501",
    );
    await expectPgError(
      insert(user(o.freelancer), `${o.orderId}/${o.client}/x.pdf`),
      "42501",
    );
    await expectPgError(
      insert(anon, `${o.orderId}/${o.freelancer}/x.pdf`),
      "42501",
    );

    const other = await paidOrder();
    await expectPgError(
      insert(user(o.freelancer), `${other.orderId}/${o.freelancer}/x.pdf`),
      "42501",
    );

    const unpaid = await unpaidOrder();
    await expectPgError(
      insert(
        user(unpaid.freelancer),
        `${unpaid.orderId}/${unpaid.freelancer}/x.pdf`,
      ),
      "42501",
    );
    await expectPgError(
      insert(user(o.freelancer), `not-a-uuid/${o.freelancer}/x.pdf`),
      "42501",
    );
  });

  it("files are readable by the parties and admins only", async () => {
    const o = await deliveredOrder();
    const adminId = await admin();
    const stranger = await createOnboardedUser(db);
    const sql =
      "select name from storage.objects where bucket_id = 'order-files' and name = $1";
    expect(await count(user(o.client), sql, [o.path])).toBe(1);
    expect(await count(user(o.freelancer), sql, [o.path])).toBe(1);
    expect(await count(user(adminId), sql, [o.path])).toBe(1);
    expect(await count(user(stranger), sql, [o.path])).toBe(0);
    expect(await count(anon, sql, [o.path])).toBe(0);
  });

  it("delivered files are immutable evidence: nobody deletes or overwrites them", async () => {
    const o = await deliveredOrder();
    for (const actor of [user(o.freelancer), user(o.client)]) {
      const deleted = await q(
        actor,
        "delete from storage.objects where bucket_id = 'order-files' and name = $1 returning name",
        [o.path],
      );
      expect(deleted.rows).toEqual([]);
      const updated = await q(
        actor,
        "update storage.objects set name = name || '.x' where bucket_id = 'order-files' and name = $1 returning name",
        [o.path],
      );
      expect(updated.rows).toEqual([]);
    }
    const r = await db.query(
      "select 1 from storage.objects where bucket_id = 'order-files' and name = $1",
      [o.path],
    );
    expect(r.rows).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Storage paths in direct writes (defence in depth, 20261114010000)
// ---------------------------------------------------------------------------

describe("storage path constraints", () => {
  it("a service cover must be inside the freelancer's own folder", async () => {
    const f = await createOnboardedUser(db);
    await makeFreelancer(db, f);
    const insertService = (cover: string | null) =>
      q<{ id: string }>(
        user(f),
        `insert into public.services
           (freelancer_id, category_id, title, description, price, delivery_days, revisions_included, cover_image_path)
         values ($1, $2, 'Desain logo UMKM', $3, 50000, 3, 1, $4) returning id`,
        [f, categoryId, DESCRIPTION, cover],
      );

    await expectPgError(insertService("someone-else/a.png"), "23514");
    await expectPgError(insertService(`${f}/../other/a.png`), "23514");
    const { id } = (await insertService(null)).rows[0]!;
    await q(
      user(f),
      "update public.services set cover_image_path = $2 where id = $1",
      [id, `${f}/cover.webp`],
    );
    await expectPgError(
      q(
        user(f),
        "update public.services set cover_image_path = 'x/y.png' where id = $1",
        [id],
      ),
      "23514",
    );
  });

  it("portfolio images must be inside the freelancer's own folder", async () => {
    const f = await createOnboardedUser(db);
    await makeFreelancer(db, f);
    const insertItem = (paths: string[]) =>
      q(
        user(f),
        "insert into public.portfolio_items (freelancer_id, title, image_paths) values ($1, 'Karya', $2)",
        [f, paths],
      );
    await insertItem([`${f}/a.png`, `${f}/b.jpg`]);
    await insertItem([]);
    await expectPgError(
      insertItem([`${f}/a.png`, "other-user/b.png"]),
      "23514",
    );
    await expectPgError(insertItem([`${f}/../../x.png`]), "23514");
  });
});

// ---------------------------------------------------------------------------
// Phase 9: admin money operations (20261114020000)
// ---------------------------------------------------------------------------

describe("admin money operations (Phase 9)", () => {
  async function admin() {
    const id = await createOnboardedUser(db);
    await makeAdmin(db, id);
    return id;
  }

  async function disputedOrder() {
    const o = await paidOrder();
    await deliver(o.freelancer, o.orderId);
    const disputeId = (
      await q<{ id: string }>(
        user(o.client),
        "select id from public.open_order_dispute($1, $2)",
        [o.orderId, DISPUTE_REASON],
      )
    ).rows[0]!.id;
    return { ...o, disputeId };
  }

  const resolve = (
    actor: Actor,
    disputeId: string,
    resolution: string,
    note = "Bukti percakapan sudah ditinjau.",
  ) =>
    q<{ status: string; resolution: string }>(
      actor,
      "select status, resolution from public.resolve_dispute($1, $2, $3)",
      [disputeId, resolution, note],
    );

  const refundStatus = async (orderId: string) =>
    (
      await db.query<{ id: string; status: string; refund_status: string }>(
        "select id, status, refund_status from public.payments where order_id = $1 and refund_status <> 'none'",
        [orderId],
      )
    ).rows;

  it("release_to_freelancer completes the order with payout pending", async () => {
    const o = await disputedOrder();
    const a = await admin();
    const r = await resolve(user(a), o.disputeId, "release_to_freelancer");
    expect(r.rows[0]).toEqual({
      status: "resolved",
      resolution: "release_to_freelancer",
    });
    const order = await orderRow(o.orderId);
    expect(order.status).toBe("completed");
    expect(order.payout_status).toBe("pending");
    expect(order.completed_at).not.toBeNull();
    expect((await events(o.orderId)).at(-1)).toBe("dispute_resolved");
    // Completed through the dispute: both parties may now review.
    await q(
      user(o.client),
      "select public.create_order_review($1, 5::smallint)",
      [o.orderId],
    );
  });

  it("refund_client cancels the order and marks the paid payment refund pending", async () => {
    const o = await disputedOrder();
    const a = await admin();
    await resolve(user(a), o.disputeId, "refund_client");
    const order = await db.query<{
      status: string;
      cancelled_by: string;
      cancellation_reason: string;
      payout_status: string;
    }>("select * from public.orders where id = $1", [o.orderId]);
    expect(order.rows[0]).toMatchObject({
      status: "cancelled",
      cancelled_by: a,
      cancellation_reason: "dispute_refund",
      payout_status: "none",
    });
    expect(await refundStatus(o.orderId)).toMatchObject([
      { status: "paid", refund_status: "pending" },
    ]);
    expect(await events(o.orderId)).toEqual(
      expect.arrayContaining(["cancelled", "dispute_resolved"]),
    );
  });

  it("only admins resolve, once, with a note", async () => {
    const o = await disputedOrder();
    const a = await admin();
    await expectPgError(
      resolve(user(o.client), o.disputeId, "refund_client"),
      "PJ403",
      "FORBIDDEN",
    );
    await expectPgError(
      resolve(user(o.freelancer), o.disputeId, "release_to_freelancer"),
      "PJ403",
      "FORBIDDEN",
    );
    await expectPgError(resolve(anon, o.disputeId, "refund_client"), "42501");
    await expectPgError(
      resolve(user(a), o.disputeId, "refund_client", "   "),
      "PJ422",
      "INVALID_ADMIN_NOTE",
    );
    await expectPgError(
      resolve(user(a), "00000000-0000-4000-8000-000000000000", "refund_client"),
      "PJ404",
      "DISPUTE_NOT_FOUND",
    );
    await resolve(user(a), o.disputeId, "release_to_freelancer");
    await expectPgError(
      resolve(user(a), o.disputeId, "refund_client"),
      "PJ409",
      "DISPUTE_NOT_OPEN",
    );
  });

  it("mark_refund_completed closes a pending refund once, admins only", async () => {
    const o = await disputedOrder();
    const a = await admin();
    await resolve(user(a), o.disputeId, "refund_client");
    const paymentId = (await refundStatus(o.orderId))[0]!.id;
    const mark = (actor: Actor, ref = "Refund Midtrans 2026-11-14") =>
      q<{ status: string; refund_status: string; refund_reference: string }>(
        actor,
        "select status, refund_status, refund_reference from public.mark_refund_completed($1, $2)",
        [paymentId, ref],
      );

    await expectPgError(mark(user(o.client)), "PJ403", "FORBIDDEN");
    await expectPgError(mark(anon), "42501");
    await expectPgError(mark(user(a), ""), "PJ422", "INVALID_REFERENCE");
    expect((await mark(user(a))).rows[0]).toEqual({
      status: "refunded",
      refund_status: "refunded",
      refund_reference: "Refund Midtrans 2026-11-14",
    });
    await expectPgError(mark(user(a)), "PJ409", "REFUND_NOT_PENDING");
    expect((await events(o.orderId)).at(-1)).toBe("refund_marked");
  });

  it("mark_payout_paid closes a pending payout once, admins only", async () => {
    const o = await paidOrder();
    await deliver(o.freelancer, o.orderId);
    const a = await admin();
    const mark = (actor: Actor, ref = "Transfer BCA 123") =>
      q<{ payout_status: string; payout_reference: string }>(
        actor,
        "select payout_status, payout_reference from public.mark_payout_paid($1, $2)",
        [o.orderId, ref],
      );

    // Not completed yet.
    await expectPgError(mark(user(a)), "PJ409", "PAYOUT_NOT_PENDING");
    await q(user(o.client), "select public.complete_order($1)", [o.orderId]);

    await expectPgError(mark(user(o.freelancer)), "PJ403", "FORBIDDEN");
    await expectPgError(mark(anon), "42501");
    await expectPgError(mark(user(a), " "), "PJ422", "INVALID_REFERENCE");
    expect((await mark(user(a))).rows[0]).toEqual({
      payout_status: "paid",
      payout_reference: "Transfer BCA 123",
    });
    await expectPgError(mark(user(a)), "PJ409", "PAYOUT_NOT_PENDING");
    expect((await events(o.orderId)).at(-1)).toBe("payout_marked");
  });

  it("caps order-files at 50 objects per order", async () => {
    const o = await paidOrder();
    for (let i = 0; i < 49; i += 1) {
      await putObject(
        db,
        "order-files",
        `${o.orderId}/${o.freelancer}/f${i}.pdf`,
      );
    }
    const insert = (name: string) =>
      q(
        user(o.freelancer),
        "insert into storage.objects (bucket_id, name) values ('order-files', $1)",
        [name],
      );
    await insert(`${o.orderId}/${o.freelancer}/f49.pdf`);
    await expectPgError(
      insert(`${o.orderId}/${o.freelancer}/f50.pdf`),
      "42501",
    );
  });
});
