import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { log } from "@/server/log";
import {
  assertPaymentsConfigured,
  getMidtransConfig,
} from "@/server/payments/config";
import { syncAndApply } from "@/server/payments/process-status";
import { verifyNotificationSignature } from "@/server/payments/signature";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 64 * 1024;
const REQUIRED_FIELDS = [
  "order_id",
  "status_code",
  "gross_amount",
  "signature_key",
] as const;

const json = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status });

/**
 * Midtrans HTTP notification (API_CONTRACT §3.2, ARCHITECTURE §9.3).
 *
 * 1. Parse (malformed → 400). 2. Verify signature_key (timing-safe).
 * 3. Log the notification. 4. Invalid signature → 401, nothing applied.
 * 5. Ask the Status API and apply that answer (never the body's own status).
 * Deliberately ignored outcomes return 200 so Midtrans stops retrying;
 * transient failures return 500 so it retries. Processing is idempotent.
 */
export async function POST(request: Request) {
  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
    log("warn", "payment.notification.too_large");
    return json(400, { ok: false, error: "payload_too_large" });
  }
  let payload: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("not an object");
    }
    payload = parsed as Record<string, unknown>;
  } catch {
    log("warn", "payment.notification.malformed");
    return json(400, { ok: false, error: "malformed_json" });
  }
  if (REQUIRED_FIELDS.some((field) => typeof payload[field] !== "string")) {
    log("warn", "payment.notification.missing_fields");
    return json(400, { ok: false, error: "missing_fields" });
  }
  const midtransOrderId = payload.order_id as string;

  let serverKey: string;
  let admin: ReturnType<typeof createAdminClient>;
  try {
    assertPaymentsConfigured();
    serverKey = getMidtransConfig().serverKey;
    admin = createAdminClient();
  } catch (error) {
    log("error", "payment.not_configured", {
      reason: (error as Error).message,
    });
    return json(500, { ok: false, error: "not_configured" });
  }

  const signatureValid = verifyNotificationSignature(payload, serverKey);
  log("info", "payment.notification.received", {
    midtransOrderId,
    transactionStatus: payload.transaction_status,
    signatureValid,
  });

  // The stored payload omits the signature value (ARCHITECTURE §11.2).
  const { signature_key: _signature, ...storedPayload } = payload;
  void _signature;
  const { data: logged, error: logError } = await admin
    .from("payment_notifications")
    .insert({
      midtrans_order_id: midtransOrderId.slice(0, 100),
      transaction_status:
        typeof payload.transaction_status === "string"
          ? payload.transaction_status.slice(0, 50)
          : null,
      status_code: (payload.status_code as string).slice(0, 10),
      signature_valid: signatureValid,
      payload: storedPayload as never,
      processing_result: signatureValid ? null : "invalid_signature",
      processed_at: signatureValid ? null : new Date().toISOString(),
    })
    .select("id")
    .single();
  if (logError || !logged) {
    log("error", "payment.notification.log_failed", {
      midtransOrderId,
      code: logError?.code,
    });
    return json(500, { ok: false, error: "log_failed" });
  }

  if (!signatureValid) {
    log("warn", "payment.notification.invalid_signature", { midtransOrderId });
    return json(401, { ok: false, error: "invalid_signature" });
  }

  const finish = (result: string, error?: string) =>
    admin
      .from("payment_notifications")
      .update({
        processing_result: result,
        processed_at: new Date().toISOString(),
        error: error ? error.slice(0, 1000) : null,
      })
      .eq("id", logged.id);

  try {
    const outcome = await syncAndApply(midtransOrderId);
    const result = outcome.kind === "not_found" ? "not_found" : outcome.result;
    await finish(result);
    return json(200, { ok: true, result });
  } catch (error) {
    const message = (error as Error).message;
    log("error", "payment.notification.processing_failed", {
      midtransOrderId,
      error: message,
    });
    await finish("error", message);
    // Transient (Status API or database): let Midtrans retry.
    return json(500, { ok: false, error: "processing_failed" });
  }
}
