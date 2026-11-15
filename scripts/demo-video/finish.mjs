// Turns a raw Playwright recording into the shareable demo video.
//
//   node scripts/demo-video/finish.mjs <raw.webm> [--start 0.9] [--out path/name]
//                                                 [--music track.mp3] [--volume 0.2]
//
// Always writes <name>.webm (VP9, silent) with Playwright's bundled ffmpeg.
// When FFMPEG points to a full ffmpeg build it also writes <name>.mp4 (H.264,
// plays everywhere, including PowerPoint), with --music mixed in under the
// picture: looped or cut to length, 2 s fade-in, 3 s fade-out.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Playwright's own ffmpeg (decodes WebM, encodes VP9; no H.264, no audio). */
function playwrightFfmpeg() {
  const roots = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    path.join(os.homedir(), ".cache", "ms-playwright"),
    path.join(os.homedir(), "Library", "Caches", "ms-playwright"),
    process.env.LOCALAPPDATA &&
      path.join(process.env.LOCALAPPDATA, "ms-playwright"),
  ].filter(Boolean);
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    const dirs = fs
      .readdirSync(root)
      .filter((d) => d.startsWith("ffmpeg-"))
      .sort()
      .reverse();
    for (const dir of dirs) {
      for (const bin of ["ffmpeg-linux", "ffmpeg-mac", "ffmpeg-win64.exe"]) {
        const file = path.join(root, dir, bin);
        if (fs.existsSync(file)) return file;
      }
    }
  }
  return null;
}

function run(bin, args) {
  const result = spawnSync(
    bin,
    ["-hide_banner", "-loglevel", "error", "-y", ...args],
    {
      stdio: ["ignore", "inherit", "inherit"],
    },
  );
  if (result.status !== 0)
    throw new Error(`${path.basename(bin)} failed (exit ${result.status})`);
}

function durationOf(bin, file) {
  const { stderr } = spawnSync(bin, ["-hide_banner", "-i", file], {
    encoding: "utf8",
  });
  const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(stderr ?? "");
  if (!m) throw new Error(`cannot read the duration of ${file}`);
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

/**
 * @param {string} raw recording from Playwright
 * @param {string} out output path without extension
 * @param {{ start?: number, music?: string, volume?: number }} [options]
 */
export async function finish(
  raw,
  out,
  { start = 0, music, volume = 0.2 } = {},
) {
  const ss = String(Math.max(0, start).toFixed(2));
  const written = [];

  const pw = playwrightFfmpeg();
  if (pw) {
    run(pw, [
      "-ss",
      ss,
      "-i",
      raw,
      "-c:v",
      "libvpx-vp9",
      "-crf",
      "28",
      "-b:v",
      "0",
      "-deadline",
      "good",
      "-cpu-used",
      "4",
      "-row-mt",
      "1",
      `${out}.webm`,
    ]);
    written.push(`${out}.webm`);
  } else {
    console.warn(
      "Playwright's ffmpeg not found (npx playwright install chromium); skipping the WebM.",
    );
  }

  const full = process.env.FFMPEG;
  if (full) {
    const video = [
      "-c:v",
      "libx264",
      "-crf",
      "18",
      "-preset",
      "slow",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
    ];
    if (music) {
      const length = durationOf(full, raw) - Number(ss);
      const fadeOut = Math.max(0, length - 3).toFixed(2);
      run(full, [
        "-ss",
        ss,
        "-i",
        raw,
        "-stream_loop",
        "-1",
        "-i",
        music,
        "-filter_complex",
        `[1:a]volume=${volume},afade=t=in:d=2,afade=t=out:st=${fadeOut}:d=3[a]`,
        "-map",
        "0:v",
        "-map",
        "[a]",
        ...video,
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-t",
        length.toFixed(2),
        `${out}.mp4`,
      ]);
    } else {
      run(full, ["-ss", ss, "-i", raw, ...video, "-an", `${out}.mp4`]);
    }
    written.push(`${out}.mp4`);
  } else if (music) {
    console.warn(
      "--music needs FFMPEG=/path/to/a/full/ffmpeg; the WebM has no sound.",
    );
  }

  for (const file of written) console.log("video:", file);
  return written;
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  const [raw, ...rest] = process.argv.slice(2);
  if (!raw || !fs.existsSync(raw)) {
    console.error(
      "Usage: node scripts/demo-video/finish.mjs <raw.webm> [--start s] [--out name] [--music file] [--volume 0.2]",
    );
    process.exit(1);
  }
  const opt = (name) => {
    const i = rest.indexOf(`--${name}`);
    return i >= 0 ? rest[i + 1] : undefined;
  };
  const out = opt("out") ?? path.join(path.dirname(raw), "projekin-demo");
  await finish(raw, out, {
    start: Number(opt("start") ?? 0),
    music: opt("music"),
    volume: opt("volume") ? Number(opt("volume")) : undefined,
  });
}
