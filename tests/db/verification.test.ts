import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import {
  as,
  createOnboardedUser,
  createTestDb,
  createUser,
  expectPgError,
  firstUniversityId,
  makeAdmin,
  putObject,
  user,
} from "./harness";

let db: PGlite;
let universityId: string;
let adminId: string;

type Status = {
  state: string;
  is_suspended: boolean;
  verified_until: Date | null;
  latest_request_status: string | null;
  latest_rejection_reason: string | null;
  can_submit: boolean;
};

beforeAll(async () => {
  db = await createTestDb();
  universityId = await firstUniversityId(db);
  adminId = await createOnboardedUser(db);
  await makeAdmin(db, adminId);
});

async function status(id: string): Promise<Status> {
  const r = await as(db, user(id), (tx) =>
    tx.query<Status>("select * from public.get_my_verification_status()"),
  );
  return r.rows[0]!;
}

async function submitDocument(id: string, path = `${id}/ktm.png`) {
  await putObject(db, "student-documents", path);
  const r = await as(db, user(id), (tx) =>
    tx.query<{ id: string; status: string }>(
      "select id, status from public.submit_student_verification($1, 'document', 'NIM-001', $2)",
      [universityId, path],
    ),
  );
  return r.rows[0]!;
}

async function review(
  actor: string,
  verificationId: string,
  decision: string,
  validUntil: string | null,
  reason: string | null = null,
) {
  return as(db, user(actor), (tx) =>
    tx.query(
      "select * from public.review_student_verification($1, $2, $3, $4)",
      [verificationId, decision, validUntil, reason],
    ),
  );
}

const inOneYear = () =>
  new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString();

async function isEligible(id: string): Promise<boolean> {
  const r = await db.query<{ ok: boolean }>(
    "select private.is_eligible_freelancer($1) as ok",
    [id],
  );
  return r.rows[0]!.ok;
}

describe("account verification state", () => {
  it("starts as unverified and can submit", async () => {
    const id = await createOnboardedUser(db);
    const s = await status(id);
    expect(s.state).toBe("unverified");
    expect(s.can_submit).toBe(true);
    expect(await isEligible(id)).toBe(false);
  });
});

describe("users cannot modify verification status themselves", () => {
  it("denies direct inserts and updates on student_verifications", async () => {
    const id = await createOnboardedUser(db);
    await expectPgError(
      as(db, user(id), (tx) =>
        tx.query(
          `insert into public.student_verifications (user_id, university_id, method, status, valid_until)
           values ($1, $2, 'email_domain', 'approved', now() + interval '1 year')`,
          [id, universityId],
        ),
      ),
      "42501",
    );
    const row = await submitDocument(id);
    await expectPgError(
      as(db, user(id), (tx) =>
        tx.query(
          "update public.student_verifications set status = 'approved' where id = $1",
          [row.id],
        ),
      ),
      "42501",
    );
  });

  it("denies creating or extending freelancer_profiles directly", async () => {
    const id = await createOnboardedUser(db);
    await expectPgError(
      as(db, user(id), (tx) =>
        tx.query(
          "insert into public.freelancer_profiles (user_id, university_id, verified_until) values ($1, $2, now() + interval '1 year')",
          [id, universityId],
        ),
      ),
      "42501",
    );
  });
});

