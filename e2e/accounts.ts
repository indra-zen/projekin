import fs from "node:fs";
import path from "node:path";

export const ROLES = ["client", "freelancer", "admin"] as const;
export type Role = (typeof ROLES)[number];

type Account = { email: string; password: string };

/** `.demo-accounts` (git-ignored) names the client role "klien". */
const FILE_ROLE: Record<string, Role> = {
  klien: "client",
  client: "client",
  freelancer: "freelancer",
  admin: "admin",
};

function fromFile(): Partial<Record<Role, Account>> {
  const file = path.resolve(".demo-accounts");
  if (!fs.existsSync(file)) return {};
  const accounts: Partial<Record<Role, Account>> = {};
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const [name, email, password] = line.trim().split(/\s+/);
    const role = name ? FILE_ROLE[name] : undefined;
    if (role && email && password) accounts[role] = { email, password };
  }
  return accounts;
}

/**
 * Demo credentials: `E2E_<ROLE>_EMAIL` / `E2E_<ROLE>_PASSWORD` (CI secrets),
 * falling back to the local `.demo-accounts` file. Tests for a role without
 * credentials are skipped, never failed.
 */
export function account(role: Role): Account | undefined {
  const prefix = `E2E_${role.toUpperCase()}`;
  const email = process.env[`${prefix}_EMAIL`];
  const password = process.env[`${prefix}_PASSWORD`];
  if (email && password) return { email, password };
  return fromFile()[role];
}

export const hasAccount = (role: Role) => account(role) !== undefined;

/** Paths are relative to the repository root, where npm runs Playwright. */
export const authFile = (role: Role) =>
  path.resolve("e2e", ".auth", `${role}.json`);
