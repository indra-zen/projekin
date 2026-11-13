import "server-only";

import { getMidtransConfig } from "./config";
import type { SnapRequestBody } from "./snap-request";

/** A failed or unexpected Midtrans call. `reason` is safe to log and store. */
export class MidtransError extends Error {
  constructor(
    readonly reason: string,
    readonly httpStatus?: number,
  ) {
    super(`Midtrans: ${reason}`);
    this.name = "MidtransError";
  }
}

const TIMEOUT_MS = 10_000;

function headers(serverKey: string): HeadersInit {
  return {
    Authorization: `Basic ${Buffer.from(`${serverKey}:`).toString("base64")}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

async function request(
  url: string,
  init: { method: "GET" | "POST"; body?: string },
): Promise<{ status: number; body: Record<string, unknown> | null }> {
  const { serverKey } = getMidtransConfig();
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: headers(serverKey),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    const name = (error as Error).name;
    throw new MidtransError(
      name === "TimeoutError" || name === "AbortError" ? "timeout" : "network",
    );
  }
  let body: Record<string, unknown> | null = null;
  try {
    const parsed: unknown = await response.json();
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      body = parsed as Record<string, unknown>;
    }
  } catch {
    body = null;
  }
  return { status: response.status, body };
}

const str = (value: unknown): string | null =>
  typeof value === "string" ? value : null;

// ---------------------------------------------------------------------------
// Snap: create transaction (API_CONTRACT §6.1)
// ---------------------------------------------------------------------------

export async function createSnapTransaction(
  body: SnapRequestBody,
): Promise<{ token: string; redirectUrl: string }> {
  const { snapUrl } = getMidtransConfig();
  const res = await request(snapUrl, {
    method: "POST",
    body: JSON.stringify(body),
  });
  const token = str(res.body?.token);
  const redirectUrl = str(res.body?.redirect_url);
  if (res.status !== 201 || !token || !redirectUrl) {
    throw new MidtransError(`snap_${res.status}`, res.status);
  }
  return { token, redirectUrl };
}

// ---------------------------------------------------------------------------
// Core API: transaction status (API_CONTRACT §6.2)
// ---------------------------------------------------------------------------

export type TransactionStatus =
  | { found: false }
  | {
      found: true;
      orderId: string | null;
      transactionStatus: string;
      fraudStatus: string | null;
      statusCode: string | null;
      grossAmount: string | null;
      paymentType: string | null;
      transactionId: string | null;
    };

export async function getTransactionStatus(
  midtransOrderId: string,
): Promise<TransactionStatus> {
  const { apiBaseUrl } = getMidtransConfig();
  const res = await request(
    `${apiBaseUrl}/${encodeURIComponent(midtransOrderId)}/status`,
    { method: "GET" },
  );
  // "Transaction doesn't exist": the customer has not chosen a method yet.
  if (res.status === 404 || str(res.body?.status_code) === "404") {
    return { found: false };
  }
  const transactionStatus = str(res.body?.transaction_status);
  if (res.status < 200 || res.status >= 300 || !transactionStatus) {
    throw new MidtransError(
      `status_${str(res.body?.status_code) ?? res.status}`,
      res.status,
    );
  }
  const gross = res.body?.gross_amount;
  return {
    found: true,
    orderId: str(res.body?.order_id),
    transactionStatus,
    fraudStatus: str(res.body?.fraud_status),
    statusCode: str(res.body?.status_code),
    grossAmount: typeof gross === "number" ? String(gross) : str(gross),
    paymentType: str(res.body?.payment_type),
    transactionId: str(res.body?.transaction_id),
  };
}

// ---------------------------------------------------------------------------
// Core API: expire (API_CONTRACT §6.3). Best effort; never throws.
// ---------------------------------------------------------------------------

export async function expireTransaction(
  midtransOrderId: string,
): Promise<{ ok: boolean; statusCode: string | null }> {
  try {
    const { apiBaseUrl } = getMidtransConfig();
    const res = await request(
      `${apiBaseUrl}/${encodeURIComponent(midtransOrderId)}/expire`,
      { method: "POST" },
    );
    const statusCode = str(res.body?.status_code);
    return { ok: statusCode === "407" || statusCode === "200", statusCode };
  } catch (error) {
    return {
      ok: false,
      statusCode: error instanceof MidtransError ? error.reason : "error",
    };
  }
}
