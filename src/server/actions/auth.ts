"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/auth/routes";
import { createClient } from "@/lib/supabase/server";
import { formDataToObject } from "@/lib/validation/common";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/lib/validation/auth";
import {
  fail,
  ok,
  safeValues,
  validationFailed,
  type FormState,
} from "@/server/action-result";
import { guardUser } from "@/server/auth";
import { mapAuthError } from "@/server/errors";
import { siteOrigin } from "@/server/site-origin";

export async function registerAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const raw = formDataToObject(formData);
  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) return validationFailed(parsed.error, safeValues(raw));

  const supabase = await createClient();
  const origin = await siteOrigin();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${origin}/auth/confirm?next=/onboarding`,
      data: { full_name: parsed.data.fullName },
    },
  });
  if (error) return fail(mapAuthError(error), safeValues(raw));

  // Projects with email confirmation disabled return a session immediately.
  if (data.session) redirect("/onboarding");

  // Same response whether or not the email already exists (no account enumeration).
  return ok(
    null,
    "Pendaftaran berhasil. Kami telah mengirim tautan konfirmasi ke email Anda. Buka tautan tersebut untuk melanjutkan.",
  );
}

export async function loginAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const raw = formDataToObject(formData);
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return validationFailed(parsed.error, safeValues(raw));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) return fail(mapAuthError(error), safeValues(raw));

  revalidatePath("/", "layout");
  redirect(safeNextPath(parsed.data.next, "/dashboard") as Route);
}

export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

export async function forgotPasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const raw = formDataToObject(formData);
  const parsed = forgotPasswordSchema.safeParse(raw);
  if (!parsed.success) return validationFailed(parsed.error, raw);

  const supabase = await createClient();
  const origin = await siteOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
    {
      redirectTo: `${origin}/auth/confirm?next=/reset-password`,
    },
  );
  // Only surface rate limiting; otherwise respond identically (no enumeration).
  if (error) {
    const mapped = mapAuthError(error);
    if (mapped.code === "RATE_LIMITED") return fail(mapped, raw);
  }
  return ok(
    null,
    "Jika email tersebut terdaftar, kami telah mengirim tautan untuk mengatur ulang kata sandi.",
  );
}

export async function resetPasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const guard = await guardUser();
  if (!guard.ok) return guard.result;

  const raw = formDataToObject(formData);
  const parsed = resetPasswordSchema.safeParse(raw);
  if (!parsed.success) return validationFailed(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) return fail(mapAuthError(error));

  return ok(null, "Kata sandi berhasil diperbarui.");
}
