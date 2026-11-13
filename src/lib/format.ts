const TIME_ZONE = "Asia/Jakarta";

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "long",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("id-ID", {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(value: string | Date): string {
  return dateFormatter.format(new Date(value));
}

export function formatDateTime(value: string | Date): string {
  return dateTimeFormatter.format(new Date(value));
}

export function formatIdr(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

/** YYYY-MM-DD for <input type="date">, `months` from `from`, in Asia/Jakarta. */
export function isoDateInMonths(
  months: number,
  from: Date = new Date(),
): string {
  const d = new Date(from);
  d.setUTCMonth(d.getUTCMonth() + months);
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(d);
}

/** Human-readable order code, e.g. PJK-000123. */
export function formatOrderCode(orderNumber: number): string {
  return `PJK-${String(orderNumber).padStart(6, "0")}`;
}

export function formatBudgetRange(min: number, max: number): string {
  return min === max ? formatIdr(min) : `${formatIdr(min)} – ${formatIdr(max)}`;
}

/** Payment can start until 5 minutes before the deadline (create_payment_attempt). */
export function paymentWindowOpen(
  paymentDueAt: string,
  now: Date = new Date(),
): boolean {
  return now.getTime() < new Date(paymentDueAt).getTime() - 5 * 60_000;
}
