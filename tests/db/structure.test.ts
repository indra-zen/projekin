import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import {
  anon,
  as,
  createTestDb,
  createUser,
  expectPgError,
  user,
} from "./harness";

let db: PGlite;

beforeAll(async () => {
  db = await createTestDb();
});

describe("schema structure", () => {
  it("enables RLS on every table in the public schema", async () => {
    const r = await db.query<{ relname: string }>(`
      select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
    `);
    expect(r.rows).toEqual([]);
  });

  it("does not let API roles execute private helpers that change data", async () => {
    const id = await createUser(db);
    const uni = (
      await db.query<{ id: string }>(
        "select id from public.universities limit 1",
      )
    ).rows[0]!.id;

    await expectPgError(
      as(db, user(id), (tx) =>
        tx.query(
          "select private.apply_verification_approval($1, $2, now() + interval '1 year')",
          [id, uni],
        ),
      ),
      "42501",
    );
    await expectPgError(
      as(db, user(id), (tx) =>
        tx.query("select private.student_verification_state($1)", [id]),
      ),
      "42501",
    );
  });

  it("does not let anon execute identity RPCs", async () => {
    await expectPgError(
      as(db, anon, (tx) =>
        tx.query("select public.complete_onboarding('A', 'abc', true)"),
      ),
      "42501",
    );
    await expectPgError(
      as(db, anon, (tx) =>
        tx.query("select * from public.get_my_verification_status()"),
      ),
      "42501",
    );
  });

  it("seeds the Tarakan universities without email domains", async () => {
    const r = await db.query<{ name: string; email_domains: string[] }>(
      "select name, email_domains from public.universities order by name",
    );
    expect(r.rows.map((u) => u.name)).toEqual([
      "STMIK PPKIA Tarakanita Rahmawati",
      "Universitas Borneo Tarakan",
    ]);
    expect(r.rows.every((u) => u.email_domains.length === 0)).toBe(true);
  });

  it("shows only active universities to anon", async () => {
    await db.query(
      "insert into public.universities (name, is_active) values ('Kampus Nonaktif', false)",
    );
    const r = await as(db, anon, (tx) =>
      tx.query<{ name: string }>("select name from public.universities"),
    );
    expect(r.rows.map((u) => u.name)).not.toContain("Kampus Nonaktif");
  });
});
