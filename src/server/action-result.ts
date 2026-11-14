import type { ZodError } from "zod";

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID_STATE"
  | "CONFLICT"
  | "LIMIT_REACHED"
  | "RATE_LIMITED"
  | "PAYMENT_PROVIDER_ERROR"
  | "INTERNAL_ERROR";

export type FieldErrors = Partial<Record<string, string[]>>;

export type ActionError = {
  code: ErrorCode;
  reason?: string;
  message: string;
  fieldErrors?: FieldErrors;
};

export type ActionResult<T = null> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: ActionError; values?: Record<string, string> };

/** State type for `useActionState`: null before the first submission. */
export type FormState<T = null> = ActionResult<T> | null;

export function ok<T>(data: T, message?: string): ActionResult<T> {
  return { ok: true, data, message };
}

export function fail<T = null>(
  error: ActionError,
  values?: Record<string, string>,
): ActionResult<T> {
  return { ok: false, error, values };
}

export function validationFailed<T = null>(
  error: ZodError,
  values?: Record<string, string>,
): ActionResult<T> {
  const fieldErrors: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? String(issue.path[0]) : "_form";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fail(
    {
      code: "VALIDATION_ERROR",
      message: "Periksa kembali isian Anda.",
      fieldErrors,
    },
    values,
  );
}

/** Removes secrets (passwords) before echoing values back to the form. */
export function safeValues(
  values: Record<string, string>,
  omit: readonly string[] = ["password", "confirmPassword"],
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(values).filter(([key]) => !omit.includes(key)),
  );
}
