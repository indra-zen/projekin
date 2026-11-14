import "server-only";

import { headers } from "next/headers";
import { env } from "@/lib/env";

/**
 * Absolute origin for auth email links. Prefers NEXT_PUBLIC_SITE_URL; otherwise
 * uses the request Origin (Next.js verifies it matches the host for Server
 * Actions). Supabase additionally only redirects to allow-listed URLs.
 */
export async function siteOrigin(): Promise<string> {
  if (env.NEXT_PUBLIC_SITE_URL)
    return env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "");
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
