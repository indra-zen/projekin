import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { log } from "@/server/log";
import {
  createSnapTransaction,
  expireTransaction,
  MidtransError,
} from "./midtrans-client";
import { buildSnapRequest } from "./snap-request";

export type NewAttempt = {
  paymentId: string;
  midtransOrderId: string;
  attemptNo: number;
  grossAmount: number;
  orderId: string;
  title: string;
  paymentDueAt: string;
  customerName: string | null;
  customerEmail: string | null;
  finishUrl: string;
};

export type CheckoutResult =
  | { ok: true; snapToken: string; redirectUrl: string; expiresAt: string }
  | { ok: false; reason: "PAYMENT_PROVIDER_ERROR" | "INTERNAL_ERROR" };

/**
 * Creates the Snap transaction for a freshly `initiated` attempt and attaches
 * the token (or fails the attempt so the client can retry, BR-11). All values
 * come from database rows read after the caller was authorized.
 */
export async function createSnapCheckout(
  attempt: NewAttempt,
): Promise<CheckoutResult> {
  const admin = createAdminClient();
  const { body, tokenExpiresAt } = buildSnapRequest({
    midtransOrderId: attempt.midtransOrderId,
    grossAmount: attempt.grossAmount,
    orderId: attempt.orderId,
    title: attempt.title,
    customerName: attempt.customerName,
    customerEmail: attempt.customerEmail,
    paymentDueAt: new Date(attempt.paymentDueAt),
    now: new Date(),
    finishUrl: attempt.finishUrl,
  });

  let snap: { token: string; redirectUrl: string };
  try {
    snap = await createSnapTransaction(body);
  } catch (error) {
    const reason =
      error instanceof MidtransError ? error.reason : "snap_unexpected";
    log("error", "payment.snap.error", {
      midtransOrderId: attempt.midtransOrderId,
      reason,
    });
    const { error: failError } = await admin.rpc("fail_payment_attempt", {
      p_payment_id: attempt.paymentId,
      p_reason: reason,
    });
    if (failError) {
      log("error", "payment.attempt.fail_error", {
        midtransOrderId: attempt.midtransOrderId,
        code: failError.code,
      });
    }
    return { ok: false, reason: "PAYMENT_PROVIDER_ERROR" };
  }

  const { error } = await admin.rpc("attach_snap_token", {
    p_payment_id: attempt.paymentId,
    p_snap_token: snap.token,
    p_redirect_url: snap.redirectUrl,
    p_token_expires_at: tokenExpiresAt.toISOString(),
  });
  if (error) {
    // E.g. the order was cancelled while Snap was being called.
    log("error", "payment.attach.error", {
      midtransOrderId: attempt.midtransOrderId,
      code: error.code,
      reason: error.message,
    });
    await expireTransaction(attempt.midtransOrderId);
    return { ok: false, reason: "INTERNAL_ERROR" };
  }

  log("info", "payment.attempt.created", {
    midtransOrderId: attempt.midtransOrderId,
    attemptNo: attempt.attemptNo,
    grossAmount: attempt.grossAmount,
  });
  return {
    ok: true,
    snapToken: snap.token,
    redirectUrl: snap.redirectUrl,
    expiresAt: tokenExpiresAt.toISOString(),
  };
}

/**
 * Best-effort Midtrans expiry for attempts that were live when an order was
 * cancelled (ARCHITECTURE §9.6). A payment that still settles is handled by
 * apply_payment_status as a late payment (refund pending).
 */
export async function expireMidtransTransactions(
  midtransOrderIds: readonly string[],
): Promise<void> {
  for (const id of midtransOrderIds) {
    const result = await expireTransaction(id);
    log(result.ok ? "info" : "warn", "payment.expire", {
      midtransOrderId: id,
      ok: result.ok,
      statusCode: result.statusCode,
    });
  }
}
