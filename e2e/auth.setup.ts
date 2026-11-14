import fs from "node:fs";
import path from "node:path";
import { expect, test as setup } from "@playwright/test";
import { ROLES, account, authFile } from "./accounts";

// Signs each demo account in once and stores its session for the other tests.
for (const role of ROLES) {
  setup(`sign in as ${role}`, async ({ page }) => {
    const credentials = account(role);
    setup.skip(!credentials, `no ${role} credentials`);
    if (!credentials) return;

    await page.goto("/login");
    await page.locator("#email").fill(credentials.email);
    await page.locator("#password").fill(credentials.password);
    await page.locator("main").getByRole("button", { name: "Masuk" }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"));
    await expect(page).toHaveURL(/\/dashboard/);

    fs.mkdirSync(path.dirname(authFile(role)), { recursive: true });
    await page.context().storageState({ path: authFile(role) });
  });
}
