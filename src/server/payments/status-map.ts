import type { Enums } from "@/types/database";

export type PaymentStatus = Enums<"payment_status">;

/**
 * Mirrors the mapping in DATABASE §8.2 for display and logging only. The
 * database (`apply_payment_status`) does the authoritative mapping.
 */
export function mapMidtransStatus(
  transactionStatus: string | null | undefined,
  fraudStatus?: string | null,
): PaymentStatus | null {
  const tx = (transactionStatus ?? "").trim().toLowerCase();
  const fraud = (fraudStatus ?? "").trim().toLowerCase() || null;
  switch (tx) {
    case "settlement":
      return "paid";
    case "capture":
      if (fraud === null || fraud === "accept") return "paid";
      if (fraud === "challenge") return "pending";
      if (fraud === "deny") return "failed";
      return null;
    case "authorize":
    case "pending":
      return "pending";
    case "deny":
    case "failure":
      return "failed";
    case "cancel":
      return "cancelled";
    case "expire":
      return "expired";
    case "refund":
    case "partial_refund":
    case "chargeback":
    case "partial_chargeback":
      return "refunded";
    default:
      return null;
  }
}

/**
 * Parses Midtrans `gross_amount` ("150000.00", "150000" or a number) to integer
 * rupiah. Anything with a non-zero fraction or not a plain number → null
 * (treated as an amount mismatch).
 */
export function parseGrossAmount(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
  }
  if (typeof value !== "string") return null;
  const match = /^(\d{1,12})(?:\.0+)?$/.exec(value.trim());
  return match ? Number(match[1]) : null;
}
