import "server-only";

import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import {
  getCapabilities,
  type Capabilities,
  type VerificationState,
} from "@/lib/capabilities";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";
import { fail, type ActionResult } from "./action-result";
import { messageFor } from "./error-messages";

export type AuthUser = { id: string; email: string | null };

export type VerificationStatus = {
  state: VerificationState;
  isSuspended: boolean;
  verifiedUntil: string | null;
  universityId: string | null;
  latestRequestId: string | null;
  latestRequestStatus: Tables<"student_verifications">["status"] | null;
  latestRejectionReason: string | null;
  canSubmit: boolean;
};

export type Viewer = {
  user: AuthUser;
  profile: Tables<"profiles">;
  isAdmin: boolean;
  onboarded: boolean;
};

/**
 * The signed-in user, verified server-side (`getClaims` validates the JWT).
 * Never derived from client-provided data. Cached per request.
 */
export const getAuthUser = cache(async (): Promise<AuthUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims || typeof claims.sub !== "string") return null;
  const sub = claims.sub;
  const email = typeof claims.email === "string" ? claims.email : null;
  return { id: sub, email };
});

/** User + profile + admin flag, loaded through RLS. Cached per request. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const user = await getAuthUser();
  if (!user) return null;
  const supabase = await createClient();
  const [{ data: profile }, { data: adminRow }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);
  if (!profile) return null;
  return {
    user,
    profile,
    isAdmin: Boolean(adminRow),
    onboarded: profile.onboarded_at !== null,
  };
});

/** Account-level student verification state from the database (never the client). */
export const getVerificationStatus = cache(
  async (): Promise<VerificationStatus | null> => {
    const user = await getAuthUser();
    if (!user) return null;
    const supabase = await createClient();
    const { data, error } = await supabase
      .rpc("get_my_verification_status")
      .single();
    if (error || !data) return null;
    return {
      state: data.state,
      isSuspended: data.is_suspended,
      verifiedUntil: data.verified_until,
      universityId: data.university_id,
      latestRequestId: data.latest_request_id,
      latestRequestStatus: data.latest_request_status,
      latestRejectionReason: data.latest_rejection_reason,
      canSubmit: data.can_submit,
    };
  },
);

export async function getViewerCapabilities(): Promise<Capabilities | null> {
  const viewer = await getViewer();
  if (!viewer) return null;
  const status = await getVerificationStatus();
  return getCapabilities({
    onboarded: viewer.onboarded,
    verificationState: status?.state ?? "unverified",
    isSuspended: status?.isSuspended ?? false,
    isAdmin: viewer.isAdmin,
  });
}

// ---------------------------------------------------------------------------
// Page/layout guards (redirect or 404)
// ---------------------------------------------------------------------------

export async function requireUser(nextPath = "/dashboard"): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return viewer;
}

export async function requireOnboarded(
  nextPath = "/dashboard",
): Promise<Viewer> {
  const viewer = await requireUser(nextPath);
  if (!viewer.onboarded) redirect("/onboarding");
  return viewer;
}

/** Non-admins get a 404 so the admin area is not revealed. */
export async function requireAdmin(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer || !viewer.isAdmin) notFound();
  return viewer;
}

// ---------------------------------------------------------------------------
// Server Action guards (return ActionResult failures instead of redirecting)
// ---------------------------------------------------------------------------

type Guard<T> =
  { ok: true; value: T } | { ok: false; result: ActionResult<never> };

function denied(
  code: "UNAUTHENTICATED" | "FORBIDDEN",
  reason: string,
): Guard<never> {
  return {
    ok: false,
    result: fail({
      code,
      reason,
      message: messageFor(code, reason),
    }) as ActionResult<never>,
  };
}

export async function guardUser(): Promise<Guard<Viewer>> {
  const viewer = await getViewer();
  return viewer
    ? { ok: true, value: viewer }
    : denied("UNAUTHENTICATED", "UNAUTHENTICATED");
}

export async function guardOnboarded(): Promise<Guard<Viewer>> {
  const guard = await guardUser();
  if (!guard.ok) return guard;
  return guard.value.onboarded ? guard : denied("FORBIDDEN", "NOT_ONBOARDED");
}

export async function guardAdmin(): Promise<Guard<Viewer>> {
  const guard = await guardUser();
  if (!guard.ok) return guard;
  return guard.value.isAdmin ? guard : denied("FORBIDDEN", "FORBIDDEN");
}

/**
 * For future service/proposal actions (BR-01). The state is read from the
 * database; RLS/RPCs on those tables enforce the same rule independently.
 */
export async function guardVerifiedFreelancer(): Promise<Guard<Viewer>> {
  const guard = await guardOnboarded();
  if (!guard.ok) return guard;
  const status = await getVerificationStatus();
  return status?.state === "verified" && !status.isSuspended
    ? guard
    : denied("FORBIDDEN", "FREELANCER_NOT_ELIGIBLE");
}
