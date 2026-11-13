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
  cancelled: "Pesanan dibatalkan",
};

type Tone = "neutral" | "positive" | "warning" | "negative";

export function toneFor(status: string): Tone {
  if (
    ["open", "accepted", "completed", "filled", "in_progress"].includes(status)
  )
    return "positive";
  if (["hiring", "submitted", "awaiting_payment", "delivered"].includes(status))
    return "warning";
  if (["rejected", "cancelled", "disputed"].includes(status)) return "negative";
  return "neutral";
}
