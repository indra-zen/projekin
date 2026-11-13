"use server";

import { revalidatePath } from "next/cache";
import { SERVICE_MEDIA_BUCKET, IMAGE_TYPES, isOwnObjectPath } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { formDataToObject } from "@/lib/validation/common";
import {
  serviceIdSchema,
  serviceSchema,
  serviceStatusSchema,
} from "@/lib/validation/service";
import {
  fail,
  ok,
  validationFailed,
  type ActionResult,
  type FormState,
} from "@/server/action-result";
import { guardOnboarded, guardVerifiedFreelancer } from "@/server/auth";
import { messageFor } from "@/server/error-messages";
import { mapPostgresError } from "@/server/errors";

function coverIsValid(userId: string, path: string | null) {
  return path === null || isOwnObjectPath(userId, path, IMAGE_TYPES);
}

export async function createServiceAction(
  _prev: FormState<{ serviceId: string }>,
  formData: FormData,
): Promise<FormState<{ serviceId: string }>> {
  const guard = await guardVerifiedFreelancer();
  if (!guard.ok) return guard.result;
  const raw = formDataToObject(formData);
  const parsed = serviceSchema.safeParse({
    ...raw,
    coverImagePath: raw.coverImagePath || null,
  });
  if (!parsed.success) return validationFailed(parsed.error, raw);
  if (!coverIsValid(guard.value.user.id, parsed.data.coverImagePath)) {
    return fail({ code: "VALIDATION_ERROR", reason: "INVALID_COVER_PATH", message: messageFor("VALIDATION_ERROR", "INVALID_COVER_PATH") }, raw);
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("services").insert({
    freelancer_id: guard.value.user.id,
    category_id: parsed.data.categoryId,
    title: parsed.data.title,
    description: parsed.data.description,
    price: parsed.data.price,
    delivery_days: parsed.data.deliveryDays,
    revisions_included: parsed.data.revisionsIncluded,
    requirements_prompt: parsed.data.requirementsPrompt,
    cover_image_path: parsed.data.coverImagePath,
  }).select("id").single();
  if (error) return fail(mapPostgresError(error), raw);
  revalidatePath("/dashboard/services");
  return ok({ serviceId: data.id }, "Layanan berhasil disimpan sebagai draf.");
}

export async function updateServiceAction(
  _prev: FormState<{ serviceId: string }>,
  formData: FormData,
): Promise<FormState<{ serviceId: string }>> {
  const guard = await guardOnboarded();
  if (!guard.ok) return guard.result;
  const raw = formDataToObject(formData);
  const idParsed = serviceIdSchema.safeParse(raw);
  const parsed = serviceSchema.safeParse({ ...raw, coverImagePath: raw.coverImagePath || null });
  if (!idParsed.success) return validationFailed(idParsed.error, raw);
  if (!parsed.success) return validationFailed(parsed.error, raw);
  if (!coverIsValid(guard.value.user.id, parsed.data.coverImagePath)) {
    return fail({ code: "VALIDATION_ERROR", reason: "INVALID_COVER_PATH", message: messageFor("VALIDATION_ERROR", "INVALID_COVER_PATH") }, raw);
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("services").update({
    category_id: parsed.data.categoryId,
    title: parsed.data.title,
    description: parsed.data.description,
    price: parsed.data.price,
    delivery_days: parsed.data.deliveryDays,
    revisions_included: parsed.data.revisionsIncluded,
    requirements_prompt: parsed.data.requirementsPrompt,
    cover_image_path: parsed.data.coverImagePath,
  }).eq("id", idParsed.data.id).eq("freelancer_id", guard.value.user.id).select("id").single();
  if (error) return fail(mapPostgresError(error), raw);
  revalidatePath("/dashboard/services");
  revalidatePath(`/services/${data.id}`);
  revalidatePath("/services");
  return ok({ serviceId: data.id }, "Layanan berhasil diperbarui.");
}

export async function setServiceStatusAction(input: {
  id: string;
  status: "published" | "paused" | "archived";
}): Promise<ActionResult> {
  const guard = await guardOnboarded();
  if (!guard.ok) return guard.result;
  const parsed = serviceIdSchema.extend({ status: serviceStatusSchema }).safeParse(input);
  if (!parsed.success) return validationFailed(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_service_status", {
    p_service_id: parsed.data.id,
    p_status: parsed.data.status,
  });
  if (error) return fail(mapPostgresError(error));
  revalidatePath("/dashboard/services");
  revalidatePath("/services");
  revalidatePath(`/services/${parsed.data.id}`);
  return ok(null, parsed.data.status === "published" ? "Layanan dipublikasikan." : "Status layanan diperbarui.");
}

export async function deleteServiceAction(input: { id: string }): Promise<ActionResult> {
  const guard = await guardOnboarded();
  if (!guard.ok) return guard.result;
  const parsed = serviceIdSchema.safeParse(input);
  if (!parsed.success) return validationFailed(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.from("services").delete().eq("id", parsed.data.id).eq("freelancer_id", guard.value.user.id);
  if (error) return fail(mapPostgresError(error));
  revalidatePath("/dashboard/services");
  return ok(null, "Draf layanan dihapus.");
}

export { SERVICE_MEDIA_BUCKET };
