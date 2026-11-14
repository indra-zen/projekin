import { authFile, hasAccount } from "./accounts";
import { expectNoHorizontalScroll, open, test } from "./fixtures";

// Runs in the "mobile" project (phone viewport).
for (const path of ["/", "/services", "/jobs", "/login", "/register"]) {
  test(`${path} fits a phone screen`, async ({ page }) => {
    await open(page, path);
    await expectNoHorizontalScroll(page);
  });
}

test.describe("signed in", () => {
  test.skip(!hasAccount("freelancer"), "no freelancer credentials");
  test.use({ storageState: authFile("freelancer") });

  for (const path of [
    "/dashboard",
    "/dashboard/orders",
    "/dashboard/services",
  ]) {
    test(`${path} fits a phone screen`, async ({ page }) => {
      await open(page, path);
      await expectNoHorizontalScroll(page);
    });
  }
});
