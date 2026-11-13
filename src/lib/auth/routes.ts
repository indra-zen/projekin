/** Route prefixes that require a signed-in user (enforced again in layouts). */
export const PROTECTED_PREFIXES = [
  "/dashboard",
  "/admin",
  "/onboarding",
] as const;

/** Auth pages that signed-in users should not see. */
export const GUEST_ONLY_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isGuestOnlyPath(pathname: string): boolean {
  return (GUEST_ONLY_PATHS as readonly string[]).includes(pathname);
}

/**
 * Returns `next` only if it is a same-origin relative path ("/foo", not "//evil"
 * or "https://evil"); otherwise `fallback`. Prevents open redirects (SR-14).
 */
export function safeNextPath(
  next: string | null | undefined,
  fallback: string,
): string {
  if (!next) return fallback;
  if (
    !next.startsWith("/") ||
    next.startsWith("//") ||
    next.startsWith("/\\")
  ) {
    return fallback;
  }
  if (/[\u0000-\u001f]/.test(next)) return fallback;
  return next;
}
