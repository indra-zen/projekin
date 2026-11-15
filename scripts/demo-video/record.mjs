// Records the Projekin demo video: one continuous take of the full order flow on
// the live site. Budi (client) orders Rina's logo service and pays in Midtrans
// Sandbox through the QRIS simulator; Rina delivers a file; Budi approves and
// reviews; the admin records the payout; Rina sees her earnings.
//
//   node scripts/demo-video/record.mjs --yes              # the real take
//   node scripts/demo-video/record.mjs --yes --rehearsal  # Maya orders from Nurul instead
//
// Every take creates a real, completed order in the database behind
// DEMO_BASE_URL (default: production, which shares the demo database), hence
// --yes. Logins come from .demo-accounts (written by scripts/seed-demo).
// Output goes to scripts/demo-video/out/; finish.mjs then trims it (and makes
// the MP4, with optional music, when FFMPEG points to a full ffmpeg build).
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { finish } from "./finish.mjs";

if (!process.argv.includes("--yes")) {
  console.error(
    "This creates a real order (paid in Midtrans Sandbox) in the shared demo database. Re-run with --yes.",
  );
  process.exit(1);
}

const MODE = process.argv.includes("--rehearsal") ? "rehearsal" : "final";
const BASE = (
  process.env.DEMO_BASE_URL ?? "https://projekin.vercel.app"
).replace(/\/$/, "");
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const OUT = path.join(HERE, "out");
const LOGO = path.join(OUT, "logo-kopi-senja.png");
fs.mkdirSync(OUT, { recursive: true });

const CAST = {
  rehearsal: {
    client: "klien-2",
    freelancer: "freelancer-3",
    search: "proofreading",
    service: "Proofreading abstrak",
  },
  final: {
    client: "klien",
    freelancer: "freelancer",
    search: "logo",
    service: "Desain logo profesional untuk UMKM",
  },
}[MODE];

const accountsFile = path.join(ROOT, ".demo-accounts");
if (!fs.existsSync(accountsFile)) {
  console.error("Missing .demo-accounts (run scripts/seed-demo first).");
  process.exit(1);
}
const acc = Object.fromEntries(
  fs
    .readFileSync(accountsFile, "utf8")
    .trim()
    .split("\n")
    .map((line) => {
      const [label, email, password] = line.split(/\s+/);
      return [label, { e: email, p: password }];
    }),
);

