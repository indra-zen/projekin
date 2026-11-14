import { z } from "./zod";
import { optionalText, uuidSchema } from "./common";

export const portfolioSchema = z.object({
  title: z.string().trim().min(1).max(100),
  description: optionalText(2000, "Deskripsi"),
  externalUrl: z
    .union([z.string().trim().url(), z.literal("")])
    .transform((value) => value || null)
    .refine(
      (value) => value === null || value.startsWith("https://"),
      "URL harus menggunakan HTTPS.",
    ),
  imagePaths: z.array(z.string().trim().min(1).max(300)).max(5),
  sortOrder: z.coerce.number().int().min(0).max(10000),
});

export const portfolioIdSchema = z.object({ id: uuidSchema });
