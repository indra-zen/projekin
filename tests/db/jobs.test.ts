import type { PGlite, Transaction } from "@electric-sql/pglite";
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
  user,
  type Actor,
} from "./harness";

let db: PGlite;
let categoryId: string;

const DESCRIPTION =
  "Kami membutuhkan landing page untuk usaha kuliner di Tarakan, responsif.";
const COVER =
  "Saya mahasiswa Sistem Informasi dan sudah membuat beberapa landing page serupa.";

beforeAll(async () => {
  db = await createTestDb();
  categoryId = await firstCategoryId(db);
});

async function freelancer(): Promise<string> {
  const id = await createOnboardedUser(db);
  await makeFreelancer(db, id);
  return id;
}

function insertJob(
  tx: Transaction,
  client: string,
  extra: {
    deadline?: string | null;
    budgetMin?: number;
    budgetMax?: number;
  } = {},
) {
  return tx.query<{ id: string }>(
    `insert into public.jobs (client_id, category_id, title, description, requirements, budget_min, budget_max, deadline)
     values ($1, $2, 'Landing page usaha kuliner', $3, 'Gunakan Next.js', $4, $5, $6) returning id`,
    [
      client,
      categoryId,
      DESCRIPTION,
      extra.budgetMin ?? 500000,
      extra.budgetMax ?? 1500000,
      extra.deadline ?? null,
    ],
  );
}

async function createJob(client: string): Promise<string> {
  const r = await as(db, user(client), (tx) => insertJob(tx, client));
  return r.rows[0]!.id;
}

async function propose(
  actor: string,
  jobId: string,
  price = 1000000,
): Promise<string> {
  const r = await as(db, user(actor), (tx) =>
    tx.query<{ id: string }>(
      "select id from public.submit_proposal($1, $2, $3, 7, 1)",
      [jobId, COVER, price],
    ),
  );
  return r.rows[0]!.id;
}

const rpc = <T extends Record<string, unknown>>(
  actor: string,
  sql: string,
  params: unknown[],
) => as(db, user(actor), (tx) => tx.query<T>(sql, params));

async function accept(actor: string, proposalId: string): Promise<string> {
  const r = await rpc<{ order_id: string }>(
    actor,
    "select public.accept_proposal($1) as order_id",
    [proposalId],
  );
  return r.rows[0]!.order_id;
}

async function jobStatus(id: string) {
  return (
    await db.query<{ status: string }>(
      "select status from public.jobs where id = $1",
      [id],
    )
  ).rows[0]!.status;
}

async function proposalStatus(id: string) {
  return (
    await db.query<{ status: string; status_reason: string | null }>(
      "select status, status_reason from public.proposals where id = $1",
      [id],
    )
  ).rows[0]!;
}

const count = async (actor: Actor, sql: string, params: unknown[]) =>
  (await as(db, actor, (tx) => tx.query(sql, params))).rows.length;