// ---------------------------------------------------------------- overlay
// Runs in every top-level document. Cards and captions are CSS pseudo-elements
// on <html> from a constructed stylesheet, so they need no DOM nodes (nothing
// for React to hydrate over) and they paint on the very first frame after a
// full navigation. The pointer is a real element added after load.
function overlay(initial) {
  if (window.top !== window) return;
  const sheet = new CSSStyleSheet();
  const q = (s) =>
    '"' +
    String(s)
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\A ") +
    '"';
  let st = { caption: "", captionOn: false, card: "", cardOn: false, font: "" };
  let stored = null;
  try {
    stored = JSON.parse(sessionStorage.getItem("demo") || "null");
  } catch {}
  Object.assign(
    st,
    stored || (location.hostname === initial.host ? initial.state : null) || {},
  );
  const save = () => {
    try {
      sessionStorage.setItem("demo", JSON.stringify(st));
    } catch {}
  };
  const render = () =>
    sheet.replaceSync(`
    :root { --demo-font: ${st.font || "Arial, Helvetica, sans-serif"}; }
    html::before {
      content: ${q(st.card)}; position: fixed; inset: 0; z-index: 2147483646;
      display: flex; align-items: center; justify-content: center; text-align: center;
      white-space: pre-wrap; padding: 0 220px 80px; box-sizing: border-box;
      background: #7B4FB8; color: #FFFEFA; font: 800 84px/1.12 var(--demo-font);
      letter-spacing: -1.5px; pointer-events: none;
      opacity: ${st.cardOn ? 1 : 0}; transition: opacity 450ms ease;
    }
    html::after {
      content: ${q(st.caption)}; position: fixed; left: 50%; bottom: 44px; z-index: 2147483647;
      transform: translateX(-50%) translateY(${st.captionOn ? 0 : 16}px);
      width: max-content; max-width: 1380px; box-sizing: border-box;
      padding: 18px 32px; border-radius: 20px; border: 3px solid #17130F;
      background: #17130F; color: #FFFEFA; box-shadow: 7px 7px 0 0 #9165C7;
      font: 600 30px/1.4 var(--demo-font); text-align: center; white-space: pre-wrap;
      pointer-events: none; opacity: ${st.captionOn && st.caption ? 1 : 0};
      transition: opacity 300ms ease, transform 300ms ease;
    }
    #demo-cursor { position: fixed; left: 0; top: 0; z-index: 2147483647; width: 34px; height: 40px;
      pointer-events: none; transition-property: transform; transition-timing-function: cubic-bezier(.45,.05,.25,1);
      filter: drop-shadow(2px 3px 2px rgb(0 0 0 / .35)); }
    .demo-ripple { position: fixed; z-index: 2147483646; width: 56px; height: 56px; margin: -28px 0 0 -28px;
      border-radius: 50%; border: 4px solid #F56B9A; pointer-events: none; animation: demo-ripple 520ms ease-out forwards; }
    @keyframes demo-ripple { from { transform: scale(.3); opacity: 1; } to { transform: scale(1.4); opacity: 0; } }
    .demo-spot { position: fixed; z-index: 2147483645; border: 5px solid #F56B9A; border-radius: 18px;
      box-shadow: 0 0 0 9999px rgb(23 19 15 / .28); pointer-events: none; animation: demo-spot 400ms ease-out both; }
    @keyframes demo-spot { from { opacity: 0; transform: scale(1.06); } to { opacity: 1; transform: scale(1); } }
  `);
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  render();

  let cursor = null;
  let pos = { x: 960, y: 540 };
  const ensureCursor = () => {
    if (cursor?.isConnected || !document.body) return;
    cursor = document.createElement("div");
    cursor.id = "demo-cursor";
    cursor.innerHTML =
      '<svg width="34" height="40" viewBox="0 0 34 40"><path d="M3 2 L3 32 L11 25 L17 38 L23 35 L17 22 L28 22 Z" fill="#17130F" stroke="#FFFEFA" stroke-width="2.5" stroke-linejoin="round"/></svg>';
    cursor.style.transform = `translate(${pos.x - 3}px, ${pos.y - 2}px)`;
    document.body.appendChild(cursor);
  };
  const onLoad = () => {
    if (!st.font && document.body) {
      st.font = getComputedStyle(document.body).fontFamily;
      save();
      render();
    }
    ensureCursor();
  };
  if (document.readyState === "complete") onLoad();
  else window.addEventListener("load", onLoad);

  window.__demo = {
    caption(text, on) {
      if (text !== null) st.caption = text;
      st.captionOn = on;
      save();
      render();
    },
    card(text, on) {
      if (text !== null) st.card = text;
      st.cardOn = on;
      save();
      render();
    },
    move(x, y, ms) {
      pos = { x, y };
      ensureCursor();
      if (!cursor) return;
      cursor.style.transitionDuration = ms + "ms";
      cursor.style.transform = `translate(${x - 3}px, ${y - 2}px)`;
    },
    ripple() {
      const r = document.createElement("div");
      r.className = "demo-ripple";
      r.style.left = pos.x + "px";
      r.style.top = pos.y + "px";
      document.body.appendChild(r);
      setTimeout(() => r.remove(), 600);
    },
    spot(rect) {
      document.querySelectorAll(".demo-spot").forEach((e) => e.remove());
      if (!rect) return;
      const s = document.createElement("div");
      s.className = "demo-spot";
      Object.assign(s.style, {
        left: rect.x - 12 + "px",
        top: rect.y - 12 + "px",
        width: rect.width + 24 + "px",
        height: rect.height + 24 + "px",
      });
      document.body.appendChild(s);
    },
  };
}

// ---------------------------------------------------------------- setup
const browser = await chromium.launch();

