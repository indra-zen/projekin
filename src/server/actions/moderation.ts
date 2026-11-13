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

const freelancerStatusSchema = z.object({
  userId: uuidSchema,
  status: z.enum(["active", "suspended"]),
});
const blockSchema = z.discriminatedUnion("blocked", [
  z.object({
    blocked: z.literal(true),
    serviceId: uuidSchema,
    reason: z.string().trim().min(1).max(500),
  }),
  z.object({ blocked: z.literal(false), serviceId: uuidSchema }),
]);

export async function setFreelancerStatusAction(input: {
  userId: string;
  status: "active" | "suspended";
}): Promise<ActionResult> {
  const guard = await guardAdmin();
  if (!guard.ok) return guard.result;
  const parsed = freelancerStatusSchema.safeParse(input);
  if (!parsed.success) return validationFailed(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_freelancer_status", {
    p_user_id: parsed.data.userId,
    p_status: parsed.data.status,
  });
  if (error) return fail(mapPostgresError(error));
  revalidatePath("/admin/moderation");
  revalidatePath("/services");
  return ok(
    null,
    parsed.data.status === "suspended"
      ? "Freelancer ditangguhkan."
      : "Freelancer diaktifkan kembali.",
  );
}

export async function setServiceBlockAction(
  input: unknown,
): Promise<ActionResult> {
  const guard = await guardAdmin();
  if (!guard.ok) return guard.result;
  const parsed = blockSchema.safeParse(input);
  if (!parsed.success) return validationFailed(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_service_block", {
    p_service_id: parsed.data.serviceId,
    p_blocked: parsed.data.blocked,
    // Omitted when unblocking (SQL default null).
    ...(parsed.data.blocked ? { p_reason: parsed.data.reason } : {}),
  });
  if (error) return fail(mapPostgresError(error));
  revalidatePath("/admin/moderation");
  revalidatePath("/services");
  revalidatePath(`/services/${parsed.data.serviceId}`);
  return ok(
    null,
    parsed.data.blocked ? "Layanan diblokir." : "Blokir layanan dibatalkan.",
  );
}

export async function moderationFormAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const kind = formData.get("kind");
  if (kind === "freelancer") {
    return setFreelancerStatusAction({
      userId: String(formData.get("userId")),
      status: formData.get("status") === "suspended" ? "suspended" : "active",
    });
  }
  return setServiceBlockAction({
    blocked: formData.get("blocked") === "true",
    serviceId: String(formData.get("serviceId")),
    reason: String(formData.get("reason") ?? ""),
  });
}
