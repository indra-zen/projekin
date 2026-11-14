import { z } from "./zod";
import { optionalText, uuidSchema } from "./common";

const idrSchema = z.coerce.number().int().min(10000).max(50000000);

export const serviceSchema = z.object({
  categoryId: uuidSchema,
  title: z.string().trim().min(10).max(100),
  description: z.string().trim().min(50).max(5000),
  price: idrSchema,
  deliveryDays: z.coerce.number().int().min(1).max(60),
  revisionsIncluded: z.coerce.number().int().min(0).max(5),
  requirementsPrompt: optionalText(1000, "Kebutuhan klien"),
  coverImagePath: z.string().trim().min(1).max(300).nullable(),
});

export const serviceIdSchema = z.object({ id: uuidSchema });
export const serviceStatusSchema = z.enum(["published", "paused", "archived"]);

export const SERVICE_SORTS = [
  "newest",
  "price_asc",
  "price_desc",
  "rating",
] as const;

/** /services search params (API_CONTRACT §5.1). Invalid values fall back to defaults. */
const servicesSearchShape = z.object({
  q: z.string().trim().max(100).catch(""),
  category: z
    .string()
    .regex(/^[a-z0-9-]{2,50}$/)
    .optional()
    .catch(undefined),
  minPrice: z.coerce
    .number()
    .int()
    .min(0)
    .max(50_000_000)
    .optional()
    .catch(undefined),
  maxPrice: z.coerce
    .number()
    .int()
    .min(0)
    .max(50_000_000)
    .optional()
    .catch(undefined),
  sort: z.enum(SERVICE_SORTS).catch("newest"),
  page: z.coerce.number().int().min(1).max(500).catch(1),
});

export type ServicesSearch = z.infer<typeof servicesSearchShape>;

export function parseServicesSearch(
  params: Record<string, string | string[] | undefined>,
): ServicesSearch {
  const pick = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };
  return servicesSearchShape.parse({
    q: pick("q") ?? "",
    category: pick("category") || undefined,
    minPrice: pick("minPrice") || undefined,
    maxPrice: pick("maxPrice") || undefined,
    sort: pick("sort") ?? "newest",
    page: pick("page") ?? 1,
  });
}