// The file Rina delivers: a simple logo concept for "Kopi Senja".
async function makeLogo() {
  if (fs.existsSync(LOGO)) return;
  const p = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  await p.setContent(`<body style="margin:0">
<div style="width:1200px;height:800px;background:#F6EEDF;display:flex;align-items:center;justify-content:center;gap:120px;font-family:Georgia,serif">
  <svg width="360" height="360" viewBox="0 0 360 360">
    <circle cx="180" cy="150" r="96" fill="#E9A24B"/>
    <rect x="70" y="150" width="220" height="12" fill="#F6EEDF"/>
    <rect x="70" y="176" width="220" height="10" fill="#F6EEDF"/>
    <path d="M95 200 h170 v40 a70 70 0 0 1 -70 70 h-30 a70 70 0 0 1 -70 -70 z" fill="#5B3A29"/>
    <path d="M265 215 h18 a28 28 0 0 1 0 56 h-22" fill="none" stroke="#5B3A29" stroke-width="14"/>
    <rect x="80" y="318" width="200" height="12" rx="6" fill="#5B3A29"/>
  </svg>
  <div style="color:#5B3A29">
    <div style="font-size:120px;font-weight:700;line-height:1">Kopi</div>
    <div style="font-size:120px;font-weight:700;line-height:1;color:#C9772F">Senja</div>
    <div style="font-size:30px;letter-spacing:8px;margin-top:24px;font-family:Arial,sans-serif">KEDAI KOPI · TARAKAN</div>
  </div>
</div></body>`);
  await p.screenshot({ path: LOGO });
  await p.close();
}
await makeLogo();

async function sessionFor(role) {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.goto(BASE + "/login");
  await p.locator("#email").fill(acc[role].e);
  await p.locator("#password").fill(acc[role].p);
  await p.locator("main").getByRole("button", { name: "Masuk" }).click();
  await p.waitForURL((u) => !u.pathname.startsWith("/login"));
  const { cookies } = await ctx.storageState();
  await ctx.close();
  return cookies;
}
const sessions = {
  client: await sessionFor(CAST.client),
  freelancer: await sessionFor(CAST.freelancer),
  admin: await sessionFor("admin"),
};

const INTRO = "Projekin\nDemo alur pesanan";
const ctx = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  recordVideo: { dir: OUT, size: { width: 1920, height: 1080 } },
  locale: "id-ID",
  timezoneId: "Asia/Jakarta",
});
await ctx.addInitScript(overlay, {
  host: new URL(BASE).hostname,
  state: { card: INTRO, cardOn: true, caption: "", captionOn: false, font: "" },
});
await ctx.addCookies(sessions.client);
const page = await ctx.newPage();
const t0 = Date.now();
page.setDefaultTimeout(30_000);

// ---------------------------------------------------------------- helpers
const S = { x: 960, y: 540 };
const hold = (ms) => page.waitForTimeout(ms);
const log = (...a) =>
  console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);

