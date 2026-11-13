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
