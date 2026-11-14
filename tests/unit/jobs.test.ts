import { beforeEach, describe, expect, it, vi } from "vitest";
import { formatBudgetRange, formatOrderCode } from "@/lib/format";
import {
  jobSchema,
  parseJobsSearch,
  proposalSchema,
  sanitizeSearchTerm,
  todayJakarta,
} from "@/lib/validation/job";
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
const JOB = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const CAT = "22222222-3333-4444-8555-666666666666";
const ORDER = "33333333-4444-4555-8666-777777777777";

const validJob = {
  categoryId: CAT,
  title: "Landing page usaha kuliner",
  description:
    "Kami membutuhkan landing page responsif untuk usaha kuliner di Tarakan.",
  requirements: "",
  budgetMin: "500000",
  budgetMax: "1500000",
  deadline: "",
};

const validProposal = {
  jobId: JOB,
  coverLetter:
    "Saya mahasiswa Sistem Informasi dan sudah membuat beberapa landing page.",
  price: "1000000",
  deliveryDays: "7",
  revisionsIncluded: "1",
};

describe("job validation", () => {
  it("accepts a valid job and normalises optional fields", () => {
    expect(jobSchema.parse(validJob)).toMatchObject({
      budgetMin: 500000,
      budgetMax: 1500000,
      requirements: null,
      deadline: null,
    });
  });

  it("requires max budget ≥ min budget, and budgets within BR-07", () => {
    const swapped = jobSchema.safeParse({ ...validJob, budgetMin: "2000000" });
    expect(swapped.success).toBe(false);
    expect(swapped.error?.issues[0]?.path).toEqual(["budgetMax"]);
    expect(
      jobSchema.safeParse({ ...validJob, budgetMin: "5000" }).success,
    ).toBe(false);
    expect(
      jobSchema.safeParse({ ...validJob, budgetMax: "60000000" }).success,
    ).toBe(false);
  });

  it("rejects past deadlines and missing categories", () => {
    expect(
      jobSchema.safeParse({ ...validJob, deadline: "2000-01-01" }).success,
    ).toBe(false);
    expect(
      jobSchema.safeParse({ ...validJob, deadline: todayJakarta() }).success,
    ).toBe(true);
    const noCategory = jobSchema.safeParse({ ...validJob, categoryId: "" });
    expect(noCategory.error?.issues[0]?.message).toBe("Pilih kategori.");
  });

  it("validates proposals", () => {
    expect(proposalSchema.parse(validProposal)).toMatchObject({
      price: 1000000,
      deliveryDays: 7,
    });
    expect(
      proposalSchema.safeParse({ ...validProposal, coverLetter: "pendek" })
        .success,
    ).toBe(false);
    expect(
      proposalSchema.safeParse({ ...validProposal, deliveryDays: "61" })
        .success,
    ).toBe(false);
    expect(
      proposalSchema.safeParse({ ...validProposal, revisionsIncluded: "6" })
        .success,
    ).toBe(false);
    expect(
      proposalSchema.safeParse({ ...validProposal, price: "1000000.5" })
        .success,
    ).toBe(false);
  });
});

describe("jobs search params", () => {
  it("falls back to defaults for invalid values", () => {
    expect(
      parseJobsSearch({
        category: "<script>",
        sort: "evil",
        page: "-3",
        minBudget: "abc",
      }),
    ).toEqual({
      q: "",
      category: undefined,
      minBudget: undefined,
      maxBudget: undefined,
      sort: "newest",
      page: 1,
    });
  });

  it("parses valid values", () => {
    expect(
      parseJobsSearch({
        q: "logo",
        category: "desain",
        minBudget: "100000",
        sort: "budget_desc",
        page: "2",
      }),
    ).toMatchObject({
      q: "logo",
      category: "desain",
      minBudget: 100000,
      sort: "budget_desc",
      page: 2,
    });
  });

  it("strips characters that could break full-text queries", () => {
    expect(
      sanitizeSearchTerm(` desain "logo" & (web) | ${"x".repeat(200)}`),
    ).toMatch(/^desain logo web x+$/);
    expect(sanitizeSearchTerm(" desain   logo ").length).toBeLessThanOrEqual(
      100,
    );
  });
});

describe("format", () => {
  it("formats order codes and budget ranges", () => {
    expect(formatOrderCode(123)).toBe("PJK-000123");
    expect(formatBudgetRange(500000, 500000)).not.toContain("–");
    expect(formatBudgetRange(500000, 1500000)).toContain("–");
  });
});

// ---------------------------------------------------------------------------
// Server actions: authorization happens server-side, from database state
// ---------------------------------------------------------------------------

function setup(options: FakeOptions) {
  const fake = fakeSupabase(options);
  state.client = fake.client;
  return fake;
}

const verificationRow = (stateValue: string) => ({
  state: stateValue,
  is_suspended: false,
  verified_until: null,
  university_id: null,
  latest_request_id: null,
  latest_request_status: null,
  latest_rejection_reason: null,
  can_submit: false,
});

beforeEach(() => {
  vi.resetModules();
});

const jobActions = () => import("@/server/actions/jobs");

