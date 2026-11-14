import "server-only";

/**
 * Midtrans configuration (server only). Payments are **Sandbox only** in the
 * MVP: the URLs are fixed to the sandbox hosts and MIDTRANS_IS_PRODUCTION must
 * be "false" (or unset). Validated lazily so the rest of the app builds and
 * runs without payment credentials; payment entry points report
 * PAYMENT_NOT_CONFIGURED instead.
 */
export class PaymentConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentConfigError";
  }
}

export const MIDTRANS_SANDBOX = {
  snapUrl: "https://app.sandbox.midtrans.com/snap/v1/transactions",
  apiBaseUrl: "https://api.sandbox.midtrans.com/v2",
  snapJsUrl: "https://app.sandbox.midtrans.com/snap/snap.js",
} as const;

export type MidtransConfig = typeof MIDTRANS_SANDBOX & { serverKey: string };

export function getMidtransConfig(
  env: Record<string, string | undefined> = process.env,
): MidtransConfig {
  const isProduction = (env.MIDTRANS_IS_PRODUCTION ?? "false").trim();
  if (isProduction !== "false") {
    throw new PaymentConfigError(
      'MIDTRANS_IS_PRODUCTION must be "false": Projekin uses the Midtrans Sandbox only.',
    );
  }
  const serverKey = env.MIDTRANS_SERVER_KEY?.trim();
  if (!serverKey) {
    throw new PaymentConfigError("MIDTRANS_SERVER_KEY is not set.");
  }
  return { ...MIDTRANS_SANDBOX, serverKey };
}

/**
 * Throws PaymentConfigError unless every server secret the payment flow needs
 * is present: the Midtrans Server Key and the Supabase secret key (for the
 * service-role-only payment RPCs).
 */
export function assertPaymentsConfigured(
  env: Record<string, string | undefined> = process.env,
): void {
  getMidtransConfig(env);
  if (!env.SUPABASE_SECRET_KEY?.trim()) {
    throw new PaymentConfigError("SUPABASE_SECRET_KEY is not set.");
  }
}
