import { z } from "./zod";

export const USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/;

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(USERNAME_PATTERN, {
    error:
      "Username 3–30 karakter, hanya huruf kecil, angka, atau garis bawah (_).",
  });

export const fullNameSchema = z
  .string()
  .trim()
  .min(1, { error: "Nama lengkap wajib diisi." })
  .max(100, { error: "Nama lengkap maksimal 100 karakter." });

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Alamat email tidak valid." }));

export const passwordSchema = z
  .string()
  .min(8, { error: "Kata sandi minimal 8 karakter." })
  .max(72, { error: "Kata sandi maksimal 72 karakter." });

export const uuidSchema = z.uuid({ error: "ID tidak valid." });

/** Optional free text: trimmed, empty string becomes null. */
export function optionalText(max: number, label: string) {
  return z
    .string()
    .trim()
    .max(max, { error: `${label} maksimal ${max} karakter.` })
    .optional()
    .transform((value) => (value ? value : null));
}

/** Converts FormData to a plain object (last value wins for repeated keys). */
export function formDataToObject(formData: FormData): Record<string, string> {
  const result: Record<string, string> = {};
  formData.forEach((value, key) => {
    if (typeof value === "string" && !key.startsWith("$ACTION")) {
      result[key] = value;
    }
  });
  return result;
}
