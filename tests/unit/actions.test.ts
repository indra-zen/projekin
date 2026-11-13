import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fakeSupabase,
  formData,
  profileRow,
  type FakeOptions,
} from "./fake-supabase";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
});

const state = vi.hoisted(() => ({ client: null as unknown }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => state.client,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ origin: "http://localhost:3000" }),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url });
  }),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

const UID = "6f1c2e3a-0b4d-4e5f-8a9b-0c1d2e3f4a5b";
const OTHER = "11111111-2222-4333-8444-555555555555";
const RID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const UNI = "22222222-3333-4444-8555-666666666666";

function setup(options: FakeOptions) {
  const fake = fakeSupabase(options);
  state.client = fake.client;
  return fake;
}

beforeEach(() => {
  vi.resetModules();
});

async function actions() {
  const verification = await import("@/server/actions/verification");
  const profile = await import("@/server/actions/profile");
  return { ...verification, ...profile };
}

describe("submitVerificationAction", () => {
  it("rejects unauthenticated callers before touching the database", async () => {
    const fake = setup({ userId: null });
    const { submitVerificationAction } = await actions();
    const result = await submitVerificationAction(
      null,
      formData({
        method: "document",
        universityId: UNI,
        studentNumber: "1",
        documentPath: `${UID}/${RID}.png`,
      }),
    );
    expect(result).toMatchObject({
      ok: false,
      error: { code: "UNAUTHENTICATED" },
    });
    expect(fake.rpc).not.toHaveBeenCalled();
  });

  it("rejects users who have not completed onboarding", async () => {
    const fake = setup({
      userId: UID,
      profile: profileRow(UID, { onboarded_at: null }),
    });
    const { submitVerificationAction } = await actions();
    const result = await submitVerificationAction(
      null,
      formData({ method: "email_domain", universityId: UNI }),
    );
    expect(result).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN", reason: "NOT_ONBOARDED" },
    });
    expect(fake.rpc).not.toHaveBeenCalled();
  });

  it("rejects a document path in another user's folder", async () => {
    const fake = setup({ userId: UID, profile: profileRow(UID) });
    const { submitVerificationAction } = await actions();
    const result = await submitVerificationAction(
      null,
      formData({
        method: "document",
        universityId: UNI,
        studentNumber: "1",
        documentPath: `${OTHER}/${RID}.png`,
      }),
    );
    expect(result).toMatchObject({
      ok: false,
      error: { reason: "DOCUMENT_NOT_FOUND" },
    });
    expect(fake.rpc).not.toHaveBeenCalled();
  });

  it("ignores client-supplied status fields and calls the RPC with validated input only", async () => {
    const fake = setup({
      userId: UID,
      profile: profileRow(UID),
      rpc: () => ({ data: { status: "pending" }, error: null }),
    });
    const { submitVerificationAction } = await actions();
    const result = await submitVerificationAction(
      null,
      formData({
        method: "document",
        universityId: UNI,
        studentNumber: "2450047",
        documentPath: `${UID}/${RID}.png`,
        status: "approved",
        verified: "true",
      }),
    );
    expect(result).toMatchObject({ ok: true });
    expect(fake.rpc).toHaveBeenCalledWith("submit_student_verification", {
      p_university_id: UNI,
      p_method: "document",
      p_student_number: "2450047",
      p_document_path: `${UID}/${RID}.png`,
    });
  });

  it("maps database rejections to Indonesian messages", async () => {
    setup({
      userId: UID,
      profile: profileRow(UID),
      rpc: () => ({
        data: null,
        error: { code: "PJ409", message: "VERIFICATION_PENDING" },
      }),
    });
    const { submitVerificationAction } = await actions();
    const result = await submitVerificationAction(
      null,
      formData({ method: "email_domain", universityId: UNI }),
    );
    expect(result).toMatchObject({
      ok: false,
      error: {
        code: "CONFLICT",
        message:
          "Anda masih memiliki pengajuan verifikasi yang sedang ditinjau.",
      },
    });
  });
});