describe("jobs: create and edit", () => {
  it("onboarded clients (students or not) create jobs; others cannot", async () => {
    const client = await createOnboardedUser(db);
    expect(await createJob(client)).toBeTruthy();

    const notOnboarded = await createUser(db);
    await expectPgError(
      as(db, user(notOnboarded), (tx) => insertJob(tx, notOnboarded)),
      "42501",
    );

    const impersonator = await createOnboardedUser(db);
    await expectPgError(
      as(db, user(impersonator), (tx) => insertJob(tx, client)),
      "42501",
    );

    await expectPgError(
      as(db, anon, (tx) => insertJob(tx, client)),
      "42501",
    );
  });

  it("validates deadline and budget", async () => {
    const client = await createOnboardedUser(db);
    await expectPgError(
      as(db, user(client), (tx) =>
        insertJob(tx, client, { deadline: "2000-01-01" }),
      ),
      "42501",
    );
    await expectPgError(
      as(db, user(client), (tx) =>
        insertJob(tx, client, { budgetMin: 2000000, budgetMax: 1000000 }),
      ),
      "23514",
    );
    await expectPgError(
      as(db, user(client), (tx) => insertJob(tx, client, { budgetMin: 5000 })),
      "23514",
    );
  });

  it("limits active jobs per client (BR-13: 10)", async () => {
    const client = await createOnboardedUser(db);
    for (let i = 0; i < 10; i += 1) await createJob(client);
    await expectPgError(
      as(db, user(client), (tx) => insertJob(tx, client)),
      "42501",
    );
  });

  it("does not let clients set status or other protected columns directly", async () => {
    const client = await createOnboardedUser(db);
    const job = await createJob(client);
    for (const assignment of [
      "status = 'filled'",
      "client_id = client_id",
      "closed_at = now()",
    ]) {
      await expectPgError(
        rpc(client, `update public.jobs set ${assignment} where id = $1`, [
          job,
        ]),
        "42501",
      );
    }
  });

  it("owners edit open jobs without proposals only (BR-30)", async () => {
    const client = await createOnboardedUser(db);
    const stranger = await createOnboardedUser(db);
    const job = await createJob(client);

    const strangerEdit = await rpc(
      stranger,
      "update public.jobs set title = 'Diretas oleh orang lain' where id = $1",
      [job],
    );
    expect(strangerEdit.affectedRows).toBe(0);

    const ownEdit = await rpc(
      client,
      "update public.jobs set title = 'Landing page kuliner v2' where id = $1",
      [job],
    );
    expect(ownEdit.affectedRows).toBe(1);

    await propose(await freelancer(), job);
    const afterProposal = await rpc(
      client,
      "update public.jobs set title = 'Landing page kuliner v3' where id = $1",
      [job],
    );
    expect(afterProposal.affectedRows).toBe(0);
  });
});

describe("jobs: visibility", () => {
  it("open jobs are public; closed jobs only for owner, proposers and admins", async () => {
    const client = await createOnboardedUser(db);
    const proposer = await freelancer();
    const stranger = await createOnboardedUser(db);
    const admin = await createOnboardedUser(db);
    await makeAdmin(db, admin);
    const job = await createJob(client);
    await propose(proposer, job);

    const sql = "select id from public.jobs where id = $1";
    expect(await count(anon, sql, [job])).toBe(1);

    await rpc(client, "select public.close_job($1, 'Tidak jadi')", [job]);
    expect(await count(anon, sql, [job])).toBe(0);
    expect(await count(user(stranger), sql, [job])).toBe(0);
    expect(await count(user(client), sql, [job])).toBe(1);
    expect(await count(user(proposer), sql, [job])).toBe(1);
    expect(await count(user(admin), sql, [job])).toBe(1);
  });
});

describe("close_job", () => {
  it("only the owner (or an admin) closes an open job; submitted proposals are rejected", async () => {
    const client = await createOnboardedUser(db);
    const stranger = await createOnboardedUser(db);
    const job = await createJob(client);
    const proposal = await propose(await freelancer(), job);

    await expectPgError(
      rpc(stranger, "select public.close_job($1)", [job]),
      "PJ403",
      "NOT_JOB_OWNER",
    );
    await rpc(
      client,
      "select public.close_job($1, 'Sudah menemukan solusi lain')",
      [job],
    );
    expect(await jobStatus(job)).toBe("closed");
    expect(await proposalStatus(proposal)).toEqual({
      status: "rejected",
      status_reason: "job_closed",
    });
    await expectPgError(
      rpc(client, "select public.close_job($1)", [job]),
      "PJ409",
      "JOB_NOT_OPEN",
    );

    const admin = await createOnboardedUser(db);
    await makeAdmin(db, admin);
    const other = await createJob(client);
    await rpc(admin, "select public.close_job($1, 'Melanggar ketentuan')", [
      other,
    ]);
    expect(await jobStatus(other)).toBe("closed");
  });
});

