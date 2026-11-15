import type { Page } from "@playwright/test";
import { expect, open, test } from "./fixtures";

test.describe("public pages", () => {
  test("landing page links to both marketplaces", async ({ page }) => {
    await open(page, "/");
    await expect(page).toHaveTitle(/Projekin/);
    const main = page.locator("main");
    await expect(main.locator('a[href="/services"]').first()).toBeVisible();
    await expect(main.locator('a[href="/jobs"]').first()).toBeVisible();
  });

  // Next.js streams a dynamic page's metadata into <body> for browsers and
  // puts it in <head> only for known crawlers, so these tests are one.
  test.describe("link previews, as WhatsApp's crawler sees them", () => {
    test.use({ userAgent: "WhatsApp/2.23.20.0 A" });

    const meta = (page: Page, key: string) =>
      page
        .locator(`head meta[property="${key}"], head meta[name="${key}"]`)
        .first()
        .getAttribute("content", { timeout: 5_000 });

    /** og:image is absolute and loads (site picture or Supabase Storage). */
    async function expectPreviewImageLoads(page: Page) {
      const image = (await meta(page, "og:image"))!;
      expect(image).toMatch(/^https?:\/\//);
      const url = new URL(image);
      const sameSite = url.pathname.startsWith("/opengraph-image");
      const response = await page.request.get(
        sameSite ? url.pathname + url.search : image,
      );
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toMatch(/^image\//);
      return image;
    }

    test("landing page has a link preview", async ({ page }) => {
      await open(page, "/");

      expect(await meta(page, "og:title")).toContain("Projekin");
      expect(await meta(page, "og:description")).toBeTruthy();
      expect(await meta(page, "twitter:card")).toBe("summary_large_image");
      expect(await meta(page, "og:image:width")).toBe("1200");
      expect(await meta(page, "og:image:height")).toBe("630");

      const image = await meta(page, "og:image");
      expect(image, "og:image must be an absolute URL").toMatch(/^https?:\/\//);
      const imageUrl = new URL(image!);
      const site = new URL(page.url());
      // A local build names the default port, not the test port; a deployed
      // site must name its own domain, or crawlers fetch the wrong host.
      if (site.hostname !== "localhost")
        expect(imageUrl.origin).toBe(site.origin);
      const { pathname, search } = imageUrl;
      const response = await page.request.get(pathname + search);
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toBe("image/jpeg");
      expect((await response.body()).length).toBeLessThan(300 * 1024);
    });

    test("a service page has its own link preview", async ({ page }) => {
      await open(page, "/services");
      const card = page
        .locator('main a[href^="/services/"]:not([href$="/order"])')
        .first();
      test.skip((await card.count()) === 0, "no published services");
      await open(page, (await card.getAttribute("href"))!);

      const heading = (await page.locator("main h1").first().textContent())!;

      expect(await meta(page, "og:title")).toBe(heading.trim());
      await expect(page).toHaveTitle(`${heading.trim()} — Projekin`);
      expect(await meta(page, "og:description")).toMatch(/^Rp\s?[\d.]+ · /);
      expect(await meta(page, "twitter:card")).toBe("summary_large_image");

      // The cover (Supabase Storage) or the site picture; either must load.
      await expectPreviewImageLoads(page);
    });

    test("a job page has its own link preview", async ({ page }) => {
      await open(page, "/jobs");
      const link = page.locator('main a[href^="/jobs/"]').first();
      test.skip((await link.count()) === 0, "no visible jobs");
      await open(page, (await link.getAttribute("href"))!);

      const heading = (await page.locator("main h1").first().textContent())!;
      expect(await meta(page, "og:title")).toBe(heading.trim());
      await expect(page).toHaveTitle(`${heading.trim()} — Projekin`);
      expect(await meta(page, "og:description")).toMatch(
        /^(Lowongan|Menunggu pembayaran|Terisi|Ditutup) · .*Anggaran Rp/,
      );
      expect(await meta(page, "twitter:card")).toBe("summary_large_image");
      await expectPreviewImageLoads(page);
    });

    test("a freelancer profile has its own link preview", async ({ page }) => {
      await open(page, "/services");
      const card = page
        .locator('main a[href^="/services/"]:not([href$="/order"])')
        .first();
      test.skip((await card.count()) === 0, "no published services");
      await open(page, (await card.getAttribute("href"))!);
      // A published service's owner is a verified student.
      await open(
        page,
        (await page
          .locator('main a[href^="/u/"]')
          .first()
          .getAttribute("href"))!,
      );

      const heading = (await page.locator("main h1").first().textContent())!;
      expect(await meta(page, "og:title")).toBe(heading.trim());
      expect(await meta(page, "og:type")).toBe("profile");
      expect(await meta(page, "og:description")).toMatch(
        /^Freelancer mahasiswa terverifikasi · /,
      );
      // An avatar is a small square card; without one, the wide site picture.
      const image = await expectPreviewImageLoads(page);
      expect(await meta(page, "twitter:card")).toBe(
        image.includes("/avatars/") ? "summary" : "summary_large_image",
      );
    });
  });

  test("service catalog opens a service and its freelancer", async ({
    page,
  }) => {
    await open(page, "/services");
    const card = page
      .locator('main a[href^="/services/"]:not([href$="/order"])')
      .first();
    test.skip((await card.count()) === 0, "no published services");

    await card.click();
    await expect(page).toHaveURL(/\/services\/[^/]+$/);
    await expect(page.locator("main h1")).toBeVisible();
    await expect(page.locator("main")).toContainText("Rp");

    await page.locator('main a[href^="/u/"]').first().click();
    await expect(page).toHaveURL(/\/u\/[^/]+$/);
    await expect(page.locator("main h1")).toBeVisible();
  });

  test("ordering asks guests to sign in", async ({ page }) => {
    await open(page, "/services");
    const card = page
      .locator('main a[href^="/services/"]:not([href$="/order"])')
      .first();
    test.skip((await card.count()) === 0, "no published services");

    const href = await card.getAttribute("href");
    await page.goto(`${href}/order`);
    await expect(page).toHaveURL(/\/login\?next=/);
  });

  test("job board opens a job", async ({ page }) => {
    await open(page, "/jobs");
    const job = page.locator('main a[href^="/jobs/"]').first();
    test.skip((await job.count()) === 0, "no open jobs");

    await job.click();
    await expect(page).toHaveURL(/\/jobs\/[^/]+$/);
    await expect(page.locator("main h1")).toBeVisible();
  });

  test("search with no results shows the empty state", async ({ page }) => {
    await open(page, "/services?q=zzzz-tidak-ada-hasil-zzzz");
    await expect(
      page.locator('main a[href^="/services/"]:not([href$="/order"])'),
    ).toHaveCount(0);
  });

  for (const path of ["/terms", "/privacy"]) {
    test(`legal page ${path}`, async ({ page }) => {
      const response = await open(page, path);
      expect(response?.status()).toBe(200);
    });
  }

  test("unknown URL shows the Indonesian 404", async ({ page }) => {
    const response = await page.goto("/halaman-yang-tidak-ada");
    expect(response?.status()).toBe(404);
    await expect(page.getByText("Tidak ditemukan")).toBeVisible();
    await expect(page).toHaveTitle(/Halaman tidak ditemukan/);
  });

  test("security headers are sent", async ({ request }) => {
    const response = await request.get("/");
    const headers = response.headers();
    expect(headers["content-security-policy"]).toBe("frame-ancestors 'none'");
    expect(headers["content-security-policy-report-only"]).toContain(
      "default-src 'self'",
    );
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-powered-by"]).toBeUndefined();
  });
});
