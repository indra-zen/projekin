import type { Page } from "@playwright/test";
import { ROLES, authFile, hasAccount } from "./accounts";
import { expect, open, test } from "./fixtures";

/** Every link in the dashboard side navigation (what this role can see). */
async function navLinks(page: Page, selector: string) {
  const hrefs = await page
    .locator(selector)
    .evaluateAll((links) => links.map((a) => a.getAttribute("href") ?? ""));
  return [...new Set(hrefs)].filter(Boolean);
}

for (const role of ROLES) {
  test.describe(`dashboard as ${role}`, () => {
    test.skip(!hasAccount(role), `no ${role} credentials`);
    test.use({ storageState: authFile(role) });

    test("every navigation page loads", async ({ page }) => {
      await open(page, "/dashboard");
      const links = await navLinks(
        page,
        'nav a[href^="/dashboard"], nav a[href="/admin"]',
      );
      expect(links).toContain("/dashboard/orders");
      expect(links.includes("/admin")).toBe(role === "admin");

      for (const href of links) {
        await test.step(href, async () => {
          const response = await open(page, href);
          expect(response?.status(), href).toBe(200);
        });
      }
    });

    test("an order opens from the order list", async ({ page }) => {
      // The list defaults to orders placed as a client.
      await open(
        page,
        role === "freelancer"
          ? "/dashboard/orders?role=freelancer"
          : "/dashboard/orders",
      );
      const order = page.locator('main a[href^="/dashboard/orders/"]').first();
      test.skip((await order.count()) === 0, "no orders yet");

      await order.click();
      await expect(page).toHaveURL(/\/dashboard\/orders\/[^/]+$/);
      await expect(page.locator("main h1")).toBeVisible();
    });
  });
}

test.describe("admin area", () => {
  test.skip(!hasAccount("admin"), "no admin credentials");
  test.use({ storageState: authFile("admin") });

  test("every admin page loads", async ({ page }) => {
    await open(page, "/admin");
    const links = await navLinks(page, 'nav a[href^="/admin"]');
    expect(links.length).toBeGreaterThan(1);

    for (const href of links) {
      await test.step(href, async () => {
        const response = await open(page, href);
        expect(response?.status(), href).toBe(200);
      });
    }
  });
});
