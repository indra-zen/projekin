// Generated artwork for the demo data: avatars, student cards, service covers,
// portfolio images and delivery files. Rendered in headless Chromium so the
// output matches the app's neo-brutalist palette (docs/DESIGN_SYSTEM.md).
import { chromium } from "@playwright/test";

const C = {
  ink: "#17130f",
  paper: "#fffefa",
  bg: "#f1ecf8",
  primary: "#7b4fb8",
  lilac: "#9165c7",
  orange: "#ffb86b",
  pink: "#f56b9a",
  yellow: "#ffe27a",
  green: "#c9f2c7",
  rose: "#ffd6e2",
};

const FONT = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Plus+Jakarta+Sans:wght@500;700&display=swap" rel="stylesheet">`;

const esc = (s) =>
  String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );

const page = (
  w,
  h,
  body,
  extra = "",
) => `<!doctype html><html><head><meta charset="utf-8">${FONT}<style>
*{box-sizing:border-box;margin:0}
body{width:${w}px;height:${h}px;overflow:hidden;font-family:'Plus Jakarta Sans',system-ui,sans-serif;color:${C.ink}}
.d{font-family:'Bricolage Grotesque',system-ui,sans-serif;font-weight:800;letter-spacing:-.02em}
.box{border:5px solid ${C.ink};border-radius:22px;background:${C.paper}}
.shadow{box-shadow:10px 10px 0 ${C.ink}}
${extra}</style></head><body>${body}</body></html>`;

const palettes = {
  logo: [C.orange, C.yellow],
  social: [C.pink, C.rose],
  package: [C.green, C.yellow],
  web: [C.lilac, C.bg],
  code: [C.primary, C.green],
  doc: [C.yellow, C.paper],
  video: [C.pink, C.yellow],
  motion: [C.primary, C.orange],
  chart: [C.green, C.rose],
  app: [C.lilac, C.yellow],
};

