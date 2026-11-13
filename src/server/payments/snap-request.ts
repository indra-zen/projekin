/**
 * Builds the Snap "create transaction" body from database values only
 * (ARCHITECTURE §9.2). Pure function: unit-tested.
 */

/** QRIS, e-wallets and bank virtual accounts (product requirement). */
export const ENABLED_PAYMENTS = [
  "other_qris",
  "gopay",
  "shopeepay",
  "bca_va",
  "bni_va",
  "bri_va",
  "permata_va",
  "cimb_va",
  "echannel",
  "other_va",
] as const;

export type SnapRequestInput = {
  midtransOrderId: string;
  grossAmount: number;
  orderId: string;
  title: string;
  customerName: string | null;
  customerEmail: string | null;
  paymentDueAt: Date;
  now: Date;
  finishUrl: string;
};

export type SnapRequestBody = {
  transaction_details: { order_id: string; gross_amount: number };
  item_details: { id: string; price: number; quantity: number; name: string }[];
  customer_details?: { first_name?: string; email?: string };
  enabled_payments: string[];
  expiry: { start_time: string; unit: "minute"; duration: number };
  callbacks: { finish: string };
};

const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

/** `yyyy-MM-dd HH:mm:ss +0700` (Asia/Jakarta has no DST). */
export function formatMidtransTime(date: Date): string {
  const local = new Date(date.getTime() + JAKARTA_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())} ` +
    `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:${pad(local.getUTCSeconds())} +0700`
  );
}

function truncate(value: string, max: number): string {
  const chars = Array.from(value.trim());
  return chars.length > max ? chars.slice(0, max).join("") : chars.join("");
}

export function buildSnapRequest(input: SnapRequestInput): {
  body: SnapRequestBody;
  tokenExpiresAt: Date;
} {
  if (!Number.isSafeInteger(input.grossAmount) || input.grossAmount <= 0) {
    throw new Error("grossAmount must be a positive integer (rupiah).");
  }
  // Whole seconds, because start_time has second precision.
  const start = new Date(Math.floor(input.now.getTime() / 1000) * 1000);
  const duration = Math.floor(
    (input.paymentDueAt.getTime() - start.getTime()) / 60_000,
  );
  if (duration < 1) {
    throw new Error("The payment window has closed.");
  }
  // BR-10: the Snap expiry ends at or before payment_due_at.
  const tokenExpiresAt = new Date(start.getTime() + duration * 60_000);

  const customer: { first_name?: string; email?: string } = {};
  if (input.customerName?.trim())
    customer.first_name = truncate(input.customerName, 50);
  if (input.customerEmail?.trim()) customer.email = input.customerEmail.trim();

  return {
    body: {
      transaction_details: {
        order_id: input.midtransOrderId,
        gross_amount: input.grossAmount,
      },
      // One line whose price × quantity equals gross_amount.
      item_details: [
        {
          id: input.orderId,
          price: input.grossAmount,
          quantity: 1,
          name: truncate(input.title, 50) || "Pesanan Projekin",
        },
      ],
      ...(Object.keys(customer).length > 0
        ? { customer_details: customer }
        : {}),
      enabled_payments: [...ENABLED_PAYMENTS],
      expiry: {
        start_time: formatMidtransTime(start),
        unit: "minute",
        duration,
      },
      callbacks: { finish: input.finishUrl },
    },
    tokenExpiresAt,
  };
}
