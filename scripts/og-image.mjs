// Regenerates src/app/opengraph-image.jpg, the picture shown when someone shares
// a Projekin link (WhatsApp, Facebook, X, LinkedIn, Telegram, ...): a screenshot
// of the top of the home page at the standard 1200×630 link-preview size.
// Re-run it after a visible change to the home page.
//
//   node scripts/og-image.mjs                          # from the live site
//   OG_SOURCE_URL=http://localhost:3000 node scripts/og-image.mjs
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const source = process.env.OG_SOURCE_URL ?? "https://projekin.vercel.app";
const target = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../src/app/opengraph-image.jpg",
);

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1200, height: 630 },
  locale: "id-ID",
});
await page.goto(source, { waitUntil: "load" });
await page.locator("main h1").first().waitFor();
await page.waitForTimeout(1500); // fonts and hero illustration settle
await page.screenshot({ path: target, type: "jpeg", quality: 88 });
await browser.close();

// WhatsApp skips preview images much above 300 KB.
const kb = Math.round(fs.statSync(target).size / 1024);
console.log(`${target} (${kb} KB)`);
if (kb > 300) process.exitCode = 1;
