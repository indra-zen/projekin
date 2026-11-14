import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import {
  anon,
  as,
  createOnboardedUser,
  createTestDb,
  createUser,
  expectPgError,
  makeAdmin,
  user,
} from "./harness";

let db: PGlite;

beforeAll(async () => {
  db = await createTestDb();
});

describe("sign-up trigger", () => {
  it("creates a profile with a generated username and the metadata name", async () => {
    const id = await createUser(db, { fullName: "  Rina Putri  " });
    const r = await db.query<{
      username: string;
      full_name: string;
      onboarded_at: string | null;
    }>(
      "select username, full_name, onboarded_at from public.profiles where id = $1",
      [id],
    );
    expect(r.rows[0]!.username).toMatch(/^user_[0-9a-f]{10}$/);
    expect(r.rows[0]!.full_name).toBe("Rina Putri");
    expect(r.rows[0]!.onboarded_at).toBeNull();
  });
});

describe("complete_onboarding", () => {
  it("requires accepting the terms", async () => {
    const id = await createUser(db);
    await expectPgError(
      as(db, user(id), (tx) =>
        tx.query("select public.complete_onboarding('Rina', 'rina_a', false)"),
      ),
      "PJ422",
      "TERMS_NOT_ACCEPTED",
    );
  });

  it("validates the username format", async () => {
    const id = await createUser(db);
    await expectPgError(
      as(db, user(id), (tx) =>
        tx.query("select public.complete_onboarding('Rina', 'Ri', true)"),
      ),
      "PJ422",
      "INVALID_USERNAME",
    );
  });

  it("rejects a username that is already taken", async () => {
    const a = await createUser(db);
    const b = await createUser(db);
    await as(db, user(a), (tx) =>
      tx.query("select public.complete_onboarding('A', 'taken_name', true)"),
    );
    await expectPgError(
      as(db, user(b), (tx) =>
        tx.query("select public.complete_onboarding('B', 'TAKEN_NAME', true)"),
      ),
      "PJ409",
      "USERNAME_TAKEN",
    );
  });

  it("sets onboarding fields once and keeps the first timestamp", async () => {
    const id = await createUser(db);
    await as(db, user(id), (tx) =>
      tx.query("select public.complete_onboarding(' Budi ', 'budi_s', true)"),
    );
    const first = await db.query<{
      full_name: string;
      username: string;
      onboarded_at: Date;
    }>(
      "select full_name, username, onboarded_at from public.profiles where id = $1",
      [id],
    );
    expect(first.rows[0]!.full_name).toBe("Budi");
    expect(first.rows[0]!.username).toBe("budi_s");
    expect(first.rows[0]!.onboarded_at).not.toBeNull();

    await as(db, user(id), (tx) =>
      tx.query("select public.complete_onboarding('Budi S', 'budi_s', true)"),
    );
    const second = await db.query<{ onboarded_at: Date }>(
      "select onboarded_at from public.profiles where id = $1",
      [id],
    );
    expect(second.rows[0]!.onboarded_at).toEqual(first.rows[0]!.onboarded_at);
  });
});

describe("profiles RLS and column grants", () => {
  it("is publicly readable", async () => {
    const id = await createOnboardedUser(db);
    const r = await as(db, anon, (tx) =>
      tx.query("select id from public.profiles where id = $1", [id]),
    );
    expect(r.rows).toHaveLength(1);
  });

  it("lets owners edit their own editable columns", async () => {
    const id = await createOnboardedUser(db);
    const r = await as(db, user(id), (tx) =>
      tx.query(
        "update public.profiles set bio = 'Halo', location = 'Tarakan' where id = $1 returning bio",
        [id],
      ),
    );
    expect(r.rows).toEqual([{ bio: "Halo" }]);
  });

  it("does not let users edit another user's profile", async () => {
    const owner = await createOnboardedUser(db);
    const attacker = await createOnboardedUser(db);
    const r = await as(db, user(attacker), (tx) =>
      tx.query("update public.profiles set bio = 'pwned' where id = $1", [
        owner,
      ]),
    );
    expect(r.affectedRows).toBe(0);
    const check = await db.query<{ bio: string | null }>(
      "select bio from public.profiles where id = $1",
      [owner],
    );
    expect(check.rows[0]!.bio).toBeNull();
  });

  it("does not let users change protected columns on their own row", async () => {
    const id = await createUser(db);
    for (const column of [
      "onboarded_at = now()",
      "terms_accepted_at = now()",
      "id = gen_random_uuid()",
      "created_at = now()",
    ]) {
      await expectPgError(
        as(db, user(id), (tx) =>
          tx.query(`update public.profiles set ${column} where id = $1`, [id]),
        ),
        "42501",
      );
    }
  });

  it("only accepts avatar paths inside the user's own folder", async () => {
    const id = await createOnboardedUser(db);
    const other = await createOnboardedUser(db);
    await expectPgError(
      as(db, user(id), (tx) =>
        tx.query("update public.profiles set avatar_path = $2 where id = $1", [
          id,
          `${other}/a.png`,
        ]),
      ),
      "42501",
    );
    const ok = await as(db, user(id), (tx) =>
      tx.query("update public.profiles set avatar_path = $2 where id = $1", [
        id,
        `${id}/a.png`,
      ]),
    );
    expect(ok.affectedRows).toBe(1);
  });

  it("does not allow inserting or deleting profiles through the API", async () => {
    const id = await createUser(db);
    await expectPgError(
      as(db, user(id), (tx) =>
        tx.query(
          "insert into public.profiles (id, username) values (gen_random_uuid(), 'sneaky')",
        ),
      ),
      "42501",
    );
    await expectPgError(
      as(db, user(id), (tx) =>
        tx.query("delete from public.profiles where id = $1", [id]),
      ),
      "42501",
    );
  });
});

describe("admin_users", () => {
  it("cannot be written by users and is only visible for one's own row", async () => {
    const admin = await createOnboardedUser(db);
    const regular = await createOnboardedUser(db);
    await makeAdmin(db, admin);

    await expectPgError(
      as(db, user(regular), (tx) =>
        tx.query("insert into public.admin_users (user_id) values ($1)", [
          regular,
        ]),
      ),
      "42501",
    );
    const seenByRegular = await as(db, user(regular), (tx) =>
      tx.query("select * from public.admin_users"),
    );
    expect(seenByRegular.rows).toEqual([]);
    const seenByAdmin = await as(db, user(admin), (tx) =>
      tx.query<{ user_id: string }>("select user_id from public.admin_users"),
    );
    expect(seenByAdmin.rows).toEqual([{ user_id: admin }]);
  });
});
