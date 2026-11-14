import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Next.js rejects a "use server" module that exports anything but async
// functions, but only at runtime in the built app: every action in that file
// then fails with a 500 (this broke all service actions once). Unit tests
// import the modules directly and never see it, so check the source instead.

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

const ALLOWED = /^export (async function |type |interface )/;

describe('"use server" modules', () => {
  const files = sourceFiles(path.resolve(__dirname, "../../src")).filter(
    (file) => /^\s*["']use server["'];?/.test(fs.readFileSync(file, "utf8")),
  );

  it("exist (the scan found the server actions)", () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it("export only async functions and types", () => {
    const offenders = files.flatMap((file) =>
      fs
        .readFileSync(file, "utf8")
        .split("\n")
        .filter((line) => line.startsWith("export ") && !ALLOWED.test(line))
        .map((line) => `${path.relative(process.cwd(), file)}: ${line.trim()}`),
    );
    expect(offenders).toEqual([]);
  });
});
