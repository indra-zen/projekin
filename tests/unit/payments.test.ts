import { describe, expect, it } from "vitest";
import {
  getMidtransConfig,
  assertPaymentsConfigured,
  PaymentConfigError,
} from "@/server/payments/config";
import {
  computeNotificationSignature,
  verifyNotificationSignature,
} from "@/server/payments/signature";
import {
  buildSnapRequest,
  ENABLED_PAYMENTS,
  formatMidtransTime,
} from "@/server/payments/snap-request";
import {
  mapMidtransStatus,
  parseGrossAmount,
} from "@/server/payments/status-map";
import { parseOrdersFilter, serviceOrderSchema } from "@/lib/validation/order";

const KEY = "SB-Mid-server-unit-test-key";

function signed(fields: Record<string, string>, key = KEY) {
  return {
    ...fields,
    signature_key: computeNotificationSignature(
      fields.order_id!,
      fields.status_code!,
      fields.gross_amount!,
      key,
    ),
  };
}

const NOTIFICATION = {
  order_id: "PJK-000123-1-a1b2c3d4",
  status_code: "200",
  gross_amount: "150000.00",
  transaction_status: "settlement",
};

describe("verifyNotificationSignature", () => {
  it("accepts a correctly signed notification", () => {
    expect(verifyNotificationSignature(signed(NOTIFICATION), KEY)).toBe(true);
  });

  it("rejects a tampered field, a wrong key and missing fields", () => {
    const payload = signed(NOTIFICATION);
    expect(
      verifyNotificationSignature({ ...payload, gross_amount: "1500.00" }, KEY),
    ).toBe(false);
    expect(
      verifyNotificationSignature(
        { ...payload, order_id: "PJK-000124-1-a1b2c3d4" },
        KEY,
      ),
    ).toBe(false);
    expect(verifyNotificationSignature(payload, "SB-Mid-server-other")).toBe(
      false,
    );
    expect(
      verifyNotificationSignature({ ...payload, signature_key: "abc" }, KEY),
    ).toBe(false);
    const { signature_key: _omit, ...unsigned } = payload;
    void _omit;
    expect(verifyNotificationSignature(unsigned, KEY)).toBe(false);
    expect(
      verifyNotificationSignature({ ...payload, gross_amount: 150000 }, KEY),
    ).toBe(false);
  });
});

describe("mapMidtransStatus (mirrors DATABASE §8.2)", () => {
  it.each([
    ["settlement", null, "paid"],
    ["capture", "accept", "paid"],
    ["capture", null, "paid"],
    ["capture", "challenge", "pending"],
    ["capture", "deny", "failed"],
    ["authorize", null, "pending"],
    ["pending", null, "pending"],
    ["PENDING", null, "pending"],
    ["deny", null, "failed"],
    ["failure", null, "failed"],
    ["cancel", null, "cancelled"],
    ["expire", null, "expired"],
    ["refund", null, "refunded"],
    ["partial_refund", null, "refunded"],
    ["chargeback", null, "refunded"],
    ["partial_chargeback", null, "refunded"],
    ["something_new", null, null],
  ])("%s / %s → %s", (tx, fraud, expected) => {
    expect(mapMidtransStatus(tx, fraud)).toBe(expected);
  });
});

describe("parseGrossAmount", () => {
  it.each([
    ["150000.00", 150000],
    ["150000", 150000],
    [" 150000.0 ", 150000],
    [150000, 150000],
    ["150000.50", null],
    ["1.5e5", null],
    ["-150000", null],
    ["", null],
    [null, null],
    [150000.5, null],
  ])("%o → %o", (input, expected) => {
    expect(parseGrossAmount(input)).toBe(expected);
  });
});