/** The illustration inside each artwork, by kind. */
function motif(art, title) {
  const t = esc(title);
  switch (art) {
    case "logo":
      return `<div class="box shadow" style="width:300px;height:300px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:${C.orange}">
        <div style="width:190px;height:95px;border-radius:190px 190px 0 0;background:${C.yellow};border:5px solid ${C.ink};border-bottom:none;margin-top:60px"></div></div>
        <div class="d" style="font-size:44px;margin-top:26px;text-align:center">${t}</div>`;
    case "social":
      return `<div style="display:grid;grid-template-columns:repeat(3,96px);gap:12px">${[
        C.pink,
        C.yellow,
        C.lilac,
        C.green,
        C.orange,
        C.rose,
        C.primary,
        C.yellow,
        C.pink,
      ]
        .map(
          (c) =>
            `<div class="box" style="height:96px;background:${c};border-radius:14px"></div>`,
        )
        .join("")}</div>
        <div class="d box shadow" style="font-size:36px;margin-top:26px;padding:8px 22px;border-radius:16px">${t}</div>`;
    case "package":
      return `<div style="display:flex;gap:28px;align-items:flex-end">
        <div class="box shadow" style="width:150px;height:290px;border-radius:30px 30px 18px 18px;background:${C.yellow};display:flex;align-items:center;justify-content:center"><div class="box" style="width:110px;height:110px;border-radius:50%;background:${C.green}"></div></div>
        <div class="box shadow" style="width:220px;height:200px;background:${C.orange};display:flex;align-items:center;justify-content:center;padding:14px;text-align:center"><span class="d" style="font-size:30px">${t}</span></div></div>`;
    case "web":
    case "app": {
      const phone = art === "app";
      return `<div class="box shadow" style="width:${phone ? 260 : 560}px;height:${phone ? 400 : 340}px;overflow:hidden;border-radius:${phone ? 36 : 22}px">
        <div style="height:${phone ? 34 : 40}px;border-bottom:5px solid ${C.ink};background:${C.yellow};display:flex;gap:8px;align-items:center;padding:0 14px">${phone ? "" : `<i style="width:14px;height:14px;border-radius:50%;background:${C.pink};border:3px solid ${C.ink}"></i><i style="width:14px;height:14px;border-radius:50%;background:${C.green};border:3px solid ${C.ink}"></i>`}</div>
        <div style="padding:22px"><div class="d" style="font-size:${phone ? 26 : 34}px">${t}</div>
        <div style="height:14px;width:70%;background:#e9e1f4;border-radius:8px;margin:14px 0"></div>
        <div style="display:flex;gap:12px"><div class="box" style="flex:1;height:${phone ? 90 : 120}px;background:${C.lilac};border-radius:14px"></div>${phone ? "" : `<div class="box" style="flex:1;height:120px;background:${C.pink};border-radius:14px"></div>`}</div>
        <div class="box" style="margin-top:16px;width:${phone ? 100 : 160}px;height:44px;border-radius:12px;background:${C.primary}"></div></div></div>`;
    }
    case "code":
      return `<div class="box shadow" style="width:560px;height:330px;background:${C.ink};color:${C.green};font:600 22px/1.7 ui-monospace,monospace;padding:28px">
        <div><span style="color:${C.pink}">public function</span> index()</div><div>{</div>
        <div style="padding-left:34px">$produk = Produk::<span style="color:${C.yellow}">with</span>('gambar')</div>
        <div style="padding-left:68px">-&gt;paginate(<span style="color:${C.orange}">24</span>);</div>
        <div style="padding-left:34px"><span style="color:${C.pink}">return</span> view('produk', ...);</div><div>}</div></div>`;
    case "doc":
      return `<div class="box shadow" style="width:420px;height:400px;padding:34px;background:${C.paper}">
        <div class="d" style="font-size:30px;line-height:1.1">${t}</div>
        ${[90, 100, 85, 95, 70, 100, 60].map((w) => `<div style="height:12px;width:${w}%;background:#e9e1f4;border-radius:6px;margin-top:16px"></div>`).join("")}
        <div style="margin-top:22px;display:inline-block;background:${C.yellow};border:4px solid ${C.ink};border-radius:10px;padding:4px 12px;font-weight:700">ID ⇄ EN</div></div>`;
    case "video":
    case "motion":
      return `<div class="box shadow" style="width:${art === "video" ? 300 : 520}px;height:${art === "video" ? 420 : 300}px;background:${C.ink};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px">
        <div style="width:110px;height:110px;border-radius:50%;background:${C.yellow};border:5px solid ${C.paper};display:flex;align-items:center;justify-content:center">
          <div style="width:0;height:0;border-left:38px solid ${C.ink};border-top:24px solid transparent;border-bottom:24px solid transparent;margin-left:10px"></div></div>
        <div class="d" style="color:${C.paper};font-size:30px;text-align:center;padding:0 18px">${t}</div></div>`;
    case "chart":
      return `<div class="box shadow" style="width:520px;height:330px;padding:28px;display:flex;align-items:flex-end;gap:18px">
        ${[90, 140, 120, 190, 230, 270].map((hgt, i) => `<div class="box" style="flex:1;height:${hgt}px;border-radius:10px;background:${[C.lilac, C.pink, C.orange, C.yellow, C.green, C.primary][i]}"></div>`).join("")}</div>`;
    default:
      return `<div class="d" style="font-size:48px">${t}</div>`;
  }
}

/** 960 × 600 artwork: covers, portfolio images and image deliverables. */
export function artworkHtml({ art, title, label }) {
  const [a, b] = palettes[art] ?? [C.lilac, C.yellow];
  return page(
    960,
    600,
    `<div style="width:960px;height:600px;background:${a};position:relative;display:flex;align-items:center;justify-content:center;flex-direction:column;overflow:hidden">
      <div style="position:absolute;width:520px;height:520px;border-radius:50%;background:${b};border:5px solid ${C.ink};right:-140px;top:-160px"></div>
      <div style="position:absolute;width:260px;height:260px;background:${b};border:5px solid ${C.ink};left:-70px;bottom:-90px;transform:rotate(18deg);border-radius:30px"></div>
      <div style="position:relative;display:flex;flex-direction:column;align-items:center">${motif(art, title)}</div>
      ${label ? `<div style="position:absolute;left:28px;top:26px;background:${C.paper};border:4px solid ${C.ink};border-radius:12px;padding:6px 14px;font-weight:700;font-size:20px;box-shadow:5px 5px 0 ${C.ink}">${esc(label)}</div>` : ""}
    </div>`,
  );
}

