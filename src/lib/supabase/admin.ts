import "server-only";

import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Supabase client with the **secret (service-role) key**. Bypasses RLS.
 *
 * Only for src/server/payments/** and src/app/api/** (enforced by ESLint),
 * and only to call the service-role RPCs (attach_snap_token,
 * fail_payment_attempt, apply_payment_status), log payment notifications and
 * read payments for reconciliation. Never use it to read data on behalf of a
 * user who has not been authorized through the user-scoped client first.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!key) {
    throw new Error("SUPABASE_SECRET_KEY is not set.");
  }
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