describe("submitProposalAction", () => {
  it("refuses users whose database verification state is not verified", async () => {
    const fake = setup({
      userId: UID,
      profile: profileRow(UID),
      rpc: (name) =>
        name === "get_my_verification_status"
          ? { data: verificationRow("pending"), error: null }
          : { data: null, error: null },
    });
    const { submitProposalAction } = await jobActions();
    const result = await submitProposalAction(
      null,
      formData({ ...validProposal, verified: "true" }),
    );
    expect(result).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN", reason: "FREELANCER_NOT_ELIGIBLE" },
    });
    expect(fake.rpc.mock.calls.map((c) => c[0])).not.toContain(
      "submit_proposal",
    );
  });

  it("sends validated values to the RPC for verified students", async () => {
    const fake = setup({
      userId: UID,
      profile: profileRow(UID),
      rpc: (name) =>
        name === "get_my_verification_status"
          ? { data: verificationRow("verified"), error: null }
          : { data: { job_id: JOB }, error: null },
    });
    const { submitProposalAction } = await jobActions();
    const result = await submitProposalAction(
      null,
      formData({ ...validProposal, status: "accepted" }),
    );
    expect(result).toMatchObject({ ok: true });
    expect(fake.rpc).toHaveBeenCalledWith("submit_proposal", {
      p_job_id: JOB,
      p_cover_letter: validProposal.coverLetter,
      p_price: 1000000,
      p_delivery_days: 7,
      p_revisions_included: 1,
    });
  });
});

describe("createJobAction", () => {
  it("always uses the signed-in user as client and never client-supplied status", async () => {
    const fake = setup({
      userId: UID,
      profile: profileRow(UID),
      reads: { jobs: { count: 0 } },
    });
    const { createJobAction } = await jobActions();
    await expect(
      createJobAction(
        null,
        formData({ ...validJob, client_id: OTHER, status: "filled" }),
      ),
    ).rejects.toMatchObject({ url: "/dashboard/jobs/new-id" });
    expect(fake.inserts).toHaveLength(1);
    expect(fake.inserts[0]!.values).toEqual({
      client_id: UID,
      category_id: CAT,
      title: validJob.title,
      description: validJob.description,
      requirements: null,
      budget_min: 500000,
      budget_max: 1500000,
      deadline: null,
    });
  });

  it("reports the active-job limit before inserting", async () => {
    const fake = setup({
      userId: UID,
      profile: profileRow(UID),
      reads: { jobs: { count: 10 } },
    });
    const { createJobAction } = await jobActions();
    const result = await createJobAction(null, formData(validJob));
    expect(result).toMatchObject({
      ok: false,
      error: { code: "LIMIT_REACHED", reason: "MAX_ACTIVE_JOBS" },
    });
    expect(fake.inserts).toHaveLength(0);
  });
});

describe("updateJobAction", () => {
  it("refuses to edit someone else's job", async () => {
    const fake = setup({
      userId: UID,
      profile: profileRow(UID),
      reads: {
        jobs: {
          data: {
            id: JOB,
            client_id: OTHER,
            status: "open",
            proposals: [{ count: 0 }],
          },
        },
      },
    });
    const { updateJobAction } = await jobActions();
    const result = await updateJobAction(
      null,
      formData({ ...validJob, id: JOB }),
    );
    expect(result).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND", reason: "JOB_NOT_FOUND" },
    });
    expect(fake.updates).toHaveLength(0);
  });

  it("refuses to edit once proposals exist (BR-30)", async () => {
    const fake = setup({
      userId: UID,
      profile: profileRow(UID),
      reads: {
        jobs: {
          data: {
            id: JOB,
            client_id: UID,
            status: "open",
            proposals: [{ count: 2 }],
          },
        },
      },
    });
    const { updateJobAction } = await jobActions();
    const result = await updateJobAction(
      null,
      formData({ ...validJob, id: JOB }),
    );
    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_STATE", reason: "JOB_NOT_EDITABLE" },
    });
    expect(fake.updates).toHaveLength(0);
  });
});

describe("acceptProposalAction", () => {
  it("opens the new order after a successful hire", async () => {
    const fake = setup({
      userId: UID,
      profile: profileRow(UID),
      rpc: () => ({ data: ORDER, error: null }),
    });
    const { acceptProposalAction } = await jobActions();
    await expect(
      acceptProposalAction(null, formData({ proposalId: JOB })),
    ).rejects.toMatchObject({
      url: `/dashboard/orders/${ORDER}`,
    });
    expect(fake.rpc).toHaveBeenCalledWith("accept_proposal", {
      p_proposal_id: JOB,
    });
  });

  it("maps a conflicting hire to an Indonesian message", async () => {
    setup({
      userId: UID,
      profile: profileRow(UID),
      rpc: () => ({
        data: null,
        error: { code: "PJ409", message: "JOB_NOT_OPEN" },
      }),
    });
    const { acceptProposalAction } = await jobActions();
    const result = await acceptProposalAction(
      null,
      formData({ proposalId: JOB }),
    );
    expect(result).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_STATE",
        message: "Lowongan ini sudah tidak menerima proposal atau perekrutan.",
      },
    });
  });

  it("rejects unauthenticated callers", async () => {
    const fake = setup({ userId: null });
    const { acceptProposalAction } = await jobActions();
    const result = await acceptProposalAction(
      null,
      formData({ proposalId: JOB }),
    );
    expect(result).toMatchObject({
      ok: false,
      error: { code: "UNAUTHENTICATED" },
    });
    expect(fake.rpc).not.toHaveBeenCalled();
  });
});
