import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth/routes";
import { createClient } from "@/lib/supabase/server";

const OTP_TYPES: readonly EmailOtpType[] = [
  "signup",
  "email",
  "recovery",
  "email_change",
  "invite",
  "magiclink",
];

const DEFAULT_NEXT: Partial<Record<EmailOtpType, string>> = {
  recovery: "/reset-password",
  email_change: "/dashboard/settings/profile",
};

/**
 * Landing point for Supabase email links (confirm sign-up, password recovery,
 * email change). Supports both the token-hash template
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/onboarding
 * and the default PKCE redirect (?code=...).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const rawType = searchParams.get("type");
  const code = searchParams.get("code");
  const type = OTP_TYPES.find((t) => t === rawType);
  const next = safeNextPath(
    searchParams.get("next"),
    (type && DEFAULT_NEXT[type]) ?? "/onboarding",
  );

  const supabase = await createClient();
  let ok = false;

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    ok = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  }

  const target = request.nextUrl.clone();
  target.search = "";
  if (ok) {
    const [pathname, query] = next.split("?", 2);
    target.pathname = pathname ?? "/onboarding";
    if (query) target.search = `?${query}`;
  } else {
    target.pathname = "/login";
    target.searchParams.set("error", "link_invalid");
  }
  return NextResponse.redirect(target);
}
