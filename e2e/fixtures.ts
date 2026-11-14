import { test as base, expect, type Page } from "@playwright/test";

/**
 * Every test fails if the page throws or logs a console error (this includes
 * Content-Security-Policy-Report-Only reports and failed resource loads).
 */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("pageerror", (error) =>
        errors.push(`pageerror: ${error.message}`),
      );
      page.on("console", (message) => {
        if (message.type() !== "error") return;
        // A 404 page logs its own document status; tests assert that status
        // explicitly. A 404 for any other resource still fails the test.
        const isOwnDocument404 =
          message.text().includes("status of 404") &&
          message.location().url === page.url();
        if (!isOwnDocument404) errors.push(message.text());
      });
      await use(errors);
      expect(errors, "browser errors on the page").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** Opens a page and waits for its heading (Vercel prefetching never idles). */
export async function open(page: Page, path: string) {
  const response = await page.goto(path, { waitUntil: "load" });
  await expect(page.locator("main h1").first()).toBeVisible();
  return response;
}

/** No sideways page scroll (the layout fits the viewport). */
export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow, "horizontal overflow in px").toBeLessThanOrEqual(0);
}
