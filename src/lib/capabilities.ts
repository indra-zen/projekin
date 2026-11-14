import type { Enums } from "@/types/database";

export type VerificationState = Enums<"student_verification_state">;

export type CapabilityInput = {
  onboarded: boolean;
  verificationState: VerificationState;
  isSuspended: boolean;
  isAdmin: boolean;
};

export type Capabilities = {
  /** Client side: every onboarded account. */
  canOrderServices: boolean;
  canPostJobs: boolean;
  /** Freelancer side: verified students only (BR-01). */
  canPublishServices: boolean;
  canSubmitProposals: boolean;
  /** Admin side. */
  canReviewVerifications: boolean;
};

/**
 * Derives UI capabilities from server-loaded data. This only decides what to
 * SHOW; the database (RLS/RPC) remains the authority for what is ALLOWED.
 */
export function getCapabilities(input: CapabilityInput): Capabilities {
  const client = input.onboarded;
  const freelancer =
    input.onboarded &&
    input.verificationState === "verified" &&
    !input.isSuspended;
  return {
    canOrderServices: client,
    canPostJobs: client,
    canPublishServices: freelancer,
    canSubmitProposals: freelancer,
    canReviewVerifications: input.isAdmin,
  };
}

export const verificationStateLabels: Record<VerificationState, string> = {
  unverified: "Belum terverifikasi",
  pending: "Menunggu peninjauan",
  verified: "Terverifikasi",
  rejected: "Ditolak",
};

/** Public badge: a verified student has an active, unexpired freelancer profile. */
export function isVerifiedStudent(
  freelancer: { status: string; verified_until: string } | null | undefined,
  now: Date = new Date(),
): boolean {
  return (
    !!freelancer &&
    freelancer.status === "active" &&
    new Date(freelancer.verified_until).getTime() > now.getTime()
  );
}
