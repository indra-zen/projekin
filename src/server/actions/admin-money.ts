"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/common";
import { z } from "@/lib/validation/zod";
import {
  fail,
  ok,
  validationFailed,
  type ActionResult,
  type FormState,
} from "@/server/action-result";
import { guardAdmin } from "@/server/auth";
import { mapPostgresError } from "@/server/errors";

// Phase 9 (API_CONTRACT §4.9): admin-only; every RPC re-checks the admin role.

const resolveDisputeSchema = z.object({
  disputeId: uuidSchema,
  orderId: uuidSchema,
  resolution: z.enum(["release_to_freelancer", "refund_client"]),
  adminNote: z.string().trim().min(1).max(2000),
});
const refundSchema = z.object({
  paymentId: uuidSchema,
  orderId: uuidSchema,
  reference: z.string().trim().min(1).max(200),
});
const payoutSchema = z.object({
  orderId: uuidSchema,
  reference: z.string().trim().min(1).max(200),
});

function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function resolveDisputeAction(
  _prev: FormState,
  formData: FormData,
): Promise<ActionResult> {
  const guard = await guardAdmin();
  if (!guard.ok) return guard.result;
  const values = {
    disputeId: field(formData, "disputeId"),
    orderId: field(formData, "orderId"),
    resolution: field(formData, "resolution"),
    adminNote: field(formData, "adminNote"),
  };
  const parsed = resolveDisputeSchema.safeParse(values);
  if (!parsed.success) return validationFailed(parsed.error, values);
  const supabase = await createClient();
  const { error } = await supabase.rpc("resolve_dispute", {
    p_dispute_id: parsed.data.disputeId,
    p_resolution: parsed.data.resolution,
    p_admin_note: parsed.data.adminNote,
  });
  if (error) return fail(mapPostgresError(error), values);
  revalidatePath("/admin");
  revalidatePath("/admin/disputes");
  revalidatePath(`/dashboard/orders/${parsed.data.orderId}`);
  return ok(
    null,
    parsed.data.resolution === "release_to_freelancer"
      ? "Sengketa diputuskan: dana diteruskan ke freelancer."
      : "Sengketa diputuskan: dana dikembalikan ke klien.",
  );
}

export async function markRefundCompletedAction(
  _prev: FormState,
  formData: FormData,
): Promise<ActionResult> {
  const guard = await guardAdmin();
  if (!guard.ok) return guard.result;
  const values = {
    paymentId: field(formData, "paymentId"),
    orderId: field(formData, "orderId"),
    reference: field(formData, "reference"),
  };
  const parsed = refundSchema.safeParse(values);
  if (!parsed.success) return validationFailed(parsed.error, values);
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_refund_completed", {
    p_payment_id: parsed.data.paymentId,
    p_reference: parsed.data.reference,
  });
  if (error) return fail(mapPostgresError(error), values);
  revalidatePath("/admin");
  revalidatePath("/admin/refunds");
  revalidatePath(`/dashboard/orders/${parsed.data.orderId}`);
  return ok(null, "Pengembalian dana ditandai selesai.");
}

export async function markPayoutPaidAction(
  _prev: FormState,
  formData: FormData,
): Promise<ActionResult> {
  const guard = await guardAdmin();
  if (!guard.ok) return guard.result;
  const values = {
    orderId: field(formData, "orderId"),
    reference: field(formData, "reference"),
  };
  const parsed = payoutSchema.safeParse(values);
  if (!parsed.success) return validationFailed(parsed.error, values);
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_payout_paid", {
    p_order_id: parsed.data.orderId,
    p_reference: parsed.data.reference,
  });
  if (error) return fail(mapPostgresError(error), values);
  revalidatePath("/admin");
  revalidatePath("/admin/payouts");
  revalidatePath("/dashboard/earnings");
  revalidatePath(`/dashboard/orders/${parsed.data.orderId}`);
  return ok(null, "Pencairan dana ditandai sudah dibayar.");
}
