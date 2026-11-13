import { createHash, timingSafeEqual } from "node:crypto";

/** SHA512(order_id + status_code + gross_amount + serverKey), hex. */
export function computeNotificationSignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  serverKey: string,
): string {
  return createHash("sha512")
    .update(orderId + statusCode + grossAmount + serverKey)
    .digest("hex");
}

/**
 * Verifies a Midtrans HTTP notification's `signature_key` (timing-safe). Uses
 * the raw string fields exactly as received (e.g. gross_amount "150000.00").
 */
export function verifyNotificationSignature(
  payload: Record<string, unknown>,
  serverKey: string,
): boolean {
  const {
    order_id: orderId,
    status_code: statusCode,
    gross_amount: grossAmount,
    signature_key: signature,
  } = payload;
  if (
    typeof orderId !== "string" ||
    typeof statusCode !== "string" ||
    typeof grossAmount !== "string" ||
    typeof signature !== "string" ||
    !serverKey
  ) {
    return false;
  }
  const expected = Buffer.from(
    computeNotificationSignature(orderId, statusCode, grossAmount, serverKey),
    "utf8",
  );
  const given = Buffer.from(signature.toLowerCase(), "utf8");
  return expected.length === given.length && timingSafeEqual(expected, given);
}
