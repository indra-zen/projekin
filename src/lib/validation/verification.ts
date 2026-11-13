import { optionalText, uuidSchema } from "./common";
import { z } from "./zod";

export const submitVerificationSchema = z.discriminatedUnion("method", [
  z.object({
    method: z.literal("email_domain"),
    universityId: uuidSchema,
  }),
  z.object({
    method: z.literal("document"),
    universityId: uuidSchema,
    studentNumber: z
      .string()
      .trim()
      .min(1, { error: "NIM wajib diisi." })
      .max(50, { error: "NIM maksimal 50 karakter." }),
    documentPath: z
      .string()
      .min(1, { error: "Unggah foto/scan KTM terlebih dahulu." })
      .max(300),
  }),
]);

export const reviewVerificationSchema = z.discriminatedUnion("decision", [
  z.object({
    decision: z.literal("approve"),
    verificationId: uuidSchema,
    validUntil: z.iso.date({ error: "Tanggal berlaku tidak valid." }),
  }),
  z.object({
    decision: z.literal("reject"),
    verificationId: uuidSchema,
    reason: z
      .string()
      .trim()
      .min(1, { error: "Alasan penolakan wajib diisi." })
      .max(500, { error: "Alasan maksimal 500 karakter." }),
  }),
]);

/** Comma-separated skills → unique, trimmed tags (case-insensitive de-dup). */
export const skillsSchema = z
  .string()
  .max(1000)
  .optional()
  .transform((raw) => {
    const seen = new Set<string>();
    const tags: string[] = [];
    for (const part of (raw ?? "").split(",")) {
      const tag = part.trim().replace(/\s+/g, " ");
      const key = tag.toLowerCase();
      if (tag && !seen.has(key)) {
        seen.add(key);
        tags.push(tag);
      }
    }
    return tags;
  })
  .pipe(
    z
      .array(
        z.string().max(30, { error: "Setiap keahlian maksimal 30 karakter." }),
      )
      .max(15, { error: "Maksimal 15 keahlian." }),
  );

export const freelancerProfileSchema = z.object({
  headline: optionalText(120, "Headline"),
  major: optionalText(100, "Program studi"),
  skills: skillsSchema,
});

/** End of the given calendar day in Asia/Jakarta (UTC+7), as ISO timestamp. */
export function endOfDayJakarta(isoDate: string): string {
  return `${isoDate}T23:59:59+07:00`;
}
