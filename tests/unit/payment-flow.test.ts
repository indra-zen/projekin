import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computeNotificationSignature } from "@/server/payments/signature";
import { fakeSupabase, profileRow, formData } from "./fake-supabase";

const SERVER_KEY = "SB-Mid-server-flow-test";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
  process.env.NEXT_PUBLIC_SITE_URL = "https://projekin.test";
});

const state = vi.hoisted(() => ({
  user: null as unknown,
  admin: null as unknown,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => state.user,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => state.admin,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url });
  }),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

const { POST: notify } =
  await import("@/app/api/payments/midtrans/notification/route");
const { GET: reconcile } =
  await import("@/app/api/cron/reconcile-payments/route");
const { startPaymentAction, syncPaymentStatusAction } =
  await import("@/server/actions/payments");
const { cancelOrderAction } = await import("@/server/actions/orders");

const UID = "6f1c2e3a-0b4d-4e5f-8a9b-0c1d2e3f4a5b";
const ORDER = "33333333-4444-4555-8666-777777777777";
const PAYMENT = "44444444-5555-4666-8777-888888888888";
const MID = "PJK-000123-1-a1b2c3d4";

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------

type Call = { name: string; args: Record<string, unknown> };

function fakeAdmin(
  opts: {
    rpc?: (name: string, args: Record<string, unknown>) => unknown;
    payments?: unknown[];
    insertError?: boolean;
  } = {},
) {
  const rpcCalls: Call[] = [];
  const inserts: Record<string, unknown>[] = [];
  const updates: Record<string, unknown>[] = [];
  const admin = {
    rpc: vi.fn(async (name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args });
      return {
        data: opts.rpc ? opts.rpc(name, args) : "applied",
        error: null,
      };
    }),
    from: vi.fn(() => {
      const chain: Record<string, unknown> = {};
      for (const m of ["select", "in", "lt", "order", "limit", "eq"]) {
        chain[m] = () => chain;
      }
      chain.insert = (values: Record<string, unknown>) => {
        inserts.push(values);
        return chain;
      };
      chain.update = (values: Record<string, unknown>) => {
        updates.push(values);
        return chain;
      };
      chain.single = async () =>
        opts.insertError
          ? { data: null, error: { code: "XX000" } }
          : { data: { id: 1 }, error: null };
      chain.then = (resolve: (v: unknown) => unknown) =>
        Promise.resolve({ data: opts.payments ?? [], error: null }).then(
          resolve,
        );
      return chain;
    }),
  };
  return { admin, rpcCalls, inserts, updates };
}

type FetchCall = { url: string; method: string; body: unknown; auth: string };

function stubFetch(
  respond: (url: string, method: string) => { status: number; body: unknown },
) {
  const calls: FetchCall[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      const headers = init.headers as Record<string, string>;
      calls.push({
        url,
        method: init.method ?? "GET",
        body: init.body ? JSON.parse(String(init.body)) : null,
        auth: headers.Authorization ?? "",
      });
      const r = respond(url, init.method ?? "GET");
      return new Response(JSON.stringify(r.body), { status: r.status });
    }),
  );
  return calls;
}

const statusBody = (overrides: Record<string, unknown> = {}) => ({
  order_id: MID,
  status_code: "200",
  transaction_status: "settlement",
  fraud_status: "accept",
  gross_amount: "150000.00",
  payment_type: "qris",
  transaction_id: "tx-1",
  ...overrides,
});

function notification(fields: Record<string, string>, key = SERVER_KEY) {
  const body = {
    order_id: MID,
    status_code: "200",
    gross_amount: "150000.00",
    transaction_status: "settlement",
    ...fields,
  };
  return {
    ...body,
    signature_key: computeNotificationSignature(
      body.order_id,
      body.status_code,
      body.gross_amount,
      key,
    ),
  };
}