describe("submit_proposal", () => {
  it("only verified students can propose", async () => {
    const job = await createJob(await createOnboardedUser(db));
    const unverified = await createOnboardedUser(db);
    await expectPgError(
      propose(unverified, job),
      "PJ403",
      "FREELANCER_NOT_ELIGIBLE",
    );

    const expired = await createOnboardedUser(db);
    await makeFreelancer(db, expired, {
      verifiedUntil: "2000-01-01T00:00:00Z",
    });
    await expectPgError(
      propose(expired, job),
      "PJ403",
      "FREELANCER_NOT_ELIGIBLE",
    );

    const suspended = await createOnboardedUser(db);
    await makeFreelancer(db, suspended, { status: "suspended" });
    await expectPgError(
      propose(suspended, job),
      "PJ403",
      "FREELANCER_NOT_ELIGIBLE",
    );
  });

  it("clients cannot propose on their own job", async () => {
    const studentClient = await freelancer();
    const job = await createJob(studentClient);
    await expectPgError(propose(studentClient, job), "PJ403", "OWN_JOB");
  });

  it("prevents duplicates, including after withdrawal (BR-14)", async () => {
    const job = await createJob(await createOnboardedUser(db));
    const f = await freelancer();
    const first = await propose(f, job);
    await expectPgError(propose(f, job), "PJ409", "ALREADY_PROPOSED");
    await rpc(f, "select public.withdraw_proposal($1)", [first]);
    await expectPgError(propose(f, job), "PJ409", "ALREADY_PROPOSED");
  });

  it("closed and hiring jobs do not accept proposals", async () => {
    const client = await createOnboardedUser(db);
    const closed = await createJob(client);
    await rpc(client, "select public.close_job($1)", [closed]);
    await expectPgError(
      propose(await freelancer(), closed),
      "PJ409",
      "JOB_NOT_OPEN",
    );

    const hiring = await createJob(client);
    await accept(client, await propose(await freelancer(), hiring));
    await expectPgError(
      propose(await freelancer(), hiring),
      "PJ409",
      "JOB_NOT_OPEN",
    );
  });

  it("validates input server-side", async () => {
    const job = await createJob(await createOnboardedUser(db));
    const f = await freelancer();
    await expectPgError(
      rpc(
        f,
        "select public.submit_proposal($1, 'terlalu pendek', 100000, 7, 1)",
        [job],
      ),
      "PJ422",
      "INVALID_COVER_LETTER",
    );
    await expectPgError(
      rpc(f, "select public.submit_proposal($1, $2, 5000, 7, 1)", [job, COVER]),
      "PJ422",
      "INVALID_PRICE",
    );
    await expectPgError(
      rpc(f, "select public.submit_proposal($1, $2, 100000, 0, 1)", [
        job,
        COVER,
      ]),
      "PJ422",
      "INVALID_DELIVERY_DAYS",
    );
    await expectPgError(
      rpc(f, "select public.submit_proposal($1, $2, 100000, 7, 9)", [
        job,
        COVER,
      ]),
      "PJ422",
      "INVALID_REVISIONS",
    );
    await expectPgError(
      rpc(
        f,
        "select public.submit_proposal(gen_random_uuid(), $1, 100000, 7, 1)",
        [COVER],
      ),
      "PJ404",
      "JOB_NOT_FOUND",
    );
  });

  it("limits proposals per 24 hours (BR-14: 30)", async () => {
    const f = await freelancer();
    const client = await createOnboardedUser(db);
    const jobs = await db.query<{ id: string }>(
      `insert into public.jobs (client_id, category_id, title, description, budget_min, budget_max)
       select $1, $2, 'Pekerjaan uji batas', $3, 100000, 200000 from generate_series(1, 31) returning id`,
      [client, categoryId, DESCRIPTION],
    );
    for (const job of jobs.rows.slice(0, 30)) {
      await db.query(
        "insert into public.proposals (job_id, freelancer_id, cover_letter, price, delivery_days, revisions_included) values ($1, $2, $3, 100000, 3, 0)",
        [job.id, f, COVER],
      );
    }
    await expectPgError(
      propose(f, jobs.rows[30]!.id),
      "PJ409",
      "MAX_PROPOSALS_PER_DAY",
    );
  });

  it("proposals cannot be written directly", async () => {
    const job = await createJob(await createOnboardedUser(db));
    const f = await freelancer();
    await expectPgError(
      rpc(
        f,
        "insert into public.proposals (job_id, freelancer_id, cover_letter, price, delivery_days, revisions_included) values ($1, $2, $3, 100000, 3, 0)",
        [job, f, COVER],
      ),
      "42501",
    );
    const id = await propose(f, job);
    await expectPgError(
      rpc(f, "update public.proposals set status = 'accepted' where id = $1", [
        id,
      ]),
      "42501",
    );
  });
});

