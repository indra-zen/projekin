import { z } from "zod";

/**
 * Public (browser-safe) environment. Only NEXT_PUBLIC_* values belong here.
 * Server secrets (e.g. SUPABASE_SECRET_KEY) must never be added to this module:
 * it is imported by client components. Server-only secrets are read in
 * src/server/payments/config.ts and src/lib/supabase/admin.ts.
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  /** Absolute site URL used for auth email redirects. Falls back to the request origin. */
  NEXT_PUBLIC_SITE_URL: z.url().optional(),
  /** Midtrans Sandbox client key for Snap.js. Without it, checkout falls back to the Snap redirect page. */
  NEXT_PUBLIC_MIDTRANS_CLIENT_KEY: z.string().min(1).optional(),
});

export const env = publicEnvSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || undefined,
  NEXT_PUBLIC_MIDTRANS_CLIENT_KEY:
    process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || undefined,
});