/** 320 × 320 initials avatar. */
export function avatarHtml({ fullName, color }) {
  const initials = fullName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return page(
    320,
    320,
    `<div style="width:320px;height:320px;background:${color};display:flex;align-items:center;justify-content:center">
      <div class="d" style="font-size:132px;color:${C.ink};background:${C.paper};border:6px solid ${C.ink};border-radius:50%;width:240px;height:240px;display:flex;align-items:center;justify-content:center;box-shadow:8px 8px 0 ${C.ink}">${esc(initials)}</div></div>`,
  );
}

/** 856 × 540 student card, visibly marked as demo data. */
export function studentCardHtml({ fullName, nim, university, major }) {
  return page(
    856,
    540,
    `<div style="width:856px;height:540px;background:#e8f1ff;position:relative;padding:36px 44px;font-size:26px">
      <div class="d" style="font-size:34px;color:#0b3d91">KARTU TANDA MAHASISWA</div>
      <div style="font-weight:700;margin-top:6px;color:#0b3d91">${esc(university)}</div>
      <div style="display:flex;gap:36px;margin-top:34px">
        <div style="width:180px;height:230px;background:#c9d6ea;border:4px solid #0b3d91;border-radius:10px;display:flex;align-items:flex-end;justify-content:center;overflow:hidden">
          <div style="width:120px;height:150px;background:#8aa2c8;border-radius:60px 60px 0 0"></div></div>
        <div style="line-height:1.9"><div>Nama: <b>${esc(fullName)}</b></div><div>NIM: <b>${esc(nim)}</b></div><div>Program studi: <b>${esc(major ?? "—")}</b></div><div>Berlaku s.d.: <b>2027</b></div></div>
      </div>
      <div style="position:absolute;right:-40px;bottom:60px;transform:rotate(-14deg);border:6px solid #c92a2a;color:#c92a2a;font-weight:800;font-size:34px;padding:8px 24px;border-radius:10px;background:rgba(255,255,255,.7)">CONTOH — DATA DEMO</div>
    </div>`,
  );
}

/** A one-page PDF deliverable (report, translation, guide). */
export function documentHtml({ title, subtitle }) {
  return `<!doctype html><html><head><meta charset="utf-8">${FONT}<style>
    body{font-family:'Plus Jakarta Sans',system-ui,sans-serif;color:${C.ink};padding:56px;font-size:15px;line-height:1.7}
    h1{font-family:'Bricolage Grotesque',system-ui,sans-serif;font-size:34px;margin:0 0 6px}
    .tag{display:inline-block;background:${C.yellow};border:3px solid ${C.ink};border-radius:8px;padding:2px 10px;font-weight:700}
    p{margin:16px 0}.note{margin-top:40px;font-size:12px;color:#555}</style></head><body>
    <span class="tag">Projekin · hasil pekerjaan</span><h1>${esc(title)}</h1><div>${esc(subtitle)}</div>
    <p>Dokumen ini adalah contoh hasil pekerjaan untuk data demo Projekin. Isinya merangkum pekerjaan yang dikirim freelancer kepada klien melalui halaman pesanan.</p>
    <p>Ringkasan: seluruh poin pada brief sudah dikerjakan, file sumber dan versi siap pakai disertakan, dan catatan revisi dicantumkan di bagian akhir.</p>
    <p>Catatan revisi: tidak ada revisi terbuka. Silakan konfirmasi pesanan jika hasil sudah sesuai.</p>
    <div class="note">Dibuat otomatis oleh scripts/seed-demo — bukan dokumen asli.</div></body></html>`;
}

/** Renders HTML to PNG or PDF buffers with one shared browser. */
export async function createRenderer() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ deviceScaleFactor: 1 });
  const tab = await context.newPage();
  const load = async (html) => {
    await tab.setContent(html, { waitUntil: "load" });
    await tab.evaluate(() => document.fonts.ready);
  };
  return {
    async png(html, width, height) {
      await tab.setViewportSize({ width, height });
      await load(html);
      return tab.screenshot({
        type: "png",
        clip: { x: 0, y: 0, width, height },
      });
    },
    async pdf(html) {
      await load(html);
      return tab.pdf({ format: "A4", printBackground: true });
    },
    close: () => browser.close(),
  };
}
