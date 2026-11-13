import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { log } from "@/server/log";
import { getTransactionStatus, MidtransError } from "./midtrans-client";
import { parseGrossAmount } from "./status-map";

/** `apply_payment_status` results (DATABASE §4.17 processing_result). */
export type ProcessingResult =
  | "applied"
  | "no_change"
  | "ignored_regression"
  | "unknown_payment"
  | "amount_mismatch"
  | "error";

export type SyncOutcome =
  | { kind: "not_found" }
  | { kind: "processed"; result: ProcessingResult; transactionStatus: string };

/**
 * Asks the Midtrans **Status API** for the authoritative state of one payment
 * attempt and applies it through `apply_payment_status` (service role). This
 * is the only path that can mark a payment paid: the webhook, return-sync and
 * reconciliation all go through it, so neither a notification body nor a
 * browser redirect is ever trusted on its own.
 *
 * Throws MidtransError (Status API unreachable) or Error (database failure),
 * so callers can retry (webhook → 500, action → PAYMENT_PROVIDER_ERROR).
 */
export async function syncAndApply(
  midtransOrderId: string,
): Promise<SyncOutcome> {
  const status = await getTransactionStatus(midtransOrderId);
  if (!status.found) return { kind: "not_found" };
  if (status.orderId !== null && status.orderId !== midtransOrderId) {
    throw new MidtransError("status_order_id_mismatch");
  }

  const transactionStatus = status.transactionStatus.toLowerCase();
  const grossAmount = parseGrossAmount(status.grossAmount);
  if (grossAmount === null) {
    log("error", "payment.amount_mismatch", {
      midtransOrderId,
      reason: "unparseable_gross_amount",
    });
    return { kind: "processed", result: "amount_mismatch", transactionStatus };
  }

  const admin = createAdminClient();
  // Function arguments are nullable in SQL; the generated types mark them required.
  const nullable = (value: string | null) => value as string;
  const { data, error } = await admin.rpc("apply_payment_status", {
    p_midtrans_order_id: midtransOrderId,
    p_transaction_status: transactionStatus,
    p_fraud_status: nullable(status.fraudStatus),
    p_status_code: nullable(status.statusCode),
    p_gross_amount: grossAmount,
    p_payment_type: nullable(status.paymentType),
    p_transaction_id: nullable(status.transactionId),
  });
  if (error) {
    throw new Error(`apply_payment_status failed (${error.code ?? "?"})`);
  }

  const result = data as ProcessingResult;
  if (result === "amount_mismatch") {
    log("error", "payment.amount_mismatch", { midtransOrderId, grossAmount });
  } else {
    log("info", "payment.status.applied", {
      midtransOrderId,
      transactionStatus,
      result,
    });
  }
  return { kind: "processed", result, transactionStatus };
}
