"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formDataToObject } from "@/lib/validation/common";
import {
  cancelOrderSchema,
  disputeSchema,
  deliverOrderSchema,
  orderMessageSchema,
  orderIdSchema,
  revisionRequestSchema,
  reviewSchema,
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

/** FR-ORD-04: the freelancer submits the work and optional attachments. */
export async function deliverOrderAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const guard = await guardOnboarded();
  if (!guard.ok) return guard.result;

  const raw = formDataToObject(formData);
  const parsed = deliverOrderSchema.safeParse(raw);
  if (!parsed.success) return validationFailed(parsed.error, raw);
  let attachmentPaths: string[];
  try {
    const value: unknown = JSON.parse(parsed.data.attachmentPaths);
    if (
      !Array.isArray(value) ||
      value.some((path) => typeof path !== "string") ||
      value.length > 10
    ) {
      return fail(
        {
          code: "VALIDATION_ERROR",
          reason: "TOO_MANY_ATTACHMENTS",
          message: "Maksimal 10 lampiran per pengiriman.",
        },
        raw,
      );
    }
    attachmentPaths = value;
  } catch {
    return fail(
      {
        code: "VALIDATION_ERROR",
        reason: "ATTACHMENT_NOT_FOUND",
        message: "Lampiran tidak valid. Unggah ulang file Anda.",
      },
      raw,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("deliver_order", {
    p_order_id: parsed.data.orderId,
    p_message: parsed.data.message,
    p_attachment_paths: attachmentPaths,
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

export async function sendOrderMessageAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const guard = await guardOnboarded();
  if (!guard.ok) return guard.result;
  const raw = formDataToObject(formData);
  const parsed = orderMessageSchema.safeParse(raw);
  if (!parsed.success) return validationFailed(parsed.error, raw);
  const supabase = await createClient();
  const { error } = await supabase.rpc("send_order_message", {
    p_order_id: parsed.data.orderId,
    p_body: parsed.data.body,
  });
  if (error) return fail(mapPostgresError(error), raw);
  revalidateOrder(parsed.data.orderId);
  return ok(null, "Pesan berhasil dikirim.");
}

export async function requestOrderRevisionAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const guard = await guardOnboarded();
  if (!guard.ok) return guard.result;
  const raw = formDataToObject(formData);
  const parsed = revisionRequestSchema.safeParse(raw);
  if (!parsed.success) return validationFailed(parsed.error, raw);
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_order_revision", {
    p_order_id: parsed.data.orderId,
    p_reason: parsed.data.reason,
  });
  if (error) return fail(mapPostgresError(error), raw);
  revalidateOrder(parsed.data.orderId);
  return ok(null, "Permintaan revisi dikirim.");
}

export async function openOrderDisputeAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const guard = await guardOnboarded();
  if (!guard.ok) return guard.result;
  const raw = formDataToObject(formData);
  const parsed = disputeSchema.safeParse(raw);
  if (!parsed.success) return validationFailed(parsed.error, raw);
  const supabase = await createClient();
  const { error } = await supabase.rpc("open_order_dispute", {
    p_order_id: parsed.data.orderId,
    p_reason: parsed.data.reason,
  });
  if (error) return fail(mapPostgresError(error), raw);
  revalidateOrder(parsed.data.orderId);
  return ok(null, "Sengketa dibuka dan akan ditinjau admin.");
}

export async function createOrderReviewAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const guard = await guardOnboarded();
  if (!guard.ok) return guard.result;
  const raw = formDataToObject(formData);
  const parsed = reviewSchema.safeParse(raw);
  if (!parsed.success) return validationFailed(parsed.error, raw);
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_order_review", {
    p_order_id: parsed.data.orderId,
    p_rating: parsed.data.rating,
    p_comment: parsed.data.comment || undefined,
  });
  if (error) return fail(mapPostgresError(error), raw);
  revalidateOrder(parsed.data.orderId);
  revalidatePath("/u/[username]", "page");
  return ok(null, "Ulasan Anda berhasil disimpan.");
}
