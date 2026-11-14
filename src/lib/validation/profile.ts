import { fullNameSchema, optionalText, usernameSchema } from "./common";
import { z } from "./zod";

export const onboardingSchema = z.object({
  fullName: fullNameSchema,
  username: usernameSchema,
  acceptTerms: z
    .literal("on", { error: "Anda harus menyetujui Syarat & Ketentuan." })
    .transform(() => true as const),
});

export const profileSchema = z.object({
  fullName: fullNameSchema,
  username: usernameSchema,
  bio: optionalText(1000, "Bio"),
  location: optionalText(100, "Lokasi"),
});

export const avatarPathSchema = z.object({
  path: z.string().min(1).max(300),
});
