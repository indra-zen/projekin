import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import {
  anon,
  as,
  createOnboardedUser,
  createTestDb,
  expectPgError,
  makeAdmin,
  user,
  type Actor,
} from "./harness";

// 20261114030000: admins manage student email domains in the app.

let db: PGlite;
let admin: string;

beforeAll(async () => {
  db = await createTestDb();
  admin = await createOnboardedUser(db);
  await makeAdmin(db, admin);
});

async function university(domains = "{}") {
  return (
    await db.query<{ id: string }>(
      "insert into public.universities (name, email_domains) values ($1, $2) returning id",
      [`Kampus ${Math.random().toString(36).slice(2, 8)}`, domains],
    )
  ).rows[0]!.id;
}

const setDomains = (actor: Actor, id: string, domains: string[]) =>
  as(db, actor, (tx) =>
    tx.query<{ email_domains: string[] }>(
      "select email_domains from public.admin_set_university_domains($1, $2)",
      [id, domains],
    ),
  );

describe("admin_set_university_domains", () => {
  it("pre-fills STMIK PPKIA with student.ppkia.ac.id", async () => {
    const r = await db.query<{ email_domains: string[] }>(
      "select email_domains from public.universities where name = 'STMIK PPKIA Tarakanita Rahmawati'",
    );
    expect(r.rows[0]!.email_domains).toEqual(["student.ppkia.ac.id"]);
  });

  it("normalises the list: trims, lower-cases, drops @, blanks and duplicates", async () => {
    const id = await university();
    const r = await setDomains(user(admin), id, [
      " Student.Kampus.ac.id ",
      "@student.kampus.ac.id",
      "",
      "mhs.kampus.ac.id",
    ]);
    expect(r.rows[0]!.email_domains).toEqual([
      "mhs.kampus.ac.id",
      "student.kampus.ac.id",
    ]);
    // An empty list switches the email method off again.
    expect(
      (await setDomains(user(admin), id, [])).rows[0]!.email_domains,
    ).toEqual([]);
  });

  it("rejects invalid domains and more than 10", async () => {
    const id = await university();
    for (const bad of [
      "kampus",
      "student kampus.ac.id",
      "a@b.ac.id",
      "-x.ac.id",
      "x..ac.id",
    ]) {
      await expectPgError(
        setDomains(user(admin), id, [bad]),
        "PJ422",
        "INVALID_EMAIL_DOMAIN",
      );
    }
    await expectPgError(
      setDomains(
        user(admin),
        id,
        Array.from({ length: 11 }, (_, i) => `d${i}.ac.id`),
      ),
      "PJ422",
      "TOO_MANY_EMAIL_DOMAINS",
    );
  });

  it("is admin only, and unknown universities are reported", async () => {
    const id = await university();
    const someone = await createOnboardedUser(db);
    await expectPgError(
      setDomains(user(someone), id, ["x.ac.id"]),
      "PJ403",
      "FORBIDDEN",
    );
    await expectPgError(setDomains(anon, id, ["x.ac.id"]), "42501");
    await expectPgError(
      setDomains(user(admin), "00000000-0000-4000-8000-000000000000", [
        "x.ac.id",
      ]),
      "PJ404",
      "UNIVERSITY_NOT_FOUND",
    );
    // Direct table writes stay closed.
    await expectPgError(
      as(db, user(admin), (tx) =>
        tx.query(
          "update public.universities set email_domains = '{x.ac.id}' where id = $1",
          [id],
        ),
      ),
      "42501",
    );
  });

  it("a newly added domain verifies matching students instantly (exact match)", async () => {
    const id = await university();
    await setDomains(user(admin), id, ["student.kampus.ac.id"]);
    const submit = (uid: string) =>
      as(db, user(uid), (tx) =>
        tx.query<{ status: string }>(
          "select status from public.submit_student_verification($1, 'email_domain')",
          [id],
        ),
      );
    const student = await createOnboardedUser(db, {
      email: "2450047@student.kampus.ac.id",
    });
    expect((await submit(student)).rows[0]!.status).toBe("approved");
    const parent = await createOnboardedUser(db, { email: "x@kampus.ac.id" });
    await expectPgError(submit(parent), "PJ422", "EMAIL_DOMAIN_NOT_ELIGIBLE");
  });
});