describe("document verification + admin review", () => {
  it("requires onboarding", async () => {
    const id = await createUser(db);
    await putObject(db, "student-documents", `${id}/ktm.png`);
    await expectPgError(
      as(db, user(id), (tx) =>
        tx.query(
          "select public.submit_student_verification($1, 'document', 'NIM', $2)",
          [universityId, `${id}/ktm.png`],
        ),
      ),
      "PJ403",
      "NOT_ONBOARDED",
    );
  });

  it("requires an uploaded document in the caller's own folder", async () => {
    const id = await createOnboardedUser(db);
    const other = await createOnboardedUser(db);
    await expectPgError(
      as(db, user(id), (tx) =>
        tx.query(
          "select public.submit_student_verification($1, 'document', 'NIM', $2)",
          [universityId, `${id}/missing.png`],
        ),
      ),
      "PJ422",
      "DOCUMENT_NOT_FOUND",
    );
    await putObject(db, "student-documents", `${other}/ktm.png`);
    await expectPgError(
      as(db, user(id), (tx) =>
        tx.query(
          "select public.submit_student_verification($1, 'document', 'NIM', $2)",
          [universityId, `${other}/ktm.png`],
        ),
      ),
      "PJ422",
      "DOCUMENT_NOT_FOUND",
    );
  });

  it("requires a student number", async () => {
    const id = await createOnboardedUser(db);
    await putObject(db, "student-documents", `${id}/ktm.png`);
    await expectPgError(
      as(db, user(id), (tx) =>
        tx.query(
          "select public.submit_student_verification($1, 'document', '   ', $2)",
          [universityId, `${id}/ktm.png`],
        ),
      ),
      "PJ422",
      "INVALID_STUDENT_NUMBER",
    );
  });

  it("creates a pending request and blocks a second one", async () => {
    const id = await createOnboardedUser(db);
    const row = await submitDocument(id);
    expect(row.status).toBe("pending");
    const s = await status(id);
    expect(s.state).toBe("pending");
    expect(s.can_submit).toBe(false);
    await putObject(db, "student-documents", `${id}/ktm2.png`);
    await expectPgError(
      as(db, user(id), (tx) =>
        tx.query(
          "select public.submit_student_verification($1, 'document', 'NIM', $2)",
          [universityId, `${id}/ktm2.png`],
        ),
      ),
      "PJ409",
      "VERIFICATION_PENDING",
    );
  });

  it("hides requests from other users but shows them to admins", async () => {
    const id = await createOnboardedUser(db);
    const stranger = await createOnboardedUser(db);
    const row = await submitDocument(id);
    const bySelf = await as(db, user(id), (tx) =>
      tx.query("select id from public.student_verifications where id = $1", [
        row.id,
      ]),
    );
    const byStranger = await as(db, user(stranger), (tx) =>
      tx.query("select id from public.student_verifications where id = $1", [
        row.id,
      ]),
    );
    const byAdmin = await as(db, user(adminId), (tx) =>
      tx.query("select id from public.student_verifications where id = $1", [
        row.id,
      ]),
    );
    expect(bySelf.rows).toHaveLength(1);
    expect(byStranger.rows).toHaveLength(0);
    expect(byAdmin.rows).toHaveLength(1);
  });

  it("only lets admins review, and never their own request", async () => {
    const id = await createOnboardedUser(db);
    const row = await submitDocument(id);
    await expectPgError(
      review(id, row.id, "approve", inOneYear()),
      "PJ403",
      "FORBIDDEN",
    );

    const otherAdmin = await createOnboardedUser(db);
    await makeAdmin(db, otherAdmin);
    const own = await submitDocument(otherAdmin);
    await expectPgError(
      review(otherAdmin, own.id, "approve", inOneYear()),
      "PJ403",
      "CANNOT_REVIEW_OWN",
    );
  });

  it("validates the approval validity window", async () => {
    const id = await createOnboardedUser(db);
    const row = await submitDocument(id);
    await expectPgError(
      review(adminId, row.id, "approve", null),
      "PJ422",
      "VALID_UNTIL_OUT_OF_RANGE",
    );
    await expectPgError(
      review(
        adminId,
        row.id,
        "approve",
        new Date(Date.now() - 1000).toISOString(),
      ),
      "PJ422",
      "VALID_UNTIL_OUT_OF_RANGE",
    );
    await expectPgError(
      review(
        adminId,
        row.id,
        "approve",
        new Date(Date.now() + 3 * 365 * 24 * 3600 * 1000).toISOString(),
      ),
      "PJ422",
      "VALID_UNTIL_OUT_OF_RANGE",
    );
  });

  it("approval makes the user a verified, eligible freelancer", async () => {
    const id = await createOnboardedUser(db);
    const row = await submitDocument(id);
    await review(adminId, row.id, "approve", inOneYear());

    const s = await status(id);
    expect(s.state).toBe("verified");
    expect(s.verified_until).not.toBeNull();
    expect(await isEligible(id)).toBe(true);

    const fp = await db.query<{ university_id: string; status: string }>(
      "select university_id, status from public.freelancer_profiles where user_id = $1",
      [id],
    );
    expect(fp.rows[0]).toEqual({
      university_id: universityId,
      status: "active",
    });

    await expectPgError(
      review(adminId, row.id, "reject", null, "x"),
      "PJ409",
      "NOT_PENDING",
    );
  });

  it("rejection requires a reason, is visible to the user, and allows re-applying", async () => {
    const id = await createOnboardedUser(db);
    const row = await submitDocument(id);
    await expectPgError(
      review(adminId, row.id, "reject", null, "  "),
      "PJ422",
      "INVALID_REASON",
    );
    await review(adminId, row.id, "reject", null, "Foto KTM buram");

    const s = await status(id);
    expect(s.state).toBe("rejected");
    expect(s.latest_rejection_reason).toBe("Foto KTM buram");
    expect(s.can_submit).toBe(true);
    expect(await isEligible(id)).toBe(false);

    const again = await submitDocument(id, `${id}/ktm-baru.png`);
    expect(again.status).toBe("pending");
    expect((await status(id)).state).toBe("pending");
  });

  it("rejects unknown decisions", async () => {
    const id = await createOnboardedUser(db);
    const row = await submitDocument(id);
    await expectPgError(
      review(adminId, row.id, "maybe", inOneYear()),
      "PJ422",
      "INVALID_DECISION",
    );
  });
});

