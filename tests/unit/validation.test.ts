import { describe, expect, it } from "vitest";
import {
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/lib/validation/auth";
import { formDataToObject } from "@/lib/validation/common";
import { onboardingSchema, profileSchema } from "@/lib/validation/profile";
import {
  endOfDayJakarta,
  freelancerProfileSchema,
  reviewVerificationSchema,
  submitVerificationSchema,
} from "@/lib/validation/verification";
import { validationFailed } from "@/server/action-result";

const UUID = "6f1c2e3a-0b4d-4e5f-8a9b-0c1d2e3f4a5b";

describe("auth schemas", () => {
  it("normalises email and validates password length", () => {
    const ok = registerSchema.parse({
      fullName: "  Rina ",
      email: " Rina@Example.COM ",
      password: "12345678",
    });
    expect(ok).toEqual({
      fullName: "Rina",
      email: "rina@example.com",
      password: "12345678",
    });
    const bad = registerSchema.safeParse({
      fullName: "",
      email: "nope",
      password: "short",
    });
    expect(bad.success).toBe(false);
    const fields = validationFailed(bad.error!);
    expect(fields.ok).toBe(false);
    if (!fields.ok) {
      expect(fields.error.fieldErrors?.fullName?.[0]).toBe(
        "Nama lengkap wajib diisi.",
      );
      expect(fields.error.fieldErrors?.email?.[0]).toBe(
        "Alamat email tidak valid.",
      );
      expect(fields.error.fieldErrors?.password?.[0]).toBe(
        "Kata sandi minimal 8 karakter.",
      );
    }
  });

  it("requires a password on login", () => {
    expect(
      loginSchema.safeParse({ email: "a@b.co", password: "" }).success,
    ).toBe(false);
  });

  it("requires matching passwords on reset", () => {
    const r = resetPasswordSchema.safeParse({
      password: "12345678",
      confirmPassword: "12345679",
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["confirmPassword"]);
  });
});

describe("profile schemas", () => {
  it("requires terms acceptance during onboarding", () => {
    expect(
      onboardingSchema.safeParse({ fullName: "Rina", username: "rina" })
        .success,
    ).toBe(false);
    expect(
      onboardingSchema.parse({
        fullName: "Rina",
        username: "Rina_A",
        acceptTerms: "on",
      }),
    ).toEqual({
      fullName: "Rina",
      username: "rina_a",
      acceptTerms: true,
    });
  });

  it.each(["ab", "with space", "dash-name", "x".repeat(31), "emoji😀"])(
    "rejects username %s",
    (username) => {
      expect(profileSchema.safeParse({ fullName: "A", username }).success).toBe(
        false,
      );
    },
  );

  it("turns empty optional text into null and enforces limits", () => {
    expect(
      profileSchema.parse({
        fullName: "A",
        username: "abc",
        bio: "  ",
        location: "",
      }),
    ).toMatchObject({
      bio: null,
      location: null,
    });
    expect(
      profileSchema.safeParse({
        fullName: "A",
        username: "abc",
        bio: "x".repeat(1001),
      }).success,
    ).toBe(false);
  });
});

describe("verification schemas", () => {
  it("requires student number and document for the document method", () => {
    expect(
      submitVerificationSchema.safeParse({
        method: "document",
        universityId: UUID,
      }).success,
    ).toBe(false);
    expect(
      submitVerificationSchema.parse({
        method: "document",
        universityId: UUID,
        studentNumber: " 2450047 ",
        documentPath: `${UUID}/${UUID}.png`,
      }),
    ).toMatchObject({ studentNumber: "2450047" });
  });

  it("only accepts known methods and decisions", () => {
    expect(
      submitVerificationSchema.safeParse({
        method: "admin_override",
        universityId: UUID,
      }).success,
    ).toBe(false);
    expect(
      reviewVerificationSchema.safeParse({
        decision: "maybe",
        verificationId: UUID,
      }).success,
    ).toBe(false);
  });

  it("requires a date to approve and a reason to reject", () => {
    expect(
      reviewVerificationSchema.safeParse({
        decision: "approve",
        verificationId: UUID,
      }).success,
    ).toBe(false);
    expect(
      reviewVerificationSchema.safeParse({
        decision: "approve",
        verificationId: UUID,
        validUntil: "2027-11-13",
      }).success,
    ).toBe(true);
    expect(
      reviewVerificationSchema.safeParse({
        decision: "reject",
        verificationId: UUID,
        reason: "  ",
      }).success,
    ).toBe(false);
  });

  it("parses comma-separated skills with de-duplication and limits", () => {
    expect(
      freelancerProfileSchema.parse({
        skills: " Figma, figma ,  Ilustrasi  Digital ,, ",
      }).skills,
    ).toEqual(["Figma", "Ilustrasi Digital"]);
    expect(
      freelancerProfileSchema.safeParse({ skills: "x".repeat(31) }).success,
    ).toBe(false);
    const many = Array.from({ length: 16 }, (_, i) => `s${i}`).join(",");
    expect(freelancerProfileSchema.safeParse({ skills: many }).success).toBe(
      false,
    );
  });

  it("converts a date to end of day in Asia/Jakarta", () => {
    expect(new Date(endOfDayJakarta("2027-11-13")).toISOString()).toBe(
      "2027-11-13T16:59:59.000Z",
    );
  });
});

describe("formDataToObject", () => {
  it("drops Next.js internal action fields and files", () => {
    const fd = new FormData();
    fd.set("email", "a@b.co");
    fd.set("$ACTION_ID_abc", "");
    fd.set("file", new Blob(["x"]));
    expect(formDataToObject(fd)).toEqual({ email: "a@b.co" });
  });
});