async function restore() {
  await page.waitForLoadState("load");
  await page
    .evaluate((s) => window.__demo?.move(s.x, s.y, 0), S)
    .catch(() => {});
}
async function nav(url) {
  await page.goto(BASE + url, { waitUntil: "load" });
  await restore();
}
async function caption(text, readMs = 0) {
  await page.evaluate(() => window.__demo.caption(null, false)).catch(() => {});
  await hold(280);
  await page.evaluate((t) => window.__demo.caption(t, true), text);
  if (readMs) await hold(readMs);
}
async function hideCaption() {
  await page.evaluate(() => window.__demo.caption(null, false)).catch(() => {});
}
async function card(text, ms = 2400) {
  await page.evaluate((t) => window.__demo.card(t, true), text);
  await hold(500);
  if (ms) await hold(ms);
}
async function uncard() {
  await page.evaluate(() => window.__demo.card(null, false));
  await hold(500);
}
async function ensureVisible(loc) {
  const box = await loc.boundingBox();
  if (box && box.y > 90 && box.y + box.height < 1080 - 210) return;
  await loc.evaluate((el) =>
    el.scrollIntoView({ behavior: "smooth", block: "center" }),
  );
  await hold(900);
}
async function moveTo(loc, ms = 750) {
  await loc.waitFor({ state: "visible" });
  await ensureVisible(loc);
  const b = await loc.boundingBox();
  const x = Math.round(b.x + Math.min(b.width / 2, 120));
  const y = Math.round(b.y + b.height / 2);
  await page.evaluate(([x, y, ms]) => window.__demo.move(x, y, ms), [x, y, ms]);
  await page.mouse.move(x, y, { steps: 8 });
  await hold(ms + 60);
  S.x = x;
  S.y = y;
}
async function click(loc, ms) {
  await moveTo(loc, ms);
  await page.evaluate(() => window.__demo.ripple());
  await hold(140);
  await loc.click({
    position: {
      x: Math.min((await loc.boundingBox()).width / 2, 120),
      y: (await loc.boundingBox()).height / 2,
    },
  });
}
async function type(loc, text, delay = 32) {
  await click(loc);
  await loc.pressSequentially(text, { delay });
}
async function spot(loc, ms = 2200) {
  await ensureVisible(loc);
  const b = await loc.boundingBox();
  await page.evaluate((r) => window.__demo.spot(r), b);
  await hold(ms);
  await page.evaluate(() => window.__demo.spot(null));
}
async function scrollBy(dy, ms = 900) {
  await page.evaluate(
    (dy) => window.scrollBy({ top: dy, behavior: "smooth" }),
    dy,
  );
  await hold(ms);
}
async function switchTo(role) {
  await ctx.clearCookies();
  await ctx.addCookies(sessions[role]);
}

