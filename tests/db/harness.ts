import { PGlite, type Transaction } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect } from "vitest";

const root = path.resolve(__dirname, "../..");
const migrationsDir = path.join(root, "supabase/migrations");

export type Actor =
  { kind: "anon" } | { kind: "user"; id: string } | { kind: "service" };

export const anon: Actor = { kind: "anon" };
export const service: Actor = { kind: "service" };
export const user = (id: string): Actor => ({ kind: "user", id });

/** Fresh in-memory Postgres with the Supabase shim and every migration applied in order. */
export async function createTestDb(): Promise<PGlite> {
  const db = await PGlite.create();
  await db.exec(
    readFileSync(path.join(__dirname, "supabase-shim.sql"), "utf8"),
  );
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    try {
      await db.exec(readFileSync(path.join(migrationsDir, file), "utf8"));
    } catch (error) {
      throw new Error(`Migration ${file} failed: ${(error as Error).message}`);
    }
  }
  return db;
}

/** Runs `fn` inside a transaction impersonating `actor`, like PostgREST does. */
export async function as<T>(
  db: PGlite,
  actor: Actor,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    const role =
      actor.kind === "anon"
        ? "anon"
        : actor.kind === "service"
          ? "service_role"
          : "authenticated";
    const claims =
      actor.kind === "user"
        ? { sub: actor.id, role: "authenticated" }
        : { role };
    await tx.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify(claims),
    ]);
    await tx.exec(`set local role ${role}`);
    return fn(tx);
  });
}

let counter = 0;

/** Inserts an auth user (as superuser); the trigger creates the profile. */
export async function createUser(
  db: PGlite,
  opts: { email?: string; confirmed?: boolean; fullName?: string } = {},
): Promise<string> {
  counter += 1;
  const email = opts.email ?? `user${counter}@example.test`;
  const result = await db.query<{ id: string }>(
    `insert into auth.users (email, email_confirmed_at, raw_user_meta_data)
     values ($1, $2, $3) returning id`,
    [
      email,
      opts.confirmed === false ? null : new Date().toISOString(),
      JSON.stringify(opts.fullName ? { full_name: opts.fullName } : {}),
    ],
  );
  return result.rows[0]!.id;
}

/** Creates a user and completes onboarding through the real RPC. */
export async function createOnboardedUser(
  db: PGlite,
  opts: { email?: string; confirmed?: boolean } = {},
): Promise<string> {
  const id = await createUser(db, opts);
  counter += 1;
  await as(db, user(id), (tx) =>
    tx.query("select public.complete_onboarding($1, $2, true)", [
      "Test User",
      `tester_${counter}`,
    ]),
  );
  return id;
}

export async function makeAdmin(db: PGlite, id: string): Promise<void> {
  await db.query("insert into public.admin_users (user_id) values ($1)", [id]);
}

/** Simulates a completed Storage upload (as superuser). */
export async function putObject(
  db: PGlite,
  bucket: string,
  name: string,
): Promise<void> {
  await db.query(
    "insert into storage.objects (bucket_id, name) values ($1, $2)",
    [bucket, name],
  );
}

export async function firstUniversityId(db: PGlite): Promise<string> {
  const r = await db.query<{ id: string }>(
    "select id from public.universities order by name limit 1",
  );
  return r.rows[0]!.id;
}

/** Asserts a Postgres error with the given SQLSTATE (and optional message). */
export async function expectPgError(
  promise: Promise<unknown>,
  code: string,
  message?: string | RegExp,
): Promise<void> {
  let caught: unknown;
  try {
    await promise;
  } catch (error) {
    caught = error;
  }
  expect(caught, "expected the query to fail").toBeDefined();
  const err = caught as { code?: string; message?: string };
  expect(err.code).toBe(code);
  if (message !== undefined) {
    if (typeof message === "string") expect(err.message).toBe(message);
    else expect(err.message).toMatch(message);
  }
}
