import { defineConfig, devices } from "@playwright/test";

/**
 * Browser tests (e2e/). They only read: they sign in and open pages, but never
 * submit forms that write, upload or pay, because the deployed site and local
 * development share one Supabase project (README, Testing).
 *
 * - Local: `npm run build && npm run test:e2e` starts `next start` on :3100.
 * - Deployed site: `E2E_BASE_URL=https://projekin.vercel.app npm run test:e2e`.
 */
const externalBaseURL = process.env.E2E_BASE_URL;
const baseURL = externalBaseURL ?? "http://localhost:3100";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // Keep the load on the shared Supabase project modest.
  workers: process.env.CI ? 2 : 3,
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never" }]]
    : [["list"]],
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    locale: "id-ID",
    timezoneId: "Asia/Jakarta",
    // Traces record cookies; CI artifacts of this public repo must not carry
    // the demo accounts' sessions, so traces are local-only.
    trace: process.env.CI ? "off" : "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /responsive\.spec\.ts/,
      dependencies: ["setup"],
    },
    {
      name: "mobile",
      // Chromium with a phone viewport; only the layout checks run here.
      use: { ...devices["Pixel 7"] },
      testMatch: /responsive\.spec\.ts/,
      dependencies: ["setup"],
    },
  ],
  webServer: externalBaseURL
    ? undefined
    : {
        command: "npm run start -- -p 3100",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
