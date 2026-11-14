"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { orderIdSchema } from "@/lib/validation/order";
import {
  fail,
  ok,
  validationFailed,
  type ActionError,
  type ActionResult,
} from "@/server/action-result";
import { guardOnboarded } from "@/server/auth";
import { messageFor } from "@/server/error-messages";
import { mapPostgresError } from "@/server/errors";
import { log } from "@/server/log";
import { createSnapCheckout } from "@/server/payments/checkout";
import {
  assertPaymentsConfigured,
  PaymentConfigError,
} from "@/server/payments/config";
import { syncAndApply } from "@/server/payments/process-status";
import { siteOrigin } from "@/server/site-origin";
import type { Enums } from "@/types/database";

export type StartPaymentData = {
  snapToken: string;
  redirectUrl: string;
  midtransOrderId: string;
  expiresAt: string;
};

export type PaymentSyncData = {
  orderStatus: Enums<"order_status">;
  paymentStatus: Enums<"payment_status"> | null;
};

const providerError = (): ActionError => ({
  code: "PAYMENT_PROVIDER_ERROR",
  reason: "PAYMENT_PROVIDER_ERROR",
  message: messageFor("PAYMENT_PROVIDER_ERROR", "PAYMENT_PROVIDER_ERROR"),
});

const notConfigured = (): ActionError => ({
  code: "PAYMENT_PROVIDER_ERROR",
  reason: "PAYMENT_NOT_CONFIGURED",
  message: messageFor("PAYMENT_PROVIDER_ERROR", "PAYMENT_NOT_CONFIGURED"),
});

function configured(): boolean {
  try {
    assertPaymentsConfigured();
    return true;
  } catch (error) {
    if (error instanceof PaymentConfigError) {
      log("error", "payment.not_configured", { reason: error.message });
      return false;
    }
    throw error;
  }
}

/**
 * FR-PAY-01: creates (or reuses, BR-11) a payment attempt for the caller's own
 * order and returns a Snap token. The amount is never taken from the browser:
 * create_payment_attempt copies orders.amount, and the Snap request is built
 * from that row.
 */
export async function startPaymentAction(input: {
  orderId: string;
}): Promise<ActionResult<StartPaymentData>> {
  const guard = await guardOnboarded();
  if (!guard.ok) return guard.result;
  const viewer = guard.value;
  const parsed = orderIdSchema.safeParse(input);
  if (!parsed.success) return validationFailed(parsed.error);
  const { orderId } = parsed.data;
  if (!configured()) return fail(notConfigured());

  const supabase = await createClient();
  // The RPC checks that the caller is the order's client and that the order
  // is awaiting payment; it locks the order so double clicks cannot create
  // two live attempts.
  const { data: payment, error } = await supabase.rpc(
    "create_payment_attempt",
    { p_order_id: orderId },
  );
  if (error) return fail(mapPostgresError(error));

  if (
    payment.status === "pending" &&
    payment.snap_token &&
    payment.snap_redirect_url &&
    payment.token_expires_at
  ) {
    return ok({
      snapToken: payment.snap_token,
      redirectUrl: payment.snap_redirect_url,
      midtransOrderId: payment.midtrans_order_id,
      expiresAt: payment.token_expires_at,
    });
  }

  const { data: order } = await supabase
    .from("orders")
    .select("id, title, payment_due_at")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return fail(mapPostgresError({ code: "PJ404" }));

  const result = await createSnapCheckout({
    paymentId: payment.id,
    midtransOrderId: payment.midtrans_order_id,
    attemptNo: payment.attempt_no,
    grossAmount: payment.gross_amount,
    orderId: order.id,
    title: order.title,
    paymentDueAt: order.payment_due_at,
    customerName: viewer.profile.full_name,
    customerEmail: viewer.user.email,
    finishUrl: `${await siteOrigin()}/dashboard/orders/${order.id}?payment=finish`,
  });
  revalidatePath(`/dashboard/orders/${orderId}`);
  if (!result.ok) {
    return fail(
      result.reason === "PAYMENT_PROVIDER_ERROR"
        ? providerError()
        : mapPostgresError({ code: "XX000" }),
    );
  }
  return ok({
    snapToken: result.snapToken,
    redirectUrl: result.redirectUrl,
    midtransOrderId: payment.midtrans_order_id,
    expiresAt: result.expiresAt,
  });
}

/**
 * FR-PAY-03: return-sync. Called after every Snap callback and on the order
 * page. It asks the Midtrans Status API (server-side) and applies the result;
 * the browser's own success callback is never trusted (FR-PAY-02).
 */
const SYNC_THROTTLE_MS = 5_000;

export async function syncPaymentStatusAction(input: {
  orderId: string;
}): Promise<ActionResult<PaymentSyncData>> {
  const guard = await guardOnboarded();
  if (!guard.ok) return guard.result;
  const parsed = orderIdSchema.safeParse(input);
  if (!parsed.success) return validationFailed(parsed.error);
  const { orderId } = parsed.data;

  const supabase = await createClient();
  const readState = async () => {
    const [{ data: order }, { data: payments }] = await Promise.all([
      supabase
        .from("orders")
        .select("id, client_id, status")
        .eq("id", orderId)
        .maybeSingle(),
      supabase
        .from("payments")
        .select("id, midtrans_order_id, status, snap_token, last_synced_at")
        .eq("order_id", orderId)
        .order("attempt_no", { ascending: false }),
    ]);
    return { order, payments: payments ?? [] };
  };

  // Authorization: RLS returns the order to its parties and admins; only the
  // client may trigger a sync (payments are visible to the client only).
  const before = await readState();
  if (!before.order || before.order.client_id !== guard.value.user.id) {
    return fail(
      mapPostgresError({ code: "PJ404", message: "ORDER_NOT_FOUND" }),
    );
  }
  const target =
    before.payments.find(
      (p) => p.status === "initiated" || p.status === "pending",
    ) ?? before.payments[0];
  const current: PaymentSyncData = {
    orderStatus: before.order.status,
    paymentStatus: target?.status ?? null,
  };
  // No Snap transaction exists before a token is attached.
  if (!target || (target.status === "initiated" && !target.snap_token)) {
    return ok(current);
  }
  // Throttle: at most one Status API call per attempt every few seconds,
  // however often the client asks (QA residual risk 1).
  if (
    target.last_synced_at &&
    Date.now() - new Date(target.last_synced_at).getTime() < SYNC_THROTTLE_MS
  ) {
    return ok(current);
  }
  if (!configured()) return fail(notConfigured());

  try {
    await syncAndApply(target.midtrans_order_id);
  } catch (error) {
    log("warn", "payment.sync.error", {
      midtransOrderId: target.midtrans_order_id,
      error: (error as Error).message,
    });
    return fail(providerError());
  }

  const after = await readState();
  const next: PaymentSyncData = {
    orderStatus: after.order?.status ?? current.orderStatus,
    paymentStatus:
      after.payments.find((p) => p.id === target.id)?.status ??
      current.paymentStatus,
  };
  if (
    next.orderStatus !== current.orderStatus ||
    next.paymentStatus !== current.paymentStatus
  ) {
    revalidatePath("/dashboard/orders");
    revalidatePath(`/dashboard/orders/${orderId}`);
  }
  return ok(next);
}
