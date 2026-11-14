"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/common";
import {
  fail,
  ok,
  validationFailed,
  type ActionResult,
  type FormState,
} from "@/server/action-result";
import { guardAdmin } from "@/server/auth";
import { mapPostgresError } from "@/server/errors";
import { z } from "@/lib/validation/zod";

const schema = z.object({
  universityId: uuidSchema,
  domains: z.string().max(3000),
});

/** One domain per line (commas and spaces also separate). The RPC validates. */
export async function setUniversityDomainsAction(
  _prev: FormState,
  formData: FormData,
): Promise<ActionResult> {
  const guard = await guardAdmin();
  if (!guard.ok) return guard.result;
  const values = {
    universityId: String(formData.get("universityId") ?? ""),
    domains: String(formData.get("domains") ?? ""),
  };
  const parsed = schema.safeParse(values);
  if (!parsed.success) return validationFailed(parsed.error, values);
  const domains = parsed.data.domains.split(/[\s,;]+/).filter(Boolean);
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_university_domains", {
    p_university_id: parsed.data.universityId,
    p_domains: domains,
  });
  if (error) return fail(mapPostgresError(error), values);
  revalidatePath("/admin/universities");
  revalidatePath("/dashboard/verification");
  return ok(
    null,
    domains.length > 0
      ? "Domain email disimpan. Mahasiswa dengan email ini langsung terverifikasi."
      : "Domain dihapus. Verifikasi kampus ini hanya lewat unggah KTM.",
  );
}