// ---------------------------------------------------------------- the story
let trimStart = null;
try {
  // Intro (card already on screen from the first paint).
  await nav("/");
  const tStart = Date.now();
  await caption(
    "Klien memesan jasa → bayar lewat Midtrans → freelancer mengirim hasil → klien menyetujui → admin mencairkan dana",
    3200,
  );
  await page.evaluate(() => window.__demo.card("1 · Klien mencari jasa", true));
  await caption("Budi, pemilik UMKM, butuh logo untuk kedai kopinya.", 2400);
  await uncard();

  // 1. Browse and order.
  await hold(700);
  await click(
    page.locator("header").getByRole("link", { name: "Cari jasa" }).first(),
  );
  await page.waitForURL(/\/services/);
  await hold(800);
  await type(page.getByPlaceholder(/Cari layanan/), CAST.search, 90);
  await hold(300);
  await click(page.locator("main").getByRole("button", { name: "Cari" }));
  await page.waitForURL(/[?&]q=|search=|query=/).catch(() => {});
  await hold(1200);
  await caption(
    "Semua penyedia jasa adalah mahasiswa yang sudah diverifikasi.",
  );
  await click(page.locator("main a", { hasText: CAST.service }).first());
  await page.waitForURL(/\/services\/[0-9a-f-]+$/);
  await page.locator("main h1").first().waitFor();
  await hold(1200);
  await caption(
    "Harga, lama pengerjaan, dan jumlah revisi jelas di depan.",
    1600,
  );
  await scrollBy(420, 1400);
  await scrollBy(-420, 900);
  await click(
    page.locator("main").getByRole("link", { name: "Pesan layanan" }).first(),
  );
  await page.waitForURL(/\/order$/);
  await hold(900);
  await caption("Budi menuliskan kebutuhannya.");
  await type(
    page.locator("#requirements"),
    "Logo untuk Kedai Kopi Senja di Tarakan. Menu andalan kopi susu gula aren, pembelinya mahasiswa dan pekerja muda. Suka warna cokelat dan krem, gaya sederhana dan modern.",
    18,
  );
  await hold(600);
  await click(page.getByRole("button", { name: /Buat pesanan/ }));
  await page.waitForURL(/\/dashboard\/orders\/[0-9a-f-]+/);
  const orderUrl = new URL(page.url()).pathname;
  const orderId = orderUrl.split("/").pop();
  await page.locator("main h1").first().waitFor();
  const code = (
    await page
      .locator("main")
      .getByText(/^PJK-\d+$/)
      .first()
      .textContent()
  ).trim();
  log("order", code, orderId);
  await hold(800);

  // 2. Pay in Midtrans Snap (sandbox) with the QRIS simulator.
  await caption(
    "Pesanan dibuat. Budi membayar lewat Midtrans (mode Sandbox, tanpa uang sungguhan).",
    1800,
  );
  await click(page.getByRole("button", { name: /Bayar sekarang/ }));
  const snap = page.frameLocator('iframe[src*="midtrans"]');
  const gopay = snap.getByText("GoPay QRIS").first();
  await gopay.waitFor({ state: "visible", timeout: 45_000 });
  await hold(1500);
  await click(gopay);
  const qr = snap.locator('img[alt="qr-code"]');
  await qr.waitFor({ state: "visible" });
  await hold(900);
  await caption(
    "Biasanya QR ini dipindai dengan aplikasi e-wallet. Di mode Sandbox kita memakai simulator Midtrans.",
    3200,
  );
  const qrUrl = await qr.getAttribute("src");

  await hideCaption();
  await page.goto("https://simulator.sandbox.midtrans.com/v2/qris/index", {
    waitUntil: "load",
  });
  await restore();
  await caption("Simulator pembayaran QRIS dari Midtrans");
  await click(page.locator("#qrCodeUrl"));
  await page.locator("#qrCodeUrl").fill(qrUrl);
  await hold(700);
  await click(page.getByRole("button", { name: "Scan QR" }));
  await page.waitForLoadState("load");
  await restore();
  await hold(1200);
  await click(page.getByRole("button", { name: "Pay" }));
  await page.waitForLoadState("load");
  await restore();
  await hold(1600);

  await hideCaption();
  await nav(orderUrl);
  await caption("Projekin memeriksa status pembayaran langsung ke Midtrans.");
  const working = page
    .locator("main")
    .getByText("Dikerjakan", { exact: true })
    .first();
  try {
    await working.waitFor({ state: "visible", timeout: 20_000 });
  } catch {
    await click(
      page.getByRole("button", { name: /Periksa status pembayaran/ }),
    );
    await working.waitFor({ state: "visible", timeout: 30_000 });
  }
  await hold(500);
  await caption(
    "Pembayaran terverifikasi. Dana ditahan platform, pesanan berstatus Dikerjakan.",
  );
  await spot(
    page
      .locator("main")
      .getByText(/Sedang dikerjakan/)
      .first(),
    2600,
  );

  // 3. Freelancer delivers.
  await card("2 · Freelancer mengirim hasil", 0);
  await caption("Rina, mahasiswa desain, melihat pesanan baru.", 1500);
  await switchTo("freelancer");
  await nav("/dashboard/orders?role=freelancer");
  await hold(800);
  await uncard();
  await hold(600);
  await click(page.locator(`main a[href^="${orderUrl}"]`).first());
  await page.waitForURL(new RegExp(orderUrl + "$"));
  await page.locator("main h1").first().waitFor();
  await hold(900);
  await caption("Rina membaca kebutuhan klien…");
  await spot(
    page.locator("main").getByText("Kebutuhan klien").first().locator(".."),
    2600,
  );
  await caption("…lalu mengirim hasil kerja beserta filenya.");
  await type(
    page.locator(`#deliver-${orderId}`),
    "Halo Pak Budi, ini konsep logo Kopi Senja. Saya lampirkan file PNG-nya. Silakan dicek ya!",
    24,
  );
  await moveTo(page.locator(`label[for="files-${orderId}"]`));
  await page.locator(`#files-${orderId}`).setInputFiles(LOGO);
  await page
    .locator("main")
    .getByText(/logo-kopi-senja/)
    .first()
    .waitFor({ timeout: 30_000 });
  await hold(900);
  await click(page.getByRole("button", { name: "Kirim hasil kerja" }));
  await page
    .locator("main")
    .getByText(/Hasil dikirim|Menunggu persetujuan|Dikirim/)
    .first()
    .waitFor({ timeout: 30_000 })
    .catch(() => {});
  await hold(1800);

  // 4. Client approves and reviews.
  await card("3 · Klien menyetujui hasil", 0);
  await caption("Budi menerima notifikasi hasil kerja.", 1500);
  await switchTo("client");
  await nav(orderUrl);
  await hold(800);
  await uncard();
  await hold(500);
  const attachment = page
    .locator("main")
    .getByText(/logo-kopi-senja/)
    .first();
  await caption(
    "Hasil kerja dan file lampirannya tersimpan di halaman pesanan.",
  );
  await spot(
    attachment.locator("xpath=ancestor::*[self::li or self::div][2]"),
    2600,
  );
  await caption("Hasilnya sesuai, Budi mengonfirmasi pesanan selesai.");
  await click(page.getByText("Konfirmasi pesanan selesai"));
  await hold(900);
  await click(page.getByRole("button", { name: "Ya, pesanan selesai" }));
  const rating = page.locator(`#rating-${orderId}`);
  await rating.waitFor({ state: "visible", timeout: 30_000 });
  await hold(900);
  await caption("Lalu memberi ulasan untuk Rina.");
  await click(rating);
  await rating.selectOption("5");
  await hold(500);
  await type(
    page.locator(`#review-${orderId}`),
    "Konsepnya keren dan pengerjaannya cepat. Terima kasih, Rina!",
    30,
  );
  await hold(400);
  await click(page.getByRole("button", { name: "Kirim ulasan" }));
  await rating.waitFor({ state: "detached", timeout: 30_000 }).catch(() => {});
  await hold(2000);

  // 5. Admin records the payout.
  await card("4 · Admin mencairkan dana", 0);
  await caption(
    "Admin mentransfer pendapatan freelancer, lalu mencatatnya.",
    1500,
  );
  await switchTo("admin");
  await nav("/admin/payouts");
  await hold(800);
  await uncard();
  await hold(500);
  const ref = page.locator(`#ref-${orderId}`);
  await ensureVisible(ref);
  await spot(
    page.locator("main").getByText(new RegExp(code)).first().locator(".."),
    2200,
  );
  await type(ref, "Transfer BCA 15/11 #0412", 45);
  await hold(400);
  await click(
    page
      .locator("form")
      .filter({ has: ref })
      .getByRole("button", { name: "Tandai sudah dibayar" }),
  );
  await hold(2200);

  // 6. Freelancer sees the earnings.
  await card("5 · Freelancer menerima pendapatan", 0);
  await caption("Rina menerima harga jasa dikurangi biaya platform 10%.", 1500);
  await switchTo("freelancer");
  await nav("/dashboard/earnings");
  await hold(800);
  await uncard();
  await hold(700);
  await spot(
    page
      .locator("main")
      .getByText(new RegExp(code))
      .first()
      .locator(
        "xpath=ancestor::*[contains(@class,'justify-between') or self::li][1]",
      ),
    3200,
  );

  // Outro.
  await page.evaluate(() =>
    window.__demo.card("Projekin\nprojekin.vercel.app", true),
  );
  await caption(
    "Marketplace jasa yang freelancer-nya pasti mahasiswa aktif.",
    3800,
  );

  trimStart = (tStart - t0) / 1000;
  log("done:", code);
} catch (error) {
  await page.screenshot({ path: path.join(OUT, "error.png") }).catch(() => {});
  console.error("FAILED at", page.url(), error);
  process.exitCode = 1;
} finally {
  const video = page.video();
  await ctx.close();
  const raw = path.join(OUT, `raw-${MODE}.webm`);
  if (video) await video.saveAs(raw);
  if (video) await video.delete();
  await browser.close();
  if (video && trimStart !== null) {
    // The first frames are blank while the home page loads behind the intro card.
    await finish(
      raw,
      path.join(OUT, `projekin-demo${MODE === "final" ? "" : "-rehearsal"}`),
      {
        start: trimStart + 0.2,
      },
    );
  } else if (video) {
    console.log("raw video (failed take):", raw);
  }
}
