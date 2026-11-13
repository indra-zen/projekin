"use server";

import { revalidatePath } from "next/cache";
import { DOCUMENT_TYPES, isOwnObjectPath } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { formDataToObject } from "@/lib/validation/common";
import {
  endOfDayJakarta,
  freelancerProfileSchema,
  reviewVerificationSchema,
  submitVerificationSchema,
} from "@/lib/validation/verification";
import {
  fail,
  ok,
  validationFailed,
  type FormState,
} from "@/server/action-result";
import { guardAdmin, guardOnboarded } from "@/server/auth";
import { messageFor } from "@/server/error-messages";
import { mapPostgresError } from "@/server/errors";

export async function submitVerificationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const guard = await guardOnboarded();
  if (!guard.ok) return guard.result;
  const { user } = guard.value;

  const raw = formDataToObject(formData);
  const parsed = submitVerificationSchema.safeParse(raw);
  if (!parsed.success) return validationFailed(parsed.error, raw);

  const input = parsed.data;
  if (
    input.method === "document" &&
    !isOwnObjectPath(user.id, input.documentPath, DOCUMENT_TYPES)
  ) {
    return fail(
      {
        code: "VALIDATION_ERROR",
        reason: "DOCUMENT_NOT_FOUND",
        message: messageFor("VALIDATION_ERROR", "DOCUMENT_NOT_FOUND"),
      },
      raw,
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_student_verification", {
    p_university_id: input.universityId,
    p_method: input.method,
    p_student_number: input.method === "document" ? input.studentNumber : null,
    p_document_path: input.method === "document" ? input.documentPath : null,
  });
  if (error) return fail(mapPostgresError(error), raw);

  revalidatePath("/dashboard", "layout");
  return ok(
    null,
    data.status === "approved"
      ? "Verifikasi berhasil. Anda sekarang dapat bekerja sebagai freelancer."
      : "Pengajuan verifikasi terkirim. Admin akan meninjau dokumen Anda.",
  );
}

export async function reviewVerificationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  // UI/server check; the RPC enforces admin-only access independently.
  const guard = await guardAdmin();
  if (!guard.ok) return guard.result;

  const raw = formDataToObject(formData);
  const parsed = reviewVerificationSchema.safeParse(raw);
  if (!parsed.success) return validationFailed(parsed.error, raw);
  const input = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("review_student_verification", {
    p_verification_id: input.verificationId,
    p_decision: input.decision,
    p_valid_until:
      input.decision === "approve" ? endOfDayJakarta(input.validUntil) : null,
    p_reason: input.decision === "reject" ? input.reason : null,
  });
  if (error) return fail(mapPostgresError(error), raw);

  revalidatePath("/admin", "layout");
  return ok(
    null,
    input.decision === "approve"
      ? "Pengajuan disetujui."
      : "Pengajuan ditolak.",
  );
}

export async function updateFreelancerProfileAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const guard = await guardOnboarded();
  if (!guard.ok) return guard.result;
  const { user, profile } = guard.value;

  const raw = formDataToObject(formData);
  const parsed = freelancerProfileSchema.safeParse(raw);
  if (!parsed.success) return validationFailed(parsed.error, raw);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("freelancer_profiles")
    .update({
      headline: parsed.data.headline,
      major: parsed.data.major,
      skills: parsed.data.skills,
    })
    .eq("user_id", user.id)
    .select("user_id")
    .maybeSingle();
  if (error) return fail(mapPostgresError(error), raw);
  if (!data) {
    return fail(
      {
        code: "NOT_FOUND",
        reason: "NOT_A_FREELANCER",
        message: messageFor("NOT_FOUND", "NOT_A_FREELANCER"),
      },
      raw,
    );
  }

  revalidatePath("/dashboard", "layout");
  revalidatePath(`/u/${profile.username}`);
  return ok(null, "Profil freelancer berhasil disimpan.");
}
