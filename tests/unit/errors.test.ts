import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { reasonMessages } from "@/server/error-messages";
import { mapAuthError, mapPostgresError } from "@/server/errors";

describe("mapPostgresError", () => {
  it.each([
    [{ code: "PJ401", message: "UNAUTHENTICATED" }, "UNAUTHENTICATED"],
    [{ code: "PJ403", message: "FORBIDDEN" }, "FORBIDDEN"],
    [{ code: "PJ404", message: "VERIFICATION_NOT_FOUND" }, "NOT_FOUND"],
    [{ code: "PJ409", message: "NOT_PENDING" }, "INVALID_STATE"],
    [{ code: "PJ409", message: "USERNAME_TAKEN" }, "CONFLICT"],
    [{ code: "PJ409", message: "MAX_PAYMENT_ATTEMPTS" }, "LIMIT_REACHED"],
    [{ code: "PJ422", message: "INVALID_REASON" }, "VALIDATION_ERROR"],
    [{ code: "23514", message: "check" }, "VALIDATION_ERROR"],
    [{ code: "42501", message: "permission denied" }, "FORBIDDEN"],
    [{ code: "PGRST116", message: "no rows" }, "NOT_FOUND"],
    [{ code: "XX000", message: "boom" }, "INTERNAL_ERROR"],
  ])("maps %o to %s", (error, code) => {
    expect(mapPostgresError(error).code).toBe(code);
  });

  it("maps a username unique violation to USERNAME_TAKEN", () => {
    const mapped = mapPostgresError({
      code: "23505",
      message:
        'duplicate key value violates unique constraint "profiles_username_key"',
    });
    expect(mapped).toMatchObject({
      code: "CONFLICT",
      reason: "USERNAME_TAKEN",
    });
    expect(mapped.message).toBe(reasonMessages.USERNAME_TAKEN);
  });

  it.each([
    ["reviews_one_per_reviewer", "ALREADY_REVIEWED"],
    ["disputes_order_id_key", "DISPUTE_EXISTS"],
  ])("maps a concurrent duplicate on %s to %s", (constraint, reason) => {
    const mapped = mapPostgresError({
      code: "23505",
      message: `duplicate key value violates unique constraint "${constraint}"`,
    });
    expect(mapped).toMatchObject({ code: "CONFLICT", reason });
    expect(mapped.message).toBe(reasonMessages[reason]);
  });

  it("never exposes raw database messages", () => {
    const mapped = mapPostgresError({
      code: "XX000",
      message: "relation secret_table does not exist",
    });
    expect(mapped.message).not.toContain("secret_table");
  });
});

describe("mapAuthError", () => {
  it("uses a generic message for invalid credentials", () => {
    expect(mapAuthError({ code: "invalid_credentials" })).toMatchObject({
      code: "UNAUTHENTICATED",
      message: "Email atau kata sandi salah.",
    });
  });

  it("maps rate limits", () => {
    expect(mapAuthError({ code: "over_email_send_rate_limit" }).code).toBe(
      "RATE_LIMITED",
    );
    expect(mapAuthError({ status: 429 }).code).toBe("RATE_LIMITED");
  });
});

describe("Indonesian message coverage", () => {
  it("has a user-facing message for every reason raised by the SQL migrations", () => {
    const dir = path.resolve(__dirname, "../../supabase/migrations");
    const reasons = new Set<string>();
    for (const file of readdirSync(dir)) {
      const sql = readFileSync(path.join(dir, file), "utf8");
      for (const match of sql.matchAll(/message\s*=\s*'([A-Z_]+)'/g)) {
        reasons.add(match[1]!);
      }
    }
    expect(reasons.size).toBeGreaterThan(10);
    const missing = [...reasons].filter(
      (reason) => !(reason in reasonMessages),
    );
    expect(missing).toEqual([]);
  });
});
