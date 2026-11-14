import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
});

const auth = vi.hoisted(() => ({ sub: null as string | null }));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getClaims: async () =>
        auth.sub
          ? { data: { claims: { sub: auth.sub } }, error: null }
          : { data: null, error: null },
    },
  }),
}));

const { updateSession } = await import("@/lib/supabase/proxy");

function request(path: string) {
  return new NextRequest(new URL(path, "http://localhost:3000"));
}

beforeEach(() => {
  auth.sub = null;
});

describe("proxy session handling", () => {
  it.each([
    "/dashboard",
    "/dashboard/verification",
    "/admin/verifications",
    "/onboarding",
  ])(
    "redirects signed-out visitors from %s to /login with next",
    async (path) => {
      const res = await updateSession(request(`${path}?x=1`));
      expect(res.status).toBe(307);
      const location = new URL(res.headers.get("location")!);
      expect(location.pathname).toBe("/login");
      expect(location.searchParams.get("next")).toBe(`${path}?x=1`);
    },
  );

  it("lets signed-out visitors open public pages", async () => {
    for (const path of ["/", "/services", "/u/rina", "/login"]) {
      const res = await updateSession(request(path));
      expect(res.headers.get("location")).toBeNull();
    }
  });

  it("sends signed-in users away from guest-only pages", async () => {
    auth.sub = "6f1c2e3a-0b4d-4e5f-8a9b-0c1d2e3f4a5b";
    const res = await updateSession(request("/login"));
    expect(new URL(res.headers.get("location")!).pathname).toBe("/dashboard");
  });

  it("lets signed-in users through to protected pages", async () => {
    auth.sub = "6f1c2e3a-0b4d-4e5f-8a9b-0c1d2e3f4a5b";
    const res = await updateSession(request("/dashboard"));
    expect(res.headers.get("location")).toBeNull();
  });
});
