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

  it("revokes EXECUTE on every public RPC from anon", async () => {
    const r = await db.query<{ fn: string }>(`
      select p.proname as fn
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prokind = 'f'
        and has_function_privilege('anon', p.oid, 'execute')
    `);
    expect(r.rows).toEqual([]);
  });

  it("keeps the payment and scheduler functions service-role only", async () => {
    const r = await db.query<{ fn: string }>(`
      select p.proname as fn
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname in ('attach_snap_token', 'fail_payment_attempt', 'apply_payment_status',
                          'expire_unpaid_orders', 'auto_complete_delivered_orders')
        and has_function_privilege('authenticated', p.oid, 'execute')
    `);
    expect(r.rows).toEqual([]);
  });

  it("pins search_path on every SECURITY DEFINER function", async () => {
    const r = await db.query<{ fn: string }>(`
      select n.nspname || '.' || p.proname as fn
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'private') and p.prosecdef
        and not coalesce(array_to_string(p.proconfig, ',') like '%search_path=%', false)
    `);
    expect(r.rows).toEqual([]);
  });

  it("creates every public view with security_invoker, so RLS still applies", async () => {
    const r = await db.query<{ relname: string; invoker: boolean }>(`
      select c.relname,
             coalesce(array_to_string(c.reloptions, ',') like '%security_invoker=true%', false) as invoker
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'v'
      order by c.relname
    `);
    expect(r.rows.map((v) => v.relname)).toEqual([
      "client_rating_stats",
      "freelancer_rating_stats",
      "service_listings",
      "service_rating_stats",
    ]);
    expect(r.rows.filter((v) => !v.invoker)).toEqual([]);
  });

  it("seeds the Tarakan universities; only STMIK PPKIA has a confirmed student domain", async () => {
    const r = await db.query<{ name: string; email_domains: string[] }>(
      "select name, email_domains from public.universities order by name",
    );
    expect(r.rows.map((u) => u.name)).toEqual([
      "STMIK PPKIA Tarakanita Rahmawati",
      "Universitas Borneo Tarakan",
    ]);
    // 20261114030000: confirmed by the product owner; UBT stays unset.
    expect(r.rows.map((u) => u.email_domains)).toEqual([
      ["student.ppkia.ac.id"],
      [],
    ]);
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
