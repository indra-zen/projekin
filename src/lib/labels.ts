import type { Enums } from "@/types/database";

export const jobStatusLabels: Record<Enums<"job_status">, string> = {
  open: "Dibuka",
  hiring: "Menunggu pembayaran",
  filled: "Terisi",
  closed: "Ditutup",
};

export const proposalStatusLabels: Record<Enums<"proposal_status">, string> = {
  submitted: "Menunggu keputusan",
  accepted: "Diterima",
  rejected: "Ditolak",
  withdrawn: "Ditarik",
};

export const orderStatusLabels: Record<Enums<"order_status">, string> = {
  awaiting_payment: "Menunggu pembayaran",
  in_progress: "Dikerjakan",
  delivered: "Dikirim",
  completed: "Selesai",
  cancelled: "Dibatalkan",
  disputed: "Dalam sengketa",
};

/** System reasons stored in proposals.status_reason, shown in Indonesian. */
export const proposalReasonLabels: Record<string, string> = {
  job_closed: "Lowongan ditutup",
  job_filled: "Freelancer lain terpilih",
  hire_cancelled: "Perekrutan dibatalkan sebelum pembayaran",
  rejected_by_client: "Ditolak oleh klien",
};

export const orderEventLabels: Record<string, string> = {
  created: "Pesanan dibuat",
  payment_attempt_created: "Pembayaran dimulai",
  payment_paid: "Pembayaran diterima, pesanan mulai dikerjakan",
  payment_failed: "Percobaan pembayaran gagal",
  payment_expired: "Percobaan pembayaran kedaluwarsa",
  payment_cancelled: "Percobaan pembayaran dibatalkan",
  late_payment_detected:
    "Pembayaran masuk setelah pesanan dibatalkan (dana dikembalikan oleh admin)",
  duplicate_payment_detected:
    "Pembayaran ganda terdeteksi (kelebihan dana dikembalikan oleh admin)",
  payment_refunded_by_provider: "Pembayaran dikembalikan oleh Midtrans",
  delivered: "Hasil kerja dikirim",
  revision_requested: "Revisi diminta",
  completed: "Pesanan diselesaikan oleh klien",
  auto_completed: "Pesanan selesai otomatis",
  cancelled: "Pesanan dibatalkan",
  dispute_opened: "Sengketa dibuka",
  dispute_resolved: "Sengketa diselesaikan",
  refund_marked: "Pengembalian dana dicatat",
  payout_marked: "Pencairan dana dicatat",
};

export const paymentStatusLabels: Record<Enums<"payment_status">, string> = {
  initiated: "Disiapkan",
  pending: "Menunggu pembayaran",
  paid: "Dibayar",
  failed: "Gagal",
  expired: "Kedaluwarsa",
  cancelled: "Dibatalkan",
  refunded: "Dikembalikan",
};

export const refundStatusLabels: Record<Enums<"refund_status">, string> = {
  none: "",
  pending: "Pengembalian dana sedang diproses admin",
  refunded: "Dana sudah dikembalikan",
};

export const payoutStatusLabels: Record<Enums<"payout_status">, string> = {
  none: "Belum ada",
  pending: "Menunggu pencairan oleh admin",
  paid: "Sudah dicairkan",
};

/** Midtrans `payment_type` values shown to users. */
export function paymentTypeLabel(type: string | null): string {
  if (!type) return "—";
  const labels: Record<string, string> = {
    qris: "QRIS",
    gopay: "GoPay",
    shopeepay: "ShopeePay",
    bank_transfer: "Virtual Account",
    echannel: "Mandiri Bill",
    credit_card: "Kartu kredit",
  };
  return labels[type] ?? type;
}

/** System cancellation reasons stored in orders.cancellation_reason. */
export const cancellationReasonLabels: Record<string, string> = {
  payment_window_expired: "Batas waktu pembayaran (24 jam) terlewati",
  dispute_refund: "Sengketa diputuskan admin: dana dikembalikan ke klien",
};

export const serviceStatusLabels: Record<Enums<"service_status">, string> = {
  draft: "Draf",
  published: "Dipublikasikan",
  paused: "Dijeda",
  archived: "Diarsipkan",
};

export const freelancerStatusLabels: Record<
  Enums<"freelancer_status">,
  string
> = {
  active: "Aktif",
  suspended: "Ditangguhkan",
};

export const disputeResolutionLabels: Record<string, string> = {
  release_to_freelancer: "Dana diteruskan ke freelancer",
  refund_client: "Dana dikembalikan ke klien",
};

type Tone = "neutral" | "positive" | "warning" | "negative";

export function toneFor(status: string): Tone {
  if (
    ["open", "accepted", "completed", "filled", "in_progress", "paid"].includes(
      status,
    )
  )
    return "positive";
  if (
    [
      "hiring",
      "submitted",
      "awaiting_payment",
      "delivered",
      "pending",
      "initiated",
    ].includes(status)
  )
    return "warning";
  if (
    ["rejected", "cancelled", "disputed", "failed", "expired"].includes(status)
  )
    return "negative";
  return "neutral";
}
