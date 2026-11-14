import { beforeEach, describe, expect, it, vi } from "vitest";
import { reviewWindowOpen } from "@/lib/format";
import { parseServicesSearch } from "@/lib/validation/service";
import nextConfig, { securityHeaders } from "../../next.config";
import {
  fakeSupabase,
  formData,
  profileRow,
  type FakeOptions,
} from "./fake-supabase";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
});

const state = vi.hoisted(() => ({ client: null as unknown }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => state.client,
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

const UID = "6f1c2e3a-0b4d-4e5f-8a9b-0c1d2e3f4a5b";
const ORDER = "33333333-4444-4555-8666-777777777777";
const SERVICE = "44444444-5555-4666-8777-888888888888";

function setup(options: FakeOptions) {
  const fake = fakeSupabase(options);
  state.client = fake.client;
  return fake;
}

const signedIn = (options: Partial<FakeOptions> = {}) =>
  setup({ userId: UID, profile: profileRow(UID), ...options });

beforeEach(() => {
  vi.resetModules();
});

const orderActions = () => import("@/server/actions/orders");

// ---------------------------------------------------------------------------
// Order fulfilment actions (thin wrappers: validate, call the RPC, map errors)
// ---------------------------------------------------------------------------

describe("order fulfilment actions", () => {
  it("reject unauthenticated callers before touching the database", async () => {
    const fake = setup({ userId: null });
    const a = await orderActions();
    const input = formData({
      orderId: ORDER,
      body: "Halo",
      reason: "Hasil kerja tidak sesuai dengan kebutuhan.",
      rating: "5",
    });
    for (const action of [
      a.sendOrderMessageAction,
      a.requestOrderRevisionAction,
      a.openOrderDisputeAction,
      a.createOrderReviewAction,
    ]) {
      const result = await action(null, input);
      expect(result).toMatchObject({
        ok: false,
        error: { code: "UNAUTHENTICATED" },
      });
    }
    expect(fake.rpc).not.toHaveBeenCalled();
  });

  it("sends a trimmed message and maps a closed thread (BR-29) to Indonesian", async () => {
    const fake = signedIn({
      rpc: () => ({
        data: null,
        error: { code: "PJ409", message: "MESSAGES_CLOSED" },
      }),
    });
    const { sendOrderMessageAction } = await orderActions();
    const result = await sendOrderMessageAction(
      null,
      formData({ orderId: ORDER, body: "  Halo, apa kabar?  " }),
    );
    expect(fake.rpc).toHaveBeenCalledWith("send_order_message", {
      p_order_id: ORDER,
      p_body: "Halo, apa kabar?",
    });
    expect(result).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_STATE",
        reason: "MESSAGES_CLOSED",
        message:
          "Ruang pesan hanya tersedia selama pesanan dikerjakan, dikirim, atau dalam sengketa.",
      },
    });
  });

  it("validates revision and dispute reasons before calling the RPC", async () => {
    const fake = signedIn();
    const { requestOrderRevisionAction, openOrderDisputeAction } =
      await orderActions();

    const revision = await requestOrderRevisionAction(
      null,
      formData({ orderId: ORDER, reason: "pendek" }),
    );
    expect(revision).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR" },
    });
    const dispute = await openOrderDisputeAction(
      null,
      formData({ orderId: ORDER, reason: "terlalu pendek" }),
    );
    expect(dispute).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR" },
    });
    expect(fake.rpc).not.toHaveBeenCalled();

    await openOrderDisputeAction(
      null,
      formData({
        orderId: ORDER,
        reason: "Hasil kerja tidak sesuai dengan kebutuhan.",
      }),
    );
    expect(fake.rpc).toHaveBeenCalledWith("open_order_dispute", {
      p_order_id: ORDER,
      p_reason: "Hasil kerja tidak sesuai dengan kebutuhan.",
    });
  });

  it("sends only the validated rating and comment, and maps a duplicate review", async () => {
    const fake = signedIn({
      rpc: () => ({
        data: null,
        error: { code: "PJ409", message: "ALREADY_REVIEWED" },
      }),
    });
    const { createOrderReviewAction } = await orderActions();

    const invalid = await createOrderReviewAction(
      null,
      formData({ orderId: ORDER, rating: "6" }),
    );
    expect(invalid).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR" },
    });
    expect(fake.rpc).not.toHaveBeenCalled();

    const result = await createOrderReviewAction(
      null,
      formData({
        orderId: ORDER,
        rating: "4",
        comment: " Rapi. ",
        reviewer_id: "someone-else",
      }),
    );
    expect(fake.rpc).toHaveBeenCalledWith("create_order_review", {
      p_order_id: ORDER,
      p_rating: 4,
      p_comment: "Rapi.",
    });
    expect(result).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", reason: "ALREADY_REVIEWED" },
    });
  });

  it("rejects malformed or oversized attachment lists before deliver_order", async () => {
    const fake = signedIn();
    const { deliverOrderAction } = await orderActions();

    const notJson = await deliverOrderAction(
      null,
      formData({ orderId: ORDER, message: "Hasil", attachmentPaths: "{oops" }),
    );
    expect(notJson).toMatchObject({
      ok: false,
      error: { reason: "ATTACHMENT_NOT_FOUND" },
    });
    const tooMany = await deliverOrderAction(
      null,
      formData({
        orderId: ORDER,
        message: "Hasil",
        attachmentPaths: JSON.stringify(
          Array.from({ length: 11 }, (_, i) => `${ORDER}/${UID}/${i}.pdf`),
        ),
      }),
    );
    expect(tooMany).toMatchObject({
      ok: false,
      error: { reason: "TOO_MANY_ATTACHMENTS" },
    });
    expect(fake.rpc).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// deleteServiceAction (API_CONTRACT §1.5: zero affected rows is not success)
// ---------------------------------------------------------------------------

describe("deleteServiceAction", () => {
  it("reports NOT_DRAFT when RLS deleted nothing", async () => {
    signedIn({ delete: () => ({ data: [], error: null }) });
    const { deleteServiceAction } = await import("@/server/actions/services");
    expect(await deleteServiceAction({ id: SERVICE })).toMatchObject({
      ok: false,
      error: { code: "INVALID_STATE", reason: "NOT_DRAFT" },
    });
  });

  it("confirms a deleted draft", async () => {
    signedIn({ delete: () => ({ data: [{ id: SERVICE }], error: null }) });
    const { deleteServiceAction } = await import("@/server/actions/services");
    expect(await deleteServiceAction({ id: SERVICE })).toMatchObject({
      ok: true,
    });
  });
});

// ---------------------------------------------------------------------------
// Helpers and configuration
// ---------------------------------------------------------------------------

describe("reviewWindowOpen (BR-22)", () => {
  it("is open for 14 days after completion only", () => {
    const completed = "2026-11-01T00:00:00.000Z";
    expect(reviewWindowOpen(completed, new Date("2026-11-14T23:59:00Z"))).toBe(
      true,
    );
    expect(reviewWindowOpen(completed, new Date("2026-11-15T00:00:00Z"))).toBe(
      true,
    );
    expect(reviewWindowOpen(completed, new Date("2026-11-15T00:00:01Z"))).toBe(
      false,
    );
    expect(reviewWindowOpen(null)).toBe(false);
  });
});

describe("services search params", () => {
  it("falls back to defaults for invalid values", () => {
    expect(
      parseServicesSearch({
        q: "x".repeat(200),
        category: "Bad Slug!",
        minPrice: "-5",
        maxPrice: "abc",
        sort: "cheapest",
        page: "0",
      }),
    ).toEqual({
      q: "",
      category: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      sort: "newest",
      page: 1,
    });
  });

  it("parses valid values (first value of repeated keys)", () => {
    expect(
      parseServicesSearch({
        q: " logo ",
        category: "desain",
        minPrice: "50000",
        maxPrice: "250000",
        sort: ["rating", "price_asc"],
        page: "3",
      }),
    ).toEqual({
      q: "logo",
      category: "desain",
      minPrice: 50000,
      maxPrice: 250000,
      sort: "rating",
      page: 3,
    });
  });
});

describe("security headers (ARCHITECTURE §12.1)", () => {
  it("deny framing and content sniffing on every route", async () => {
    const rules = await nextConfig.headers!();
    expect(rules).toEqual([{ source: "/:path*", headers: securityHeaders }]);
    const byKey = Object.fromEntries(
      securityHeaders.map((h) => [h.key, h.value]),
    );
    expect(byKey["Content-Security-Policy"]).toContain(
      "frame-ancestors 'none'",
    );
    expect(byKey["X-Frame-Options"]).toBe("DENY");
    expect(byKey["X-Content-Type-Options"]).toBe("nosniff");
    expect(byKey["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(nextConfig.poweredByHeader).toBe(false);
  });
});
