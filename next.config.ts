import type { NextConfig } from "next";

/** Snap.js and the Snap popup (sandbox only, like `src/server/payments/config.ts`). */
export const MIDTRANS_SNAP_ORIGIN = "https://app.sandbox.midtrans.com";

/** Browser-side Supabase traffic: Storage uploads, signed URLs, public images. */
function supabaseOrigin(): string {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    return "https://*.supabase.co";
  }
}

/**
 * ARCHITECTURE §12.1: the full policy. Next.js renders inline bootstrap
 * scripts without a nonce, hence `'unsafe-inline'` for scripts; the policy
 * still pins every external origin. Development adds what Fast Refresh needs.
 */
export function contentSecurityPolicy({
  dev = false,
  supabase = supabaseOrigin(),
}: { dev?: boolean; supabase?: string } = {}): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""} ${MIDTRANS_SNAP_ORIGIN}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${supabase}`,
    "font-src 'self' data:",
    `connect-src 'self' ${supabase}${dev ? " ws: wss:" : ""}`,
    `frame-src ${MIDTRANS_SNAP_ORIGIN}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}

/**
 * ARCHITECTURE §12.1. Framing protection is enforced from day one (clickjacking
 * on pay, cancel and confirm buttons). The full policy ships Report-Only first
 * (Phase 10): browsers report violations in the console without blocking, so
 * it can be checked against real Snap and Supabase traffic before enforcing.
 */
export const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  {
    key: "Content-Security-Policy-Report-Only",
    value: contentSecurityPolicy({
      dev: process.env.NODE_ENV === "development",
    }),
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  typedRoutes: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
