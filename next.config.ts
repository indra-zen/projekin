import type { NextConfig } from "next";

/**
 * ARCHITECTURE §12.1. Framing protection applies from day one (clickjacking
 * on pay, cancel and confirm buttons); the full CSP with Snap and Supabase
 * sources ships Report-Only in Phase 10. HSTS comes from Vercel.
 */
export const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
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
