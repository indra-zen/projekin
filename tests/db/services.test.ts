import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import {
  anon,
  as,
  createOnboardedUser,
  createTestDb,
  expectPgError,
  firstCategoryId,
  makeAdmin,
  makeFreelancer,
  user,
} from "./harness";

let db: PGlite;
let categoryId: string;

beforeAll(async () => {
  db = await createTestDb();
  categoryId = await firstCategoryId(db);
});

async function freelancer(): Promise<string> {
  const id = await createOnboardedUser(db);
  await makeFreelancer(db, id);
  return id;
}

async function createService(
  owner: string,
  cover: string | null = `${owner}/c.png`,
) {
  const r = await as(db, user(owner), (tx) =>
    tx.query<{ id: string }>(
      `insert into public.services (freelancer_id, category_id, title, description, price, delivery_days, cover_image_path)
       values ($1, $2, 'Desain logo profesional', $3, 150000, 3, $4) returning id`,
      [
        owner,
        categoryId,
        "Deskripsi layanan yang cukup panjang untuk lolos validasi.",
        cover,
      ],
    ),
  );
  return r.rows[0]!.id;
}

const setStatus = (actor: string, id: string, status: string) =>
  as(db, user(actor), (tx) =>
    tx.query("select public.set_service_status($1, $2)", [id, status]),
  );

describe("services: protected columns (hardening migration)", () => {
  it("owners cannot change status, block or publish fields directly", async () => {
    const owner = await freelancer();
    const id = await createService(owner);
    for (const assignment of [
      "status = 'published'",
      "blocked_at = null",
      "published_at = now()",
      "freelancer_id = freelancer_id",
    ]) {
      await expectPgError(
        as(db, user(owner), (tx) =>
          tx.query(`update public.services set ${assignment} where id = $1`, [
            id,
          ]),
        ),
        "42501",
      );
    }
  });

  it("an admin block cannot be undone by the owner", async () => {
    const owner = await freelancer();
    const id = await createService(owner);
    await db.query(
      "update public.services set blocked_at = now(), blocked_reason = 'Melanggar ketentuan' where id = $1",
      [id],
    );
    await expectPgError(
      setStatus(owner, id, "published"),
      "PJ403",
      "SERVICE_BLOCKED",
    );
  });

  it("only owners can insert, and only while eligible", async () => {
    const notVerified = await createOnboardedUser(db);
    await expectPgError(createService(notVerified), "42501");
    await expectPgError(
      as(db, anon, (tx) =>
        tx.query(
          "insert into public.services (freelancer_id, category_id, title, description, price, delivery_days) values (gen_random_uuid(), $1, 'x', 'y', 1, 1)",
          [categoryId],
        ),
      ),
      "42501",
    );
  });
});

describe("set_service_status", () => {
  it("publishes a draft with a cover image for an eligible freelancer", async () => {
    const owner = await freelancer();
    const id = await createService(owner);
    await setStatus(owner, id, "published");
    const r = await db.query<{ status: string; published_at: Date | null }>(
      "select status, published_at from public.services where id = $1",
      [id],
    );
    expect(r.rows[0]!.status).toBe("published");
    expect(r.rows[0]!.published_at).not.toBeNull();
  });

  it("requires a cover image and eligibility", async () => {
    const owner = await freelancer();
    const noCover = await createService(owner, null);
    await expectPgError(
      setStatus(owner, noCover, "published"),
      "PJ422",
      "COVER_IMAGE_REQUIRED",
    );

    const expiring = await freelancer();
    const id = await createService(expiring);
    await makeFreelancer(db, expiring, {
      verifiedUntil: "2000-01-01T00:00:00Z",
    });
    await expectPgError(
      setStatus(expiring, id, "published"),
      "PJ403",
      "FREELANCER_NOT_ELIGIBLE",
    );
  });

  it("rejects other users and invalid transitions", async () => {
    const owner = await freelancer();
    const stranger = await freelancer();
    const id = await createService(owner);
    await expectPgError(
      setStatus(stranger, id, "published"),
      "PJ404",
      "NOT_FOUND",
    );
    await expectPgError(
      setStatus(owner, id, "paused"),
      "PJ409",
      "INVALID_SERVICE_TRANSITION",
    );
    await setStatus(owner, id, "archived");
    await expectPgError(
      setStatus(owner, id, "published"),
      "PJ409",
      "SERVICE_ARCHIVED",
    );
  });

  it("enforces the published-services limit (BR-15: 20)", async () => {
    const owner = await freelancer();
    for (let i = 0; i < 20; i += 1) {
      await setStatus(owner, await createService(owner), "published");
    }
    const extra = await createService(owner);
    await expectPgError(
      setStatus(owner, extra, "published"),
      "PJ409",
      "MAX_PUBLISHED_SERVICES",
    );
  });
});

describe("service visibility", () => {
  it("shows published services of eligible freelancers publicly; drafts only to owner and admin", async () => {
    const owner = await freelancer();
    const published = await createService(owner);
    const draft = await createService(owner);
    await setStatus(owner, published, "published");
    const admin = await createOnboardedUser(db);
    await makeAdmin(db, admin);

    const visible = async (actor: Parameters<typeof as>[1], id: string) =>
      (
        await as(db, actor, (tx) =>
          tx.query("select id from public.services where id = $1", [id]),
        )
      ).rows.length;

    expect(await visible(anon, published)).toBe(1);
    expect(await visible(anon, draft)).toBe(0);
    expect(await visible(user(owner), draft)).toBe(1);
    expect(await visible(user(admin), draft)).toBe(1);

    const listing = await as(db, anon, (tx) =>
      tx.query("select id from public.service_listings where id = $1", [
        published,
      ]),
    );
    expect(listing.rows).toHaveLength(1);

    await makeFreelancer(db, owner, { status: "suspended" });
    expect(await visible(anon, published)).toBe(0);
  });
});
