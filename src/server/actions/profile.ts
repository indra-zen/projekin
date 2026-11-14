"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AVATAR_BUCKET, IMAGE_TYPES, isOwnObjectPath } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { formDataToObject } from "@/lib/validation/common";
import {
  avatarPathSchema,
  onboardingSchema,
  profileSchema,
} from "@/lib/validation/profile";
import {
  fail,
  ok,
  validationFailed,
  type ActionResult,
  type FormState,
} from "@/server/action-result";
import { guardOnboarded, guardUser } from "@/server/auth";
import { messageFor } from "@/server/error-messages";
import { mapPostgresError } from "@/server/errors";

export async function completeOnboardingAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const guard = await guardUser();
  if (!guard.ok) return guard.result;

  const raw = formDataToObject(formData);
  const parsed = onboardingSchema.safeParse(raw);
  if (!parsed.success) return validationFailed(parsed.error, raw);

  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_onboarding", {
    p_full_name: parsed.data.fullName,
    p_username: parsed.data.username,
    p_accept_terms: parsed.data.acceptTerms,
  });
  if (error) return fail(mapPostgresError(error), raw);

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function updateProfileAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const guard = await guardOnboarded();
  if (!guard.ok) return guard.result;
  const { user, profile } = guard.value;

  const raw = formDataToObject(formData);
  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) return validationFailed(parsed.error, raw);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      username: parsed.data.username,
      bio: parsed.data.bio,
      location: parsed.data.location,
    })
    .eq("id", user.id)
    .select("username")
    .single();
  if (error) return fail(mapPostgresError(error), raw);

  revalidatePath("/dashboard", "layout");
  revalidatePath(`/u/${profile.username}`);
  revalidatePath(`/u/${data.username}`);
  return ok(null, "Profil berhasil disimpan.");
}

/** Sets the avatar after the browser uploaded it to `avatars/{uid}/...`. */
export async function updateAvatarAction(input: {
  path: string;
}): Promise<ActionResult> {
  const guard = await guardOnboarded();
  if (!guard.ok) return guard.result;
  const { user, profile } = guard.value;

  const parsed = avatarPathSchema.safeParse(input);
  if (
    !parsed.success ||
    !isOwnObjectPath(user.id, parsed.data.path, IMAGE_TYPES)
  ) {
    return fail({
      code: "VALIDATION_ERROR",
      reason: "INVALID_AVATAR_PATH",
      message: messageFor("VALIDATION_ERROR", "INVALID_AVATAR_PATH"),
    });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_path: parsed.data.path })
    .eq("id", user.id)
    .select("id")
    .single();
  if (error) return fail(mapPostgresError(error));

  if (profile.avatar_path && profile.avatar_path !== parsed.data.path) {
    // Best effort: a leftover object is harmless.
    await supabase.storage.from(AVATAR_BUCKET).remove([profile.avatar_path]);
  }

  revalidatePath("/", "layout");
  return ok(null, "Foto profil diperbarui.");
}

export async function removeAvatarAction(): Promise<ActionResult> {
  const guard = await guardOnboarded();
  if (!guard.ok) return guard.result;
  const { user, profile } = guard.value;

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_path: null })
    .eq("id", user.id)
    .select("id")
    .single();
  if (error) return fail(mapPostgresError(error));

  if (profile.avatar_path) {
    await supabase.storage.from(AVATAR_BUCKET).remove([profile.avatar_path]);
  }

  revalidatePath("/", "layout");
  return ok(null, "Foto profil dihapus.");
}
