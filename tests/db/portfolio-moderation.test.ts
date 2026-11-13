import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, it } from "vitest";
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

async function freelancer() {
  const id = await createOnboardedUser(db);
  await makeFreelancer(db, id);
  return id;
}

async function service(owner: string) {
  const result = await as(db, user(owner), (tx) =>
    tx.query<{ id: string }>(
      `insert into public.services
      (freelancer_id, category_id, title, description, price, delivery_days, cover_image_path)
     values ($1, $2, 'Layanan desain identitas', 'Deskripsi layanan yang cukup panjang untuk lolos validasi.', 150000, 3, $3)
     returning id`,
      [owner, categoryId, `${owner}/cover.png`],
    ),
  );
  return result.rows[0]!.id;
}

describe("portfolio ownership and limits", () => {
  it("allows an eligible owner to create and update, but not strangers or anon", async () => {
    const owner = await freelancer();
    const stranger = await freelancer();
    const insert = () =>
      as(db, user(owner), (tx) =>
        tx.query(
          `insert into public.portfolio_items (freelancer_id, title, image_paths)
       values ($1, 'Karya pertama', $2)`,
          [owner, [`${owner}/one.png`]],
        ),
      );
    await insert();
    await expectPgError(
      as(db, user(stranger), (tx) =>
        tx.query(
          `insert into public.portfolio_items (freelancer_id, title) values ($1, 'Bukan milik saya')`,
          [owner],
        ),
      ),
      "42501",
    );
    await expectPgError(
      as(db, anon, (tx) =>
        tx.query(
          `insert into public.portfolio_items (freelancer_id, title) values ($1, 'Anonim')`,
          [owner],
        ),
      ),
      "42501",
    );
  });

  it("enforces the five-image database limit", async () => {
    const owner = await freelancer();
    await expectPgError(
      as(db, user(owner), (tx) =>
        tx.query(
          `insert into public.portfolio_items (freelancer_id, title, image_paths)
       values ($1, 'Terlalu banyak gambar', $2)`,
          [owner, [1, 2, 3, 4, 5, 6].map((n) => `${owner}/${n}.png`)],
        ),
      ),
      "23514",
    );
  });
});

describe("admin moderation RPCs", () => {
  it("restricts suspension and blocking to admins", async () => {
    const owner = await freelancer();
    const stranger = await createOnboardedUser(db);
    const admin = await createOnboardedUser(db);
    await makeAdmin(db, admin);
    const id = await service(owner);
    await expectPgError(
      as(db, user(stranger), (tx) =>
        tx.query("select public.set_freelancer_status($1, 'suspended')", [
          owner,
        ]),
      ),
      "PJ403",
      "FORBIDDEN",
    );
    await expectPgError(
      as(db, user(stranger), (tx) =>
        tx.query("select public.admin_set_service_block($1, true, 'Alasan')", [
          id,
        ]),
      ),
      "PJ403",
      "FORBIDDEN",
    );
    await expectPgError(
      as(db, user(admin), (tx) =>
        tx.query("select public.admin_set_service_block($1, true, null)", [id]),
      ),
      "PJ422",
      "INVALID_BLOCK_REASON",
    );
    await as(db, user(admin), (tx) =>
      tx.query(
        "select public.admin_set_service_block($1, true, 'Melanggar ketentuan')",
        [id],
      ),
    );
    await expectPgError(
      as(db, user(owner), (tx) =>
        tx.query("select public.set_service_status($1, 'published')", [id]),
      ),
      "PJ403",
      "SERVICE_BLOCKED",
    );
  });
});
