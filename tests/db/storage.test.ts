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
} from "./harness";

let db: PGlite;

beforeAll(async () => {
  db = await createTestDb();
});

const insertObject = (actor: string, bucket: string, name: string) =>
  as(db, user(actor), (tx) =>
    tx.query("insert into storage.objects (bucket_id, name) values ($1, $2)", [
      bucket,
      name,
    ]),
  );

describe("storage buckets", () => {
  it("are created with size and MIME limits", async () => {
    const r = await db.query<{
      id: string;
      public: boolean;
      file_size_limit: number;
    }>("select id, public, file_size_limit from storage.buckets order by id");
    expect(r.rows).toEqual([
      { id: "avatars", public: true, file_size_limit: 5242880 },
      { id: "student-documents", public: false, file_size_limit: 5242880 },
    ]);
  });
});

describe("avatars bucket policies", () => {
  it("users upload only into their own folder", async () => {
    const a = await createOnboardedUser(db);
    const b = await createOnboardedUser(db);
    await insertObject(a, "avatars", `${a}/x.png`);
    await expectPgError(insertObject(a, "avatars", `${b}/x.png`), "42501");
    await expectPgError(insertObject(a, "avatars", `x.png`), "42501");
  });

  it("users cannot delete another user's avatar", async () => {
    const a = await createOnboardedUser(db);
    const b = await createOnboardedUser(db);
    await insertObject(b, "avatars", `${b}/keep.png`);
    const r = await as(db, user(a), (tx) =>
      tx.query(
        "delete from storage.objects where bucket_id = 'avatars' and name = $1",
        [`${b}/keep.png`],
      ),
    );
    expect(r.affectedRows).toBe(0);
  });

  it("anon cannot upload", async () => {
    await expectPgError(
      as(db, anon, (tx) =>
        tx.query(
          "insert into storage.objects (bucket_id, name) values ('avatars', 'a/b.png')",
        ),
      ),
      "42501",
    );
  });
});

describe("student-documents bucket policies", () => {
  it("are readable only by the owner and admins, and immutable", async () => {
    const owner = await createOnboardedUser(db);
    const stranger = await createOnboardedUser(db);
    const admin = await createOnboardedUser(db);
    await makeAdmin(db, admin);
    const name = `${owner}/ktm.pdf`;

    await insertObject(owner, "student-documents", name);
    await expectPgError(
      insertObject(stranger, "student-documents", `${owner}/fake.pdf`),
      "42501",
    );

    const select = (actor: string) =>
      as(db, user(actor), (tx) =>
        tx.query(
          "select name from storage.objects where bucket_id = 'student-documents' and name = $1",
          [name],
        ),
      );
    expect((await select(owner)).rows).toHaveLength(1);
    expect((await select(stranger)).rows).toHaveLength(0);
    expect((await select(admin)).rows).toHaveLength(1);

    const del = await as(db, user(owner), (tx) =>
      tx.query(
        "delete from storage.objects where bucket_id = 'student-documents' and name = $1",
        [name],
      ),
    );
    expect(del.affectedRows).toBe(0);
  });
});
