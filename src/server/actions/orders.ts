"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formDataToObject } from "@/lib/validation/common";
import {
  cancelOrderSchema,
  deliverOrderSchema,
  orderIdSchema,
  serviceOrderSchema,
} from "@/lib/validation/order";
import {
  fail,
  ok,
  validationFailed,
  type FormState,
} from "@/server/action-result";
import { guardOnboarded } from "@/server/auth";
import { mapPostgresError } from "@/server/errors";
import { log } from "@/server/log";
import { expireMidtransTransactions } from "@/server/payments/checkout";

function revalidateOrder(orderId: string) {
  revalidatePath("/dashboard/orders");
  revalidatePath(`/dashboard/orders/${orderId}`);
}

/** FR-ORD-01: order a published service. Amounts are computed in the database. */
export async function createServiceOrderAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const guard = await guardOnboarded();
  if (!guard.ok) return guard.result;

  const raw = formDataToObject(formData);
  const parsed = serviceOrderSchema.safeParse(raw);
  if (!parsed.success) return validationFailed(parsed.error, raw);

  const supabase = await createClient();
  const { data: orderId, error } = await supabase.rpc("create_service_order", {
    p_service_id: parsed.data.serviceId,
    p_requirements: parsed.data.requirements,
  });
  if (error) return fail(mapPostgresError(error), raw);

  revalidatePath("/dashboard/orders");
  redirect(`/dashboard/orders/${orderId}` as Route);
}

/**
 * BR-20: client, freelancer or admin before payment; the freelancer also after
 * payment until the first delivery (refund pending). Live Snap transactions
 * are expired at Midtrans (best effort).
 */
export async function cancelOrderAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const guard = await guardOnboarded();
  if (!guard.ok) return guard.result;

  const raw = formDataToObject(formData);
  const parsed = cancelOrderSchema.safeParse(raw);
  if (!parsed.success) return validationFailed(parsed.error, raw);

  const supabase = await createClient();
  const { data: liveAttempts, error } = await supabase.rpc("cancel_order", {
    p_order_id: parsed.data.orderId,
    p_reason: parsed.data.reason,
  });
  if (error) return fail(mapPostgresError(error), raw);

  if (liveAttempts && liveAttempts.length > 0) {
    try {
      await expireMidtransTransactions(liveAttempts);
    } catch (expireError) {
      log("warn", "payment.expire.failed", {
        orderId: parsed.data.orderId,
        error: (expireError as Error).name,
      });
    }
  }

  revalidateOrder(parsed.data.orderId);
  revalidatePath("/dashboard/jobs", "layout");
  revalidatePath("/dashboard/proposals");
  revalidatePath("/jobs");
  return ok(null, "Pesanan dibatalkan.");
}

/** FR-ORD-04 (message only; file attachments arrive in Phase 7). */
export async function deliverOrderAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const guard = await guardOnboarded();
  if (!guard.ok) return guard.result;

  const raw = formDataToObject(formData);
  const parsed = deliverOrderSchema.safeParse(raw);
  if (!parsed.success) return validationFailed(parsed.error, raw);

  const supabase = await createClient();
  const { error } = await supabase.rpc("deliver_order", {
    p_order_id: parsed.data.orderId,
    p_message: parsed.data.message,
  });
  if (error) return fail(mapPostgresError(error), raw);

  revalidateOrder(parsed.data.orderId);
  return ok(null, "Hasil kerja terkirim. Menunggu konfirmasi klien.");
}

/** FR-ORD-05: the client confirms completion; payout becomes pending (BR-23). */
export async function completeOrderAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const guard = await guardOnboarded();
  if (!guard.ok) return guard.result;

  const raw = formDataToObject(formData);
  const parsed = orderIdSchema.safeParse(raw);
  if (!parsed.success) return validationFailed(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_order", {
    p_order_id: parsed.data.orderId,
  });
  if (error) return fail(mapPostgresError(error));

  revalidateOrder(parsed.data.orderId);
  return ok(null, "Pesanan selesai. Terima kasih!");
}