describe("proposal visibility", () => {
  it("is limited to the freelancer, the job owner and admins", async () => {
    const client = await createOnboardedUser(db);
    const f = await freelancer();
    const other = await freelancer();
    const admin = await createOnboardedUser(db);
    await makeAdmin(db, admin);
    const job = await createJob(client);
    const id = await propose(f, job);
    await propose(other, job);

    const sql = "select id from public.proposals where id = $1";
    expect(await count(user(f), sql, [id])).toBe(1);
    expect(await count(user(client), sql, [id])).toBe(1);
    expect(await count(user(admin), sql, [id])).toBe(1);
    expect(await count(user(other), sql, [id])).toBe(0);
    await expectPgError(
      as(db, anon, (tx) => tx.query(sql, [id])),
      "42501",
    );
  });
});

describe("withdraw_proposal and reject_proposal", () => {
  it("withdraw: only the proposer, only while submitted", async () => {
    const job = await createJob(await createOnboardedUser(db));
    const f = await freelancer();
    const id = await propose(f, job);
    await expectPgError(
      rpc(await freelancer(), "select public.withdraw_proposal($1)", [id]),
      "PJ404",
    );
    await rpc(f, "select public.withdraw_proposal($1)", [id]);
    expect((await proposalStatus(id)).status).toBe("withdrawn");
    await expectPgError(
      rpc(f, "select public.withdraw_proposal($1)", [id]),
      "PJ409",
      "PROPOSAL_NOT_SUBMITTED",
    );
  });

  it("reject: only the job owner, only while submitted", async () => {
    const client = await createOnboardedUser(db);
    const job = await createJob(client);
    const f = await freelancer();
    const id = await propose(f, job);
    await expectPgError(
      rpc(f, "select public.reject_proposal($1)", [id]),
      "PJ403",
      "NOT_JOB_OWNER",
    );
    await rpc(
      client,
      "select public.reject_proposal($1, 'Anggaran tidak sesuai')",
      [id],
    );
    expect(await proposalStatus(id)).toEqual({
      status: "rejected",
      status_reason: "Anggaran tidak sesuai",
    });
    await expectPgError(
      rpc(client, "select public.reject_proposal($1)", [id]),
      "PJ409",
      "PROPOSAL_NOT_SUBMITTED",
    );
  });
});

