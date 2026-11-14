import { account, authFile, hasAccount } from "./accounts";
import { expect, test } from "./fixtures";

test.describe("signed out", () => {
  for (const path of ["/dashboard/orders", "/admin", "/onboarding"]) {
    test(`${path} redirects to login`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(`/login?next=${encodeURIComponent(path)}`);
      await expect(page.locator("#email")).toBeVisible();
    });
  }

  test("empty login form shows Indonesian errors", async ({ page }) => {
    await page.goto("/login");
    await page.locator("main").getByRole("button", { name: "Masuk" }).click();
    await expect(page.getByText("Kata sandi wajib diisi.")).toBeVisible();
  });

  test("signing in returns to the requested page", async ({ page }) => {
    const credentials = account("client");
    test.skip(!credentials, "no client credentials");
    if (!credentials) return;

    await page.goto("/dashboard/orders");
    await page.locator("#email").fill(credentials.email);
    await page.locator("#password").fill(credentials.password);
    await page.locator("main").getByRole("button", { name: "Masuk" }).click();
    await expect(page).toHaveURL("/dashboard/orders");
    await expect(page.locator("main h1")).toBeVisible();
  });
});

test.describe("signed in", () => {
  test.skip(!hasAccount("client"), "no client credentials");
  test.use({ storageState: authFile("client") });

  test("login page sends signed-in users to the dashboard", async ({
    page,
  }) => {
    await page.goto("/login");
    await expect(page).toHaveURL("/dashboard");
  });

  test("admin area is hidden from non-admins", async ({ page }) => {
    const response = await page.goto("/admin");
    expect(response?.status()).toBe(404);
    await expect(page.getByText("Tidak ditemukan")).toBeVisible();
  });
});
