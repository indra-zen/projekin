/**
 * Structured JSON logging to stdout (Vercel logs), ARCHITECTURE §11.2.
 * Never pass secrets, signature values, Snap tokens, emails or message bodies.
 */
export function log(
  level: "info" | "warn" | "error",
  event: string,
  fields: Record<string, unknown> = {},
): void {
  const line = JSON.stringify({
    level,
    event,
    time: new Date().toISOString(),
    ...fields,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

/** Short random ID to correlate a user-facing INTERNAL_ERROR with the log line. */
export function correlationId(): string {
  return crypto.randomUUID().slice(0, 8);
}
