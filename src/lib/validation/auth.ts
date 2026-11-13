import { emailSchema, fullNameSchema, passwordSchema } from "./common";
import { z } from "./zod";

export const registerSchema = z.object({
  fullName: fullNameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { error: "Kata sandi wajib diisi." }).max(72),
  next: z.string().max(500).optional(),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    error: "Konfirmasi kata sandi tidak cocok.",
    path: ["confirmPassword"],
  });
