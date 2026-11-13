import type { ActionError, ErrorCode } from "./action-result";
import { messageFor } from "./error-messages";

type PgLikeError = { code?: string | null; message?: string | null };
type AuthLikeError = {
  code?: string | null;
  status?: number | null;
  message?: string;
};

const CONFLICT_REASONS = new Set([
  "ALREADY_PROPOSED",
  "ALREADY_REVIEWED",
  "DISPUTE_EXISTS",
  "VERIFICATION_PENDING",
  "USERNAME_TAKEN",
  "PAYMENT_IN_PROGRESS",
]);

const CONSTRAINT_REASONS: Record<string, string> = {
  profiles_username_key: "USERNAME_TAKEN",
  student_verifications_one_pending_per_user: "VERIFICATION_PENDING",
};

function build(code: ErrorCode, reason?: string): ActionError {
  return { code, reason, message: messageFor(code, reason) };
}

/** Maps a PostgREST/Postgres error to an ActionError (API_CONTRACT §7). */
export function mapPostgresError(error: PgLikeError): ActionError {
  const code = error.code ?? "";
  const message = (error.message ?? "").trim();

  switch (code) {
    case "PJ401":
      return build("UNAUTHENTICATED", message || undefined);
    case "PJ403":
      return build("FORBIDDEN", message || undefined);
    case "PJ404":
      return build("NOT_FOUND", message || undefined);
    case "PJ409":
      if (message.startsWith("MAX_")) return build("LIMIT_REACHED", message);
      if (CONFLICT_REASONS.has(message)) return build("CONFLICT", message);
      return build("INVALID_STATE", message || undefined);
    case "PJ422":
      return build("VALIDATION_ERROR", message || undefined);
    case "23505": {
      const constraint = Object.keys(CONSTRAINT_REASONS).find((name) =>
        message.includes(name),
      );
      return build(
        "CONFLICT",
        constraint ? CONSTRAINT_REASONS[constraint] : undefined,
      );
    }
    case "23503":
      return build("CONFLICT");
    case "23514":
      return build("VALIDATION_ERROR");
    case "42501":
      return build("FORBIDDEN");
    case "PGRST116":
      return build("NOT_FOUND");
    default:
      return build("INTERNAL_ERROR");
  }
}

/** Maps a Supabase Auth error (by its stable `code`) to an ActionError. */
export function mapAuthError(error: AuthLikeError): ActionError {
  switch (error.code) {
    case "invalid_credentials":
      return build("UNAUTHENTICATED", "INVALID_CREDENTIALS");
    case "email_not_confirmed":
      return build("FORBIDDEN", "EMAIL_NOT_CONFIRMED");
    case "weak_password":
      return build("VALIDATION_ERROR", "WEAK_PASSWORD");
    case "same_password":
      return build("VALIDATION_ERROR", "SAME_PASSWORD");
    case "signup_disabled":
    case "email_provider_disabled":
      return build("FORBIDDEN", "SIGNUP_DISABLED");
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return build("RATE_LIMITED", "RATE_LIMITED");
    case "email_address_invalid":
      return build("VALIDATION_ERROR");
    case "session_not_found":
    case "user_not_found":
      return build("UNAUTHENTICATED");
    default:
      if (error.status === 429) return build("RATE_LIMITED", "RATE_LIMITED");
      return build("INTERNAL_ERROR");
  }
}
