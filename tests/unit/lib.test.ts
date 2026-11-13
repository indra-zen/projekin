import { describe, expect, it } from "vitest";
import {
  isGuestOnlyPath,
  isProtectedPath,
  safeNextPath,
} from "@/lib/auth/routes";
import { getCapabilities, isVerifiedStudent } from "@/lib/capabilities";
import { isoDateInMonths } from "@/lib/format";
import {
  DOCUMENT_TYPES,
  IMAGE_TYPES,
  buildObjectPath,
  isOwnObjectPath,
  publicObjectUrl,
  validateUpload,
} from "@/lib/storage";

const UID = "6f1c2e3a-0b4d-4e5f-8a9b-0c1d2e3f4a5b";
const OTHER = "11111111-2222-4333-8444-555555555555";
const RID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

describe("safeNextPath (open-redirect protection)", () => {
  it.each([
    ["/dashboard", "/dashboard"],
    ["/u/rina?tab=1", "/u/rina?tab=1"],
  ])("accepts %s", (input, expected) => {
    expect(safeNextPath(input, "/fallback")).toBe(expected);
  });

  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    "dashboard",
    "/ok\nSet-Cookie: x",
    "",
    null,
    undefined,
  ])("rejects %s", (input) => {
    expect(safeNextPath(input, "/fallback")).toBe("/fallback");
  });
});

describe("route classification", () => {
  it("protects dashboard, admin and onboarding paths", () => {
    expect(isProtectedPath("/dashboard")).toBe(true);
    expect(isProtectedPath("/dashboard/settings/profile")).toBe(true);
    expect(isProtectedPath("/admin/verifications/x")).toBe(true);
    expect(isProtectedPath("/onboarding")).toBe(true);
    expect(isProtectedPath("/dashboarding")).toBe(false);
    expect(isProtectedPath("/services")).toBe(false);
    expect(isProtectedPath("/u/rina")).toBe(false);
  });

  it("marks guest-only auth pages", () => {
    expect(isGuestOnlyPath("/login")).toBe(true);
    expect(isGuestOnlyPath("/register")).toBe(true);
    expect(isGuestOnlyPath("/reset-password")).toBe(false);
  });
});

describe("capabilities", () => {
  const base = { onboarded: true, isSuspended: false, isAdmin: false };

  it("gives every onboarded account client capabilities", () => {
    const caps = getCapabilities({ ...base, verificationState: "unverified" });
    expect(caps.canOrderServices).toBe(true);
    expect(caps.canPostJobs).toBe(true);
    expect(caps.canPublishServices).toBe(false);
    expect(caps.canSubmitProposals).toBe(false);
  });

  it.each(["unverified", "pending", "rejected"] as const)(
    "denies freelancer capabilities when %s",
    (state) => {
      const caps = getCapabilities({ ...base, verificationState: state });
      expect(caps.canPublishServices).toBe(false);
      expect(caps.canSubmitProposals).toBe(false);
    },
  );

  it("grants both client and freelancer capabilities to verified students", () => {
    const caps = getCapabilities({ ...base, verificationState: "verified" });
    expect(caps).toMatchObject({
      canOrderServices: true,
      canPostJobs: true,
      canPublishServices: true,
      canSubmitProposals: true,
      canReviewVerifications: false,
    });
  });

  it("denies freelancer capabilities when suspended or not onboarded", () => {
    expect(
      getCapabilities({
        ...base,
        verificationState: "verified",
        isSuspended: true,
      }).canPublishServices,
    ).toBe(false);
    expect(
      getCapabilities({
        ...base,
        verificationState: "verified",
        onboarded: false,
      }).canSubmitProposals,
    ).toBe(false);
  });

  it("verified-student badge requires active and unexpired", () => {
    const now = new Date("2026-11-13T00:00:00Z");
    expect(
      isVerifiedStudent(
        { status: "active", verified_until: "2027-01-01T00:00:00Z" },
        now,
      ),
    ).toBe(true);
    expect(
      isVerifiedStudent(
        { status: "active", verified_until: "2026-11-12T00:00:00Z" },
        now,
      ),
    ).toBe(false);
    expect(
      isVerifiedStudent(
        { status: "suspended", verified_until: "2027-01-01T00:00:00Z" },
        now,
      ),
    ).toBe(false);
    expect(isVerifiedStudent(null, now)).toBe(false);
  });
});

describe("storage helpers", () => {
  it("validates MIME type and size", () => {
    expect(
      validateUpload({ type: "image/png", size: 1000 }, IMAGE_TYPES),
    ).toBeNull();
    expect(
      validateUpload({ type: "image/svg+xml", size: 1000 }, IMAGE_TYPES),
    ).toMatch(/Format/);
    expect(
      validateUpload({ type: "application/pdf", size: 1000 }, IMAGE_TYPES),
    ).toMatch(/Format/);
    expect(
      validateUpload({ type: "application/pdf", size: 1000 }, DOCUMENT_TYPES),
    ).toBeNull();
    expect(
      validateUpload({ type: "image/png", size: 6 * 1024 * 1024 }, IMAGE_TYPES),
    ).toMatch(/5 MB/);
    expect(validateUpload({ type: "image/png", size: 0 }, IMAGE_TYPES)).toMatch(
      /kosong/,
    );
  });

  it("builds paths in the user's folder with an extension from the MIME type", () => {
    expect(buildObjectPath(UID, "image/jpeg", IMAGE_TYPES, RID)).toBe(
      `${UID}/${RID}.jpg`,
    );
    expect(buildObjectPath(UID, "text/html", IMAGE_TYPES, RID)).toBeNull();
  });

  it("accepts only the user's own generated paths", () => {
    expect(isOwnObjectPath(UID, `${UID}/${RID}.png`, IMAGE_TYPES)).toBe(true);
    expect(isOwnObjectPath(UID, `${OTHER}/${RID}.png`, IMAGE_TYPES)).toBe(
      false,
    );
    expect(
      isOwnObjectPath(UID, `${UID}/../${OTHER}/${RID}.png`, IMAGE_TYPES),
    ).toBe(false);
    expect(isOwnObjectPath(UID, `${UID}/${RID}.pdf`, IMAGE_TYPES)).toBe(false);
    expect(isOwnObjectPath(UID, `${UID}/${RID}.pdf`, DOCUMENT_TYPES)).toBe(
      true,
    );
    expect(isOwnObjectPath(UID, `${UID}/avatar.png`, IMAGE_TYPES)).toBe(false);
  });

  it("builds public URLs", () => {
    expect(
      publicObjectUrl("https://x.supabase.co/", "avatars", `${UID}/${RID}.png`),
    ).toBe(
      `https://x.supabase.co/storage/v1/object/public/avatars/${UID}/${RID}.png`,
    );
  });
});

describe("format", () => {
  it("computes date-input values in Asia/Jakarta", () => {
    // 2026-11-13 20:00 UTC is already 2026-11-14 in Jakarta (UTC+7).
    expect(isoDateInMonths(0, new Date("2026-11-13T20:00:00Z"))).toBe(
      "2026-11-14",
    );
    expect(isoDateInMonths(12, new Date("2026-11-13T00:00:00Z"))).toBe(
      "2027-11-13",
    );
  });
});
