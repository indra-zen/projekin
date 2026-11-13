"use server";

import { revalidatePath } from "next/cache";
import { PORTFOLIO_BUCKET, IMAGE_TYPES, isOwnObjectPath } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { formDataToObject } from "@/lib/validation/common";
import { portfolioIdSchema, portfolioSchema } from "@/lib/validation/portfolio";
import {
  fail,
  ok,
  validationFailed,
  type FormState,
} from "@/server/action-result";
import { guardOnboarded } from "@/server/auth";
import { messageFor } from "@/server/error-messages";
import { mapPostgresError } from "@/server/errors";

function parseInput(raw: Record<string, string>) {
  let imagePaths: unknown = [];
  try {
    imagePaths = JSON.parse(raw.imagePaths || "[]");
  } catch {
    imagePaths = null;
  }
  return portfolioSchema.safeParse({ ...raw, imagePaths });
}

function validPaths(uid: string, paths: string[]) {
  return paths.every((path) => isOwnObjectPath(uid, path, IMAGE_TYPES));
}

export async function createPortfolioItemAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const guard = await guardOnboarded();
  if (!guard.ok) return guard.result;
  const raw = formDataToObject(formData);
  const parsed = parseInput(raw);
  if (!parsed.success) return validationFailed(parsed.error, raw);
  if (!validPaths(guard.value.user.id, parsed.data.imagePaths)) {
    return fail(
      {
        code: "VALIDATION_ERROR",
        reason: "INVALID_PORTFOLIO_PATH",
        message: messageFor("VALIDATION_ERROR", "INVALID_PORTFOLIO_PATH"),
      },
      raw,
    );
  }
  const supabase = await createClient();
  const { error } = await supabase.from("portfolio_items").insert({
    freelancer_id: guard.value.user.id,
    title: parsed.data.title,
    description: parsed.data.description,
    external_url: parsed.data.externalUrl,
    image_paths: parsed.data.imagePaths,
    sort_order: parsed.data.sortOrder,
  });
  if (error) return fail(mapPostgresError(error), raw);
  revalidatePath("/dashboard/portfolio");
  revalidatePath(`/u/${guard.value.profile.username}`);
  return ok(null, "Karya portofolio berhasil ditambahkan.");
}

export async function updatePortfolioItemAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const guard = await guardOnboarded();
  if (!guard.ok) return guard.result;
  const raw = formDataToObject(formData);
  const id = portfolioIdSchema.safeParse(raw);
  const parsed = parseInput(raw);
  if (!id.success) return validationFailed(id.error, raw);
  if (!parsed.success) return validationFailed(parsed.error, raw);
  if (!validPaths(guard.value.user.id, parsed.data.imagePaths)) {
    return fail(
      {
        code: "VALIDATION_ERROR",
        reason: "INVALID_PORTFOLIO_PATH",
        message: messageFor("VALIDATION_ERROR", "INVALID_PORTFOLIO_PATH"),
      },
      raw,
    );
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("portfolio_items")
    .update({
      title: parsed.data.title,
      description: parsed.data.description,
      external_url: parsed.data.externalUrl,
      image_paths: parsed.data.imagePaths,
      sort_order: parsed.data.sortOrder,
    })
    .eq("id", id.data.id)
    .eq("freelancer_id", guard.value.user.id);
  if (error) return fail(mapPostgresError(error), raw);
  revalidatePath("/dashboard/portfolio");
  revalidatePath(`/u/${guard.value.profile.username}`);
  return ok(null, "Karya portofolio berhasil diperbarui.");
}

export async function deletePortfolioItemAction(input: { id: string }) {
  const guard = await guardOnboarded();
  if (!guard.ok) return guard.result;
  const id = portfolioIdSchema.safeParse(input);
  if (!id.success) return validationFailed(id.error);
  const supabase = await createClient();
  const { data: item } = await supabase
    .from("portfolio_items")
    .select("image_paths")
    .eq("id", id.data.id)
    .eq("freelancer_id", guard.value.user.id)
    .maybeSingle();
  const { error } = await supabase
    .from("portfolio_items")
    .delete()
    .eq("id", id.data.id)
    .eq("freelancer_id", guard.value.user.id);
  if (error) return fail(mapPostgresError(error));
  if (item?.image_paths.length)
    await supabase.storage.from(PORTFOLIO_BUCKET).remove(item.image_paths);
  revalidatePath("/dashboard/portfolio");
  revalidatePath(`/u/${guard.value.profile.username}`);
  return ok({ deleted: true }, "Karya portofolio dihapus.");
}