describe("accept_proposal (hiring creates a unified order)", () => {
  it("only the job owner can accept", async () => {
    const client = await createOnboardedUser(db);
    const job = await createJob(client);
    const f = await freelancer();
    const id = await propose(f, job);
    const admin = await createOnboardedUser(db);
    await makeAdmin(db, admin);
    for (const actor of [f, admin, await createOnboardedUser(db)]) {
      await expectPgError(accept(actor, id), "PJ403", "NOT_JOB_OWNER");
    }
  });

  it("atomically accepts, moves the job to hiring and creates the order", async () => {
    const client = await createOnboardedUser(db);
    const job = await createJob(client);
    const f = await freelancer();
    const id = await propose(f, job, 1000000);
    const orderId = await accept(client, id);

    expect(await jobStatus(job)).toBe("hiring");
    expect((await proposalStatus(id)).status).toBe("accepted");

    const order = await db.query<Record<string, unknown>>(
      "select * from public.orders where id = $1",
      [orderId],
    );
    expect(order.rows[0]).toMatchObject({
      source: "job",
      job_id: job,
      proposal_id: id,
      client_id: client,
      freelancer_id: f,
      title: "Landing page usaha kuliner",
      brief: DESCRIPTION,
      requirements: "Gunakan Next.js",
      amount: 1000000,
      platform_fee: 100000,
      freelancer_earnings: 900000,
      delivery_days: 7,
      revisions_allowed: 1,
      status: "awaiting_payment",
      payout_status: "none",
    });
    const dueInHours =
      ((order.rows[0]!.payment_due_at as Date).getTime() - Date.now()) /
      3_600_000;
    expect(dueInHours).toBeGreaterThan(23.9);
    expect(dueInHours).toBeLessThanOrEqual(24);

    const events = await db.query<{ event_type: string; actor_id: string }>(
      "select event_type, actor_id from public.order_events where order_id = $1",
      [orderId],
    );
    expect(events.rows).toEqual([{ event_type: "created", actor_id: client }]);
  });

  it("rounds the platform fee down to whole rupiah (BR-09)", async () => {
    const client = await createOnboardedUser(db);
    const orderId = await accept(
      client,
      await propose(await freelancer(), await createJob(client), 10009),
    );
    const r = await db.query<{
      platform_fee: number;
      freelancer_earnings: number;
    }>(
      "select platform_fee, freelancer_earnings from public.orders where id = $1",
      [orderId],
    );
    expect(r.rows[0]).toEqual({
      platform_fee: 1000,
      freelancer_earnings: 9009,
    });
  });

  it("prevents conflicting hires on the same job", async () => {
    const client = await createOnboardedUser(db);
    const job = await createJob(client);
    const a = await propose(await freelancer(), job);
    const b = await propose(await freelancer(), job);
    await accept(client, a);
    await expectPgError(accept(client, b), "PJ409", "JOB_NOT_OPEN");
    await expectPgError(accept(client, a), "PJ409", "JOB_NOT_OPEN");

    // Database backstop even if application logic were bypassed.
    const proposal = await db.query<{ freelancer_id: string }>(
      "select freelancer_id from public.proposals where id = $1",
      [b],
    );
    await expectPgError(
      db.query(
        `insert into public.orders (source, job_id, proposal_id, client_id, freelancer_id, title, brief, amount, platform_fee, freelancer_earnings, delivery_days, revisions_allowed, payment_due_at)
         values ('job', $1, $2, $3, $4, 't', 'b', 100000, 10000, 90000, 3, 0, now())`,
        [job, b, client, proposal.rows[0]!.freelancer_id],
      ),
      "23505",
    );
  });

  it("refuses withdrawn proposals and freelancers who lost eligibility", async () => {
    const client = await createOnboardedUser(db);
    const job = await createJob(client);
    const withdrawer = await freelancer();
    const withdrawn = await propose(withdrawer, job);
    await rpc(withdrawer, "select public.withdraw_proposal($1)", [withdrawn]);
    await expectPgError(
      accept(client, withdrawn),
      "PJ409",
      "PROPOSAL_NOT_SUBMITTED",
    );

    const lapsed = await freelancer();
    const id = await propose(lapsed, job);
    await makeFreelancer(db, lapsed, { verifiedUntil: "2000-01-01T00:00:00Z" });
    await expectPgError(accept(client, id), "PJ403", "FREELANCER_NOT_ELIGIBLE");
  });

  it("limits unpaid orders per client (BR-12: 5)", async () => {
    const client = await createOnboardedUser(db);
    for (let i = 0; i < 5; i += 1) {
      await accept(
        client,
        await propose(await freelancer(), await createJob(client)),
      );
    }
    const sixth = await propose(await freelancer(), await createJob(client));
    await expectPgError(
      accept(client, sixth),
      "PJ409",
      "MAX_AWAITING_PAYMENT_ORDERS",
    );
  });
});

