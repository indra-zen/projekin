import { expect, open, test } from "./fixtures";

test.describe("public pages", () => {
  test("landing page links to both marketplaces", async ({ page }) => {
    await open(page, "/");
    await expect(page).toHaveTitle(/Projekin/);
    const main = page.locator("main");
    await expect(main.locator('a[href="/services"]').first()).toBeVisible();
    await expect(main.locator('a[href="/jobs"]').first()).toBeVisible();
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
