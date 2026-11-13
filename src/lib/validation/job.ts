import { optionalText, uuidSchema } from "./common";
import { z } from "./zod";

const idr = (label: string) =>
  z.coerce
    .number({ error: `${label} wajib diisi.` })
    .int({ error: `${label} harus bilangan bulat.` })
    .min(10_000, { error: `${label} minimal Rp10.000.` })
    .max(50_000_000, { error: `${label} maksimal Rp50.000.000.` });

/** YYYY-MM-DD for "today" in Asia/Jakarta. */
export function todayJakarta(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(
    now,
  );
}

export const jobSchema = z
  .object({
    categoryId: z
      .string()
      .min(1, { error: "Pilih kategori." })
      .pipe(uuidSchema),
    title: z
      .string()
      .trim()
      .min(10, { error: "Judul minimal 10 karakter." })
      .max(100, { error: "Judul maksimal 100 karakter." }),
    description: z
      .string()
      .trim()
      .min(50, { error: "Deskripsi minimal 50 karakter." })
      .max(5000, { error: "Deskripsi maksimal 5.000 karakter." }),
    requirements: optionalText(3000, "Persyaratan"),
    budgetMin: idr("Anggaran minimum"),
    budgetMax: idr("Anggaran maksimum"),
    deadline: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value ? value : null))
      .pipe(
        z.iso
          .date({ error: "Tanggal tenggat tidak valid." })
          .refine((value) => value >= todayJakarta(), {
            error: "Tenggat tidak boleh di masa lalu.",
          })
          .nullable(),
      ),
  })
  .refine((value) => value.budgetMin <= value.budgetMax, {
    error: "Anggaran maksimum harus ≥ anggaran minimum.",
    path: ["budgetMax"],
  });

export const jobIdSchema = z.object({ id: uuidSchema });

export const closeJobSchema = z.object({
  id: uuidSchema,
  reason: optionalText(500, "Alasan"),
});

export const proposalSchema = z.object({
  jobId: uuidSchema,
  coverLetter: z
    .string()
    .trim()
    .min(50, { error: "Surat pengantar minimal 50 karakter." })
    .max(3000, { error: "Surat pengantar maksimal 3.000 karakter." }),
  price: idr("Harga penawaran"),
  deliveryDays: z.coerce
    .number({ error: "Waktu pengerjaan wajib diisi." })
    .int()
    .min(1, { error: "Waktu pengerjaan minimal 1 hari." })
    .max(60, { error: "Waktu pengerjaan maksimal 60 hari." }),
  revisionsIncluded: z.coerce
    .number({ error: "Jumlah revisi wajib diisi." })
    .int()
    .min(0, { error: "Revisi minimal 0." })
    .max(5, { error: "Revisi maksimal 5." }),
});

export const proposalIdSchema = z.object({ proposalId: uuidSchema });

export const rejectProposalSchema = z.object({
  proposalId: uuidSchema,
  reason: optionalText(500, "Alasan"),
});

export const cancelOrderSchema = z.object({
  orderId: uuidSchema,
  reason: z
    .string()
    .trim()
    .min(1, { error: "Alasan pembatalan wajib diisi." })
    .max(500, { error: "Alasan maksimal 500 karakter." }),
});

/** /jobs search params. Invalid values fall back to defaults (never an error page). */
const jobsSearchShape = z.object({
  q: z.string().trim().max(100).catch(""),
  category: z
    .string()
    .regex(/^[a-z0-9-]{2,50}$/)
    .optional()
    .catch(undefined),
  minBudget: z.coerce
    .number()
    .int()
    .min(0)
    .max(50_000_000)
    .optional()
    .catch(undefined),
  maxBudget: z.coerce
    .number()
    .int()
    .min(0)
    .max(50_000_000)
    .optional()
    .catch(undefined),
  sort: z.enum(["newest", "budget_desc"]).catch("newest"),
  page: z.coerce.number().int().min(1).max(500).catch(1),
});

export type JobsSearch = z.infer<typeof jobsSearchShape>;

export function parseJobsSearch(
  params: Record<string, string | string[] | undefined>,
): JobsSearch {
  const pick = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };
  return jobsSearchShape.parse({
    q: pick("q") ?? "",
    category: pick("category") || undefined,
    minBudget: pick("minBudget") || undefined,
    maxBudget: pick("maxBudget") || undefined,
    sort: pick("sort") ?? "newest",
    page: pick("page") ?? 1,
  });
}

/** Keeps only letters, digits, spaces, `_` and `-` for full-text search input. */
export function sanitizeSearchTerm(raw: string): string {
  return raw
    .replace(/[^\p{L}\p{N}\s_-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}
