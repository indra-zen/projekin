import { describe, expect, it } from "vitest";
import {
  MIDTRANS_SNAP_ORIGIN,
  contentSecurityPolicy,
  securityHeaders,
} from "../../next.config";

const SUPABASE = "https://abcdefghijklmnopqrst.supabase.co";

function directives(policy: string): Map<string, string[]> {
  return new Map(
    policy.split(";").map((part) => {
      const [name, ...values] = part.trim().split(/\s+/);
      return [name!, values];
    }),
  );
}

describe("Content-Security-Policy (ARCHITECTURE §12.1, Phase 10)", () => {
  it("ships the full policy Report-Only next to enforced framing protection", () => {
    const byKey = Object.fromEntries(
      securityHeaders.map((h) => [h.key, h.value]),
    );
    expect(byKey["Content-Security-Policy"]).toBe("frame-ancestors 'none'");
    // Tests run with NODE_ENV=test, so this is the production policy.
    expect(byKey["Content-Security-Policy-Report-Only"]).toBe(
      contentSecurityPolicy(),
    );
  });

  it("pins every external origin the app's own document uses", () => {
    const d = directives(contentSecurityPolicy({ supabase: SUPABASE }));
    expect(d.get("default-src")).toEqual(["'self'"]);
    expect(d.get("script-src")).toEqual([
      "'self'",
      "'unsafe-inline'",
      MIDTRANS_SNAP_ORIGIN,
    ]);
    expect(d.get("frame-src")).toEqual([MIDTRANS_SNAP_ORIGIN]);
    expect(d.get("connect-src")).toEqual(["'self'", SUPABASE]);
    expect(d.get("img-src")).toEqual(["'self'", "data:", "blob:", SUPABASE]);
    expect(d.get("frame-ancestors")).toEqual(["'none'"]);
    expect(d.get("object-src")).toEqual(["'none'"]);
    expect(d.get("base-uri")).toEqual(["'self'"]);
    expect(d.get("form-action")).toEqual(["'self'"]);
  });

  it("allows eval and websockets only in development (Fast Refresh)", () => {
    const prod = contentSecurityPolicy({ supabase: SUPABASE });
    const dev = contentSecurityPolicy({ supabase: SUPABASE, dev: true });
    expect(prod).not.toContain("'unsafe-eval'");
    expect(prod).not.toContain("ws:");
    expect(directives(dev).get("script-src")).toContain("'unsafe-eval'");
    expect(directives(dev).get("connect-src")).toEqual(
      expect.arrayContaining(["ws:", "wss:"]),
    );
  });

  it("uses the Supabase origin only, never a path", () => {
    const policy = contentSecurityPolicy();
    const img = directives(policy).get("img-src") ?? [];
    const origin = img.at(-1) ?? "";
    // From NEXT_PUBLIC_SUPABASE_URL (https in production, http://127.0.0.1 in
    // CI) or the *.supabase.co fallback; either way an origin, not a URL.
    expect(origin).toMatch(/^https?:\/\/[^/\s]+$/);
    expect(directives(policy).get("connect-src")).toContain(origin);
  });

  it("strips the path from NEXT_PUBLIC_SUPABASE_URL", () => {
    const saved = process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321/rest/v1/";
    try {
      expect(directives(contentSecurityPolicy()).get("img-src")).toContain(
        "http://127.0.0.1:54321",
      );
    } finally {
      if (saved === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      else process.env.NEXT_PUBLIC_SUPABASE_URL = saved;
    }
  });
});