describe("email-domain verification", () => {
  let domainUniversity: string;

  beforeAll(async () => {
    const r = await db.query<{ id: string }>(
      "insert into public.universities (name, email_domains) values ('Kampus Uji', '{student.kampus.ac.id}') returning id",
    );
    domainUniversity = r.rows[0]!.id;
  });

  const submitEmail = (id: string) =>
    as(db, user(id), (tx) =>
      tx.query<{ status: string }>(
        "select status from public.submit_student_verification($1, 'email_domain')",
        [domainUniversity],
      ),
    );

  it("auto-approves a confirmed email on an exact listed domain", async () => {
    const id = await createOnboardedUser(db, {
      email: "rina@student.kampus.ac.id",
    });
    const r = await submitEmail(id);
    expect(r.rows[0]!.status).toBe("approved");
    expect((await status(id)).state).toBe("verified");
  });

  it("rejects unconfirmed emails, other domains and look-alike subdomains", async () => {
    const unconfirmed = await createOnboardedUser(db, {
      email: "a@student.kampus.ac.id",
      confirmed: false,
    });
    const otherDomain = await createOnboardedUser(db, { email: "b@gmail.com" });
    const lookAlike = await createOnboardedUser(db, {
      email: "c@evil.student.kampus.ac.id",
    });
    for (const id of [unconfirmed, otherDomain, lookAlike]) {
      await expectPgError(
        submitEmail(id),
        "PJ422",
        "EMAIL_DOMAIN_NOT_ELIGIBLE",
      );
    }
  });
});

describe("renewal, expiry and suspension", () => {
  async function verifiedUser(): Promise<string> {
    const id = await createOnboardedUser(db);
    const row = await submitDocument(id);
    await review(adminId, row.id, "approve", inOneYear());
    return id;
  }

  it("blocks new requests while verification is valid beyond the renewal window", async () => {
    const id = await verifiedUser();
    expect((await status(id)).can_submit).toBe(false);
    await putObject(db, "student-documents", `${id}/renew.png`);
    await expectPgError(
      as(db, user(id), (tx) =>
        tx.query(
          "select public.submit_student_verification($1, 'document', 'NIM', $2)",
          [universityId, `${id}/renew.png`],
        ),
      ),
      "PJ409",
      "ALREADY_VERIFIED",
    );
  });

  it("allows renewal within 30 days of expiry", async () => {
    const id = await verifiedUser();
    await db.query(
      "update public.freelancer_profiles set verified_until = now() + interval '10 days' where user_id = $1",
      [id],
    );
    expect((await status(id)).can_submit).toBe(true);
    const row = await submitDocument(id, `${id}/renew.png`);
    expect(row.status).toBe("pending");
    // Still verified while the renewal is pending.
    expect((await status(id)).state).toBe("verified");
  });

  it("expired verification is unverified and not eligible", async () => {
    const id = await verifiedUser();
    await db.query(
      "update public.freelancer_profiles set verified_until = now() - interval '1 day' where user_id = $1",
      [id],
    );
    expect((await status(id)).state).toBe("unverified");
    expect(await isEligible(id)).toBe(false);
  });

  it("suspended freelancers are not eligible", async () => {
    const id = await verifiedUser();
    await db.query(
      "update public.freelancer_profiles set status = 'suspended' where user_id = $1",
      [id],
    );
    const s = await status(id);
    expect(s.state).toBe("unverified");
    expect(s.is_suspended).toBe(true);
    expect(await isEligible(id)).toBe(false);
  });
});

describe("freelancer_profiles editing", () => {
  it("owners edit headline/skills/major but not system columns", async () => {
    const id = await createOnboardedUser(db);
    const row = await submitDocument(id);
    await review(adminId, row.id, "approve", inOneYear());

    const ok = await as(db, user(id), (tx) =>
      tx.query(
        "update public.freelancer_profiles set headline = 'Desainer logo', skills = '{Figma,Illustrator}', major = 'Sistem Informasi' where user_id = $1",
        [id],
      ),
    );
    expect(ok.affectedRows).toBe(1);

    for (const column of [
      "verified_until = now() + interval '10 years'",
      "status = 'active'",
      `university_id = '${universityId}'`,
    ]) {
      await expectPgError(
        as(db, user(id), (tx) =>
          tx.query(
            `update public.freelancer_profiles set ${column} where user_id = $1`,
            [id],
          ),
        ),
        "42501",
      );
    }

    await expectPgError(
      as(db, user(id), (tx) =>
        tx.query(
          "update public.freelancer_profiles set skills = $2 where user_id = $1",
          [id, ["x".repeat(31)]],
        ),
      ),
      "23514",
    );

    const stranger = await createOnboardedUser(db);
    const denied = await as(db, user(stranger), (tx) =>
      tx.query(
        "update public.freelancer_profiles set headline = 'pwned' where user_id = $1",
        [id],
      ),
    );
    expect(denied.affectedRows).toBe(0);
  });
});
