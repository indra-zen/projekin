import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { log } from "@/server/log";
import { assertPaymentsConfigured } from "@/server/payments/config";
import { syncAndApply } from "@/server/payments/process-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BATCH = 100;
const MIN_AGE_MS = 10 * 60 * 1000;
const DELAY_MS = 200;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  const header = request.headers.get("authorization") ?? "";
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`, "utf8");
  const given = Buffer.from(header, "utf8");
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/**
 * Vercel Cron (API_CONTRACT §3.3, ARCHITECTURE §9.5): heals missed
 * notifications by syncing live attempts older than 10 minutes with the
 * Midtrans Status API, and fails `initiated` attempts that never got a token.
 */
export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }
  try {
    assertPaymentsConfigured();
  } catch (error) {
    log("error", "payment.not_configured", {
      reason: (error as Error).message,
    });
    return NextResponse.json(
      { ok: false, error: "not_configured" },
      { status: 500 },
    );
  }

  const admin = createAdminClient();
  const { data: attempts, error } = await admin
    .from("payments")
    .select("id, midtrans_order_id, status, snap_token")
    .in("status", ["initiated", "pending"])
    .lt("created_at", new Date(Date.now() - MIN_AGE_MS).toISOString())
    .order("last_synced_at", { ascending: true, nullsFirst: true })
    .limit(BATCH);
  if (error) {
    log("error", "cron.reconcile.query_failed", { code: error.code });
    return NextResponse.json(
      { ok: false, error: "query_failed" },
      { status: 500 },
    );
  }

  const summary = { checked: 0, applied: 0, failedStale: 0, errors: 0 };
  for (const attempt of attempts ?? []) {
    summary.checked += 1;
    try {
      if (attempt.status === "initiated" && !attempt.snap_token) {
        const { error: failError } = await admin.rpc("fail_payment_attempt", {
          p_payment_id: attempt.id,
          p_reason: "stale_initiated",
        });
        if (failError)
          throw new Error(`fail_payment_attempt ${failError.code}`);
        summary.failedStale += 1;
      } else {
        const outcome = await syncAndApply(attempt.midtrans_order_id);
        if (outcome.kind === "processed" && outcome.result === "applied") {
          summary.applied += 1;
        }
      }
    } catch (syncError) {
      summary.errors += 1;
      log("warn", "cron.reconcile.item_failed", {
        midtransOrderId: attempt.midtrans_order_id,
        error: (syncError as Error).message,
      });
    }
    await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
  }

  log("info", "cron.reconcile.summary", summary);
  return NextResponse.json({ ok: true, ...summary });
}
