import type { Enums } from "@/types/database";
import { uuidSchema } from "./common";
import { z } from "./zod";

export const orderIdSchema = z.object({ orderId: uuidSchema });

/** FR-ORD-01: the client's requirements for a service order. */
export const serviceOrderSchema = z.object({
  serviceId: uuidSchema,
  requirements: z
    .string()
    .trim()
    .min(10, { error: "Kebutuhan minimal 10 karakter." })
    .max(5000, { error: "Kebutuhan maksimal 5.000 karakter." }),
});

export const cancelOrderSchema = z.object({
  orderId: uuidSchema,
  reason: z
    .string()
    .trim()
    .min(1, { error: "Alasan pembatalan wajib diisi." })
    .max(500, { error: "Alasan maksimal 500 karakter." }),
});

export const deliverOrderSchema = z.object({
  orderId: uuidSchema,
  message: z
    .string()
    .trim()
    .min(1, { error: "Pesan pengiriman wajib diisi." })
    .max(5000, { error: "Pesan maksimal 5.000 karakter." }),
});

export const ORDER_STATUSES = [
  "awaiting_payment",
  "in_progress",
  "delivered",
  "completed",
  "cancelled",
  "disputed",
] as const satisfies readonly Enums<"order_status">[];

/** /dashboard/orders search params (API_CONTRACT §5.1). Invalid values fall back to defaults. */
const ordersFilterShape = z.object({
  role: z.enum(["client", "freelancer"]).catch("client"),
  status: z.enum(ORDER_STATUSES).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(500).catch(1),
});

export type OrdersFilter = z.infer<typeof ordersFilterShape>;

export function parseOrdersFilter(
  params: Record<string, string | string[] | undefined>,
): OrdersFilter {
  const pick = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };
  return ordersFilterShape.parse({
    role: pick("role") ?? "client",
    status: pick("status") || undefined,
    page: pick("page") ?? 1,
  });
}