describe("reviewVerificationAction", () => {
  it("is refused for non-admins without calling the RPC", async () => {
    const fake = setup({
      userId: UID,
      profile: profileRow(UID),
      isAdmin: false,
    });
    const { reviewVerificationAction } = await actions();
    const result = await reviewVerificationAction(
      null,
      formData({
        decision: "approve",
        verificationId: RID,
        validUntil: "2027-11-13",
      }),
    );
    expect(result).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(fake.rpc).not.toHaveBeenCalled();
  });

  it("passes the approval to the RPC for admins", async () => {
    const fake = setup({
      userId: UID,
      profile: profileRow(UID),
      isAdmin: true,
      rpc: () => ({ data: { status: "approved" }, error: null }),
    });
    const { reviewVerificationAction } = await actions();
    const result = await reviewVerificationAction(
      null,
      formData({
        decision: "approve",
        verificationId: RID,
        validUntil: "2027-11-13",
      }),
    );
    expect(result).toMatchObject({ ok: true });
    expect(fake.rpc).toHaveBeenCalledWith("review_student_verification", {
      p_verification_id: RID,
      p_decision: "approve",
      p_valid_until: "2027-11-13T23:59:59+07:00",
      p_reason: null,
    });
  });
});

describe("profile actions", () => {
  it("only updates the signed-in user's own row with editable columns", async () => {
    const fake = setup({
      userId: UID,
      profile: profileRow(UID),
      update: () => ({ data: { username: "rina_b" }, error: null }),
    });
    const { updateProfileAction } = await actions();
    const result = await updateProfileAction(
      null,
      formData({
        fullName: "Rina B",
        username: "rina_b",
        bio: "",
        location: "Tarakan",
        id: OTHER,
        onboarded_at: "",
        avatar_path: `${OTHER}/x.png`,
      }),
    );
    expect(result).toMatchObject({ ok: true });
    expect(fake.updates).toEqual([
      {
        table: "profiles",
        values: {
          full_name: "Rina B",
          username: "rina_b",
          bio: null,
          location: "Tarakan",
        },
      },
    ]);
  });

  it("returns field errors for an invalid username", async () => {
    const fake = setup({ userId: UID, profile: profileRow(UID) });
    const { updateProfileAction } = await actions();
    const result = await updateProfileAction(
      null,
      formData({ fullName: "Rina", username: "No Spaces" }),
    );
    expect(result).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR" },
    });
    if (result && !result.ok)
      expect(result.error.fieldErrors?.username).toBeDefined();
    expect(fake.updates).toEqual([]);
  });

  it("refuses avatar paths outside the user's folder", async () => {
    const fake = setup({ userId: UID, profile: profileRow(UID) });
    const { updateAvatarAction } = await actions();
    const result = await updateAvatarAction({ path: `${OTHER}/${RID}.png` });
    expect(result).toMatchObject({
      ok: false,
      error: { reason: "INVALID_AVATAR_PATH" },
    });
    expect(fake.updates).toEqual([]);
  });

  it("saves a valid avatar and removes the previous file", async () => {
    const fake = setup({
      userId: UID,
      profile: profileRow(UID, { avatar_path: `${UID}/old.png` }),
    });
    const { updateAvatarAction } = await actions();
    const result = await updateAvatarAction({ path: `${UID}/${RID}.png` });
    expect(result).toMatchObject({ ok: true });
    expect(fake.updates).toEqual([
      { table: "profiles", values: { avatar_path: `${UID}/${RID}.png` } },
    ]);
    expect(fake.storageRemove).toHaveBeenCalledWith([`${UID}/old.png`]);
  });

  it("maps a taken username during onboarding", async () => {
    setup({
      userId: UID,
      profile: profileRow(UID, { onboarded_at: null }),
      rpc: () => ({
        data: null,
        error: { code: "PJ409", message: "USERNAME_TAKEN" },
      }),
    });
    const { completeOnboardingAction } = await actions();
    const result = await completeOnboardingAction(
      null,
      formData({ fullName: "Rina", username: "rina_a", acceptTerms: "on" }),
    );
    expect(result).toMatchObject({
      ok: false,
      error: {
        code: "CONFLICT",
        message: "Username sudah dipakai. Pilih username lain.",
      },
    });
  });
});