describe("buildSnapRequest", () => {
  const now = new Date("2026-11-13T08:00:30.500Z"); // 15:00:30 WIB
  const base = {
    midtransOrderId: "PJK-000123-1-a1b2c3d4",
    grossAmount: 150000,
    orderId: "6f1c2e3a-0b4d-4e5f-8a9b-0c1d2e3f4a5b",
    title:
      "Desain logo UMKM yang sangat panjang sekali melebihi lima puluh karakter",
    customerName: "Rina Andriani",
    customerEmail: "rina@example.test",
    paymentDueAt: new Date("2026-11-14T08:00:00.000Z"),
    now,
    finishUrl:
      "https://projekin.test/dashboard/orders/6f1c2e3a-0b4d-4e5f-8a9b-0c1d2e3f4a5b?payment=finish",
  };

  it("charges exactly the database amount with one matching item", () => {
    const { body } = buildSnapRequest(base);
    expect(body.transaction_details).toEqual({
      order_id: base.midtransOrderId,
      gross_amount: 150000,
    });
    const sum = body.item_details.reduce(
      (total, item) => total + item.price * item.quantity,
      0,
    );
    expect(sum).toBe(body.transaction_details.gross_amount);
    expect(Array.from(body.item_details[0]!.name)).toHaveLength(50);
    expect(body.callbacks.finish).toBe(base.finishUrl);
  });

  it("enables QRIS, e-wallets and virtual accounts only", () => {
    const { body } = buildSnapRequest(base);
    expect(body.enabled_payments).toEqual([...ENABLED_PAYMENTS]);
    expect(body.enabled_payments).toContain("other_qris");
    expect(body.enabled_payments).toEqual(
      expect.arrayContaining(["gopay", "shopeepay", "bca_va", "bni_va"]),
    );
    expect(body.enabled_payments).not.toContain("credit_card");
  });

  it("ends the Snap expiry at or before payment_due_at (BR-10)", () => {
    const { body, tokenExpiresAt } = buildSnapRequest(base);
    expect(body.expiry.start_time).toBe("2026-11-13 15:00:30 +0700");
    expect(body.expiry.unit).toBe("minute");
    expect(body.expiry.duration).toBe(1439);
    expect(tokenExpiresAt.getTime()).toBeLessThanOrEqual(
      base.paymentDueAt.getTime(),
    );
    expect(tokenExpiresAt.toISOString()).toBe("2026-11-14T07:59:30.000Z");
  });

  it("omits empty customer details and refuses a closed window or bad amount", () => {
    const { body } = buildSnapRequest({
      ...base,
      customerName: null,
      customerEmail: null,
    });
    expect(body.customer_details).toBeUndefined();
    expect(() =>
      buildSnapRequest({
        ...base,
        paymentDueAt: new Date(now.getTime() + 30_000),
      }),
    ).toThrow();
    expect(() => buildSnapRequest({ ...base, grossAmount: 1500.5 })).toThrow();
  });

  it("formats times in Asia/Jakarta", () => {
    expect(formatMidtransTime(new Date("2026-12-31T17:05:09Z"))).toBe(
      "2027-01-01 00:05:09 +0700",
    );
  });
});

describe("payment configuration", () => {
  it("is sandbox-only and requires the server secrets", () => {
    expect(getMidtransConfig({ MIDTRANS_SERVER_KEY: KEY })).toMatchObject({
      serverKey: KEY,
      snapUrl: "https://app.sandbox.midtrans.com/snap/v1/transactions",
      apiBaseUrl: "https://api.sandbox.midtrans.com/v2",
    });
    expect(() =>
      getMidtransConfig({
        MIDTRANS_SERVER_KEY: KEY,
        MIDTRANS_IS_PRODUCTION: "true",
      }),
    ).toThrow(PaymentConfigError);
    expect(() => getMidtransConfig({})).toThrow(PaymentConfigError);
    expect(() =>
      assertPaymentsConfigured({ MIDTRANS_SERVER_KEY: KEY }),
    ).toThrow(/SUPABASE_SECRET_KEY/);
    expect(() =>
      assertPaymentsConfigured({
        MIDTRANS_SERVER_KEY: KEY,
        SUPABASE_SECRET_KEY: "x",
      }),
    ).not.toThrow();
  });
});

describe("order validation", () => {
  it("validates service order requirements", () => {
    const serviceId = "6f1c2e3a-0b4d-4e5f-8a9b-0c1d2e3f4a5b";
    expect(
      serviceOrderSchema.safeParse({ serviceId, requirements: "  pendek " })
        .success,
    ).toBe(false);
    expect(
      serviceOrderSchema.parse({
        serviceId,
        requirements: "  Logo untuk kedai kopi  ",
      }).requirements,
    ).toBe("Logo untuk kedai kopi");
  });

  it("falls back to defaults for invalid order filters", () => {
    expect(parseOrdersFilter({})).toEqual({
      role: "client",
      status: undefined,
      page: 1,
    });
    expect(
      parseOrdersFilter({
        role: "freelancer",
        status: "in_progress",
        page: "2",
      }),
    ).toEqual({ role: "freelancer", status: "in_progress", page: 2 });
    expect(
      parseOrdersFilter({ role: "admin", status: "bogus", page: "-4" }),
    ).toEqual({ role: "client", status: undefined, page: 1 });
  });
});