const post = (body: unknown) =>
  notify(
    new Request("https://projekin.test/api/payments/midtrans/notification", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

beforeEach(() => {
  process.env.MIDTRANS_SERVER_KEY = SERVER_KEY;
  process.env.MIDTRANS_IS_PRODUCTION = "false";
  process.env.SUPABASE_SECRET_KEY = "service-role-test";
  process.env.CRON_SECRET = "cron-secret-test";
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------------

describe("POST /api/payments/midtrans/notification", () => {
  it("rejects malformed JSON and missing fields with 400", async () => {
    const { admin, inserts } = fakeAdmin();
    state.admin = admin;
    expect((await post("{not json")).status).toBe(400);
    expect((await post({ order_id: MID })).status).toBe(400);
    expect(inserts).toHaveLength(0);
  });

  it("logs and rejects an invalid signature with 401 without applying anything", async () => {
    const { admin, inserts, rpcCalls } = fakeAdmin();
    state.admin = admin;
    const fetchCalls = stubFetch(() => ({ status: 200, body: statusBody() }));
    const tampered = { ...notification({}), gross_amount: "10000.00" };
    const res = await post(tampered);
    expect(res.status).toBe(401);
    expect(inserts[0]).toMatchObject({
      midtrans_order_id: MID,
      signature_valid: false,
      processing_result: "invalid_signature",
    });
    expect(inserts[0]!.payload).not.toHaveProperty("signature_key");
    expect(rpcCalls).toHaveLength(0);
    expect(fetchCalls).toHaveLength(0);
  });

  it("applies the Status API answer, not the notification body", async () => {
    const { admin, inserts, updates, rpcCalls } = fakeAdmin();
    state.admin = admin;
    // The (validly signed) body claims settlement; Midtrans says pending.
    const fetchCalls = stubFetch(() => ({
      status: 200,
      body: statusBody({
        transaction_status: "pending",
        fraud_status: undefined,
      }),
    }));
    const res = await post(notification({ transaction_status: "settlement" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, result: "applied" });
    expect(fetchCalls[0]).toMatchObject({
      url: `https://api.sandbox.midtrans.com/v2/${MID}/status`,
      method: "GET",
      auth: `Basic ${Buffer.from(`${SERVER_KEY}:`).toString("base64")}`,
    });
    expect(inserts[0]).toMatchObject({ signature_valid: true });
    expect(rpcCalls).toEqual([
      {
        name: "apply_payment_status",
        args: {
          p_midtrans_order_id: MID,
          p_transaction_status: "pending",
          p_fraud_status: null,
          p_status_code: "200",
          p_gross_amount: 150000,
          p_payment_type: "qris",
          p_transaction_id: "tx-1",
        },
      },
    ]);
    expect(updates[0]).toMatchObject({ processing_result: "applied" });
  });

  it("acknowledges deliberately ignored outcomes with 200", async () => {
    for (const result of ["unknown_payment", "amount_mismatch", "no_change"]) {
      const { admin } = fakeAdmin({ rpc: () => result });
      state.admin = admin;
      stubFetch(() => ({ status: 200, body: statusBody() }));
      const res = await post(notification({}));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true, result });
    }
  });

  it("treats a non-integer Status API amount as a mismatch without calling the database", async () => {
    const { admin, rpcCalls } = fakeAdmin();
    state.admin = admin;
    stubFetch(() => ({
      status: 200,
      body: statusBody({ gross_amount: "150000.50" }),
    }));
    const res = await post(notification({}));
    expect(await res.json()).toEqual({ ok: true, result: "amount_mismatch" });
    expect(rpcCalls).toHaveLength(0);
  });

  it("returns 500 when the Status API is down, so Midtrans retries", async () => {
    const { admin, updates, rpcCalls } = fakeAdmin();
    state.admin = admin;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw Object.assign(new Error("timeout"), { name: "TimeoutError" });
      }),
    );
    const res = await post(notification({}));
    expect(res.status).toBe(500);
    expect(rpcCalls).toHaveLength(0);
    expect(updates[0]).toMatchObject({ processing_result: "error" });
  });

  it("returns 500 when payments are not configured", async () => {
    delete process.env.MIDTRANS_SERVER_KEY;
    state.admin = fakeAdmin().admin;
    expect((await post(notification({}))).status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// Reconcile cron
// ---------------------------------------------------------------------------

describe("GET /api/cron/reconcile-payments", () => {
  const get = (auth?: string) =>
    reconcile(
      new Request("https://projekin.test/api/cron/reconcile-payments", {
        headers: auth ? { authorization: auth } : {},
      }),
    );

  it("requires the cron bearer token", async () => {
    state.admin = fakeAdmin().admin;
    expect((await get()).status).toBe(401);
    expect((await get("Bearer wrong")).status).toBe(401);
  });

  it("fails stale initiated attempts and syncs pending ones", async () => {
    const { admin, rpcCalls } = fakeAdmin({
      payments: [
        {
          id: "p1",
          midtrans_order_id: "PJK-000001-1-aaaaaaaa",
          status: "initiated",
          snap_token: null,
        },
        {
          id: "p2",
          midtrans_order_id: MID,
          status: "pending",
          snap_token: "t",
        },
      ],
    });
    state.admin = admin;
    stubFetch(() => ({ status: 200, body: statusBody() }));
    const res = await get("Bearer cron-secret-test");
    expect(await res.json()).toEqual({
      ok: true,
      checked: 2,
      applied: 1,
      failedStale: 1,
      errors: 0,
    });
    expect(rpcCalls.map((c) => c.name)).toEqual([
      "fail_payment_attempt",
      "apply_payment_status",
    ]);
  });
});

// ---------------------------------------------------------------------------
// startPayment / syncPaymentStatus / cancelOrder actions
// ---------------------------------------------------------------------------

function userClient(
  rpcResult: (name: string, args: unknown) => unknown,
  reads = {},
) {
  const fake = fakeSupabase({
    userId: UID,
    email: "rina@example.test",
    profile: profileRow(UID, { full_name: "Rina Andriani" }),
    rpc: (name, args) => {
      const r = rpcResult(name, args);
      return r instanceof Error
        ? { data: null, error: r }
        : { data: r, error: null };
    },
    reads,
  });
  state.user = fake.client;
  return fake;
}

const initiated = {
  id: PAYMENT,
  order_id: ORDER,
  attempt_no: 1,
  midtrans_order_id: MID,
  gross_amount: 150000,
  status: "initiated",
  snap_token: null,
  snap_redirect_url: null,
  token_expires_at: null,
};

describe("startPaymentAction", () => {
  const due = new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString();

  it("creates the Snap transaction from database values and ignores client-sent amounts", async () => {
    const fake = userClient(() => initiated, {
      orders: {
        data: { id: ORDER, title: "Desain logo", payment_due_at: due },
      },
    });
    const { admin, rpcCalls } = fakeAdmin({ rpc: () => ({}) });
    state.admin = admin;
    const fetchCalls = stubFetch(() => ({
      status: 201,
      body: {
        token: "snap-token",
        redirect_url: "https://app.sandbox.midtrans.com/snap/v4/redirection/x",
      },
    }));

    const result = await startPaymentAction({
      orderId: ORDER,
      amount: 1,
    } as unknown as { orderId: string });

    expect(result).toMatchObject({
      ok: true,
      data: { snapToken: "snap-token", midtransOrderId: MID },
    });
    expect(fake.rpc).toHaveBeenCalledWith("create_payment_attempt", {
      p_order_id: ORDER,
    });
    const snap = fetchCalls[0]!;
    expect(snap.url).toBe(
      "https://app.sandbox.midtrans.com/snap/v1/transactions",
    );
    const body = snap.body as {
      transaction_details: { order_id: string; gross_amount: number };
      expiry: { duration: number };
      callbacks: { finish: string };
      customer_details: { first_name: string };
    };
    expect(body.transaction_details).toEqual({
      order_id: MID,
      gross_amount: 150000,
    });
    expect(body.callbacks.finish).toBe(
      `https://projekin.test/dashboard/orders/${ORDER}?payment=finish`,
    );
    expect(body.customer_details.first_name).toBe("Rina Andriani");
    expect(rpcCalls[0]).toMatchObject({
      name: "attach_snap_token",
      args: { p_payment_id: PAYMENT, p_snap_token: "snap-token" },
    });
    expect(
      new Date(rpcCalls[0]!.args.p_token_expires_at as string).getTime(),
    ).toBeLessThanOrEqual(new Date(due).getTime());
  });

  it("reuses a live attempt with a valid token without calling Midtrans", async () => {
    userClient(() => ({
      ...initiated,
      status: "pending",
      snap_token: "existing",
      snap_redirect_url:
        "https://app.sandbox.midtrans.com/snap/v4/redirection/y",
      token_expires_at: due,
    }));
    state.admin = fakeAdmin().admin;
    const fetchCalls = stubFetch(() => ({ status: 500, body: {} }));
    const result = await startPaymentAction({ orderId: ORDER });
    expect(result).toMatchObject({ ok: true, data: { snapToken: "existing" } });
    expect(fetchCalls).toHaveLength(0);
  });

  it("fails the attempt when Snap errors, so the client can retry", async () => {
    userClient(() => initiated, {
      orders: {
        data: { id: ORDER, title: "Desain logo", payment_due_at: due },
      },
    });
    const { admin, rpcCalls } = fakeAdmin({ rpc: () => ({}) });
    state.admin = admin;
    stubFetch(() => ({ status: 401, body: { error_messages: ["denied"] } }));
    const result = await startPaymentAction({ orderId: ORDER });
    expect(result).toMatchObject({
      ok: false,
      error: { code: "PAYMENT_PROVIDER_ERROR" },
    });
    expect(rpcCalls).toEqual([
      {
        name: "fail_payment_attempt",
        args: { p_payment_id: PAYMENT, p_reason: "snap_401" },
      },
    ]);
  });

  it("maps database refusals (e.g. BR-11) and refuses when not configured", async () => {
    userClient(() =>
      Object.assign(new Error("x"), {
        code: "PJ409",
        message: "MAX_PAYMENT_ATTEMPTS",
      }),
    );
    state.admin = fakeAdmin().admin;
    expect(await startPaymentAction({ orderId: ORDER })).toMatchObject({
      ok: false,
      error: { code: "LIMIT_REACHED", reason: "MAX_PAYMENT_ATTEMPTS" },
    });

    delete process.env.SUPABASE_SECRET_KEY;
    expect(await startPaymentAction({ orderId: ORDER })).toMatchObject({
      ok: false,
      error: { reason: "PAYMENT_NOT_CONFIGURED" },
    });
  });
});

describe("syncPaymentStatusAction", () => {
  it("only lets the order's client sync", async () => {
    userClient(() => null, {
      orders: {
        data: {
          id: ORDER,
          client_id: "someone-else",
          status: "awaiting_payment",
        },
      },
    });
    state.admin = fakeAdmin().admin;
    expect(await syncPaymentStatusAction({ orderId: ORDER })).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
  });

  it("a Snap success callback without a transaction at Midtrans changes nothing", async () => {
    userClient(() => null, {
      orders: {
        data: { id: ORDER, client_id: UID, status: "awaiting_payment" },
      },
      payments: {
        data: [
          {
            id: PAYMENT,
            midtrans_order_id: MID,
            status: "pending",
            snap_token: "t",
          },
        ],
      },
    });
    const { admin, rpcCalls } = fakeAdmin();
    state.admin = admin;
    stubFetch(() => ({
      status: 404,
      body: {
        status_code: "404",
        status_message: "Transaction doesn't exist.",
      },
    }));
    expect(await syncPaymentStatusAction({ orderId: ORDER })).toEqual({
      ok: true,
      data: { orderStatus: "awaiting_payment", paymentStatus: "pending" },
      message: undefined,
    });
    expect(rpcCalls).toHaveLength(0);
  });

  it("reports provider errors without changing anything", async () => {
    userClient(() => null, {
      orders: {
        data: { id: ORDER, client_id: UID, status: "awaiting_payment" },
      },
      payments: {
        data: [
          {
            id: PAYMENT,
            midtrans_order_id: MID,
            status: "pending",
            snap_token: "t",
          },
        ],
      },
    });
    state.admin = fakeAdmin().admin;
    stubFetch(() => ({ status: 503, body: { status_code: "503" } }));
    expect(await syncPaymentStatusAction({ orderId: ORDER })).toMatchObject({
      ok: false,
      error: { code: "PAYMENT_PROVIDER_ERROR" },
    });
  });
});

describe("cancelOrderAction", () => {
  it("expires the attempts that were live at Midtrans (best effort)", async () => {
    userClient(() => [MID]);
    state.admin = fakeAdmin().admin;
    const fetchCalls = stubFetch(() => ({
      status: 200,
      body: { status_code: "407", transaction_status: "expire" },
    }));
    const result = await cancelOrderAction(
      null,
      formData({ orderId: ORDER, reason: "Berubah pikiran" }),
    );
    expect(result).toMatchObject({ ok: true });
    expect(fetchCalls).toEqual([
      expect.objectContaining({
        url: `https://api.sandbox.midtrans.com/v2/${MID}/expire`,
        method: "POST",
      }),
    ]);
  });

  it("still succeeds when the Midtrans expire call fails", async () => {
    userClient(() => [MID]);
    state.admin = fakeAdmin().admin;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    expect(
      await cancelOrderAction(
        null,
        formData({ orderId: ORDER, reason: "Berubah pikiran" }),
      ),
    ).toMatchObject({ ok: true });
  });
});