describe("orders: visibility and integrity", () => {
  it("only the two parties and admins see an order and its events; nobody writes directly", async () => {
    const client = await createOnboardedUser(db);
    const f = await freelancer();
    const stranger = await createOnboardedUser(db);
    const admin = await createOnboardedUser(db);
    await makeAdmin(db, admin);
    const orderId = await accept(
      client,
      await propose(f, await createJob(client)),
    );

    for (const table of ["orders", "order_events"]) {
      const col = table === "orders" ? "id" : "order_id";
      const sql = `select 1 from public.${table} where ${col} = $1`;
      expect(await count(user(client), sql, [orderId])).toBeGreaterThan(0);
      expect(await count(user(f), sql, [orderId])).toBeGreaterThan(0);
      expect(await count(user(admin), sql, [orderId])).toBeGreaterThan(0);
      expect(await count(user(stranger), sql, [orderId])).toBe(0);
      await expectPgError(
        as(db, anon, (tx) => tx.query(sql, [orderId])),
        "42501",
      );
    }

    await expectPgError(
      rpc(
        client,
        "update public.orders set status = 'completed' where id = $1",
        [orderId],
      ),
      "42501",
    );
    await expectPgError(
      rpc(client, "update public.orders set amount = 10000 where id = $1", [
        orderId,
      ]),
      "42501",
    );
    await expectPgError(
      rpc(
        client,
        "insert into public.order_events (order_id, event_type) values ($1, 'completed')",
        [orderId],
      ),
      "42501",
    );
  });
});

describe("cancel_order (before payment)", () => {
  it("reopens the job so the client can hire someone else", async () => {
    const client = await createOnboardedUser(db);
    const job = await createJob(client);
    const first = await propose(await freelancer(), job);
    const second = await propose(await freelancer(), job);
    const orderId = await accept(client, first);

    await expectPgError(
      rpc(
        await createOnboardedUser(db),
        "select public.cancel_order($1, 'x')",
        [orderId],
      ),
      "PJ404",
    );
    await expectPgError(
      rpc(client, "select public.cancel_order($1, '   ')", [orderId]),
      "PJ422",
      "INVALID_REASON",
    );

    await rpc(client, "select public.cancel_order($1, 'Salah pilih')", [
      orderId,
    ]);
    const order = await db.query<{ status: string; cancelled_by: string }>(
      "select status, cancelled_by from public.orders where id = $1",
      [orderId],
    );
    expect(order.rows[0]).toEqual({
      status: "cancelled",
      cancelled_by: client,
    });
    expect(await jobStatus(job)).toBe("open");
    expect(await proposalStatus(first)).toEqual({
      status: "rejected",
      status_reason: "hire_cancelled",
    });
    await expectPgError(
      rpc(client, "select public.cancel_order($1, 'lagi')", [orderId]),
      "PJ409",
      "ORDER_NOT_CANCELLABLE",
    );

    const newOrder = await accept(client, second);
    expect(newOrder).not.toBe(orderId);
    expect(await jobStatus(job)).toBe("hiring");
  });

  it("the hired freelancer may also back out before payment", async () => {
    const client = await createOnboardedUser(db);
    const f = await freelancer();
    const job = await createJob(client);
    const orderId = await accept(client, await propose(f, job));
    await rpc(f, "select public.cancel_order($1, 'Jadwal bentrok')", [orderId]);
    expect(await jobStatus(job)).toBe("open");
  });
});
