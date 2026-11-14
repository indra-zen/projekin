import type { Metadata, Route } from "next";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/jobs/status-badge";
import { Pagination } from "@/components/pagination";
import { formatDate, formatIdr, formatOrderCode } from "@/lib/format";
import { orderStatusLabels } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import {
  ORDER_STATUSES,
  parseOrdersFilter,
  type OrdersFilter,
} from "@/lib/validation/order";
import { requireOnboarded } from "@/server/auth";

export const metadata: Metadata = { title: "Pesanan" };

const PAGE_SIZE = 20;

function ordersHref(filter: Partial<OrdersFilter>): Route {
  const params = new URLSearchParams();
  if (filter.role === "freelancer") params.set("role", "freelancer");
  if (filter.status) params.set("status", filter.status);
  if (filter.page && filter.page > 1) params.set("page", String(filter.page));
  const query = params.toString();
  return (query ? `/dashboard/orders?${query}` : "/dashboard/orders") as Route;
}

export default async function OrdersPage({
  searchParams,
}: PageProps<"/dashboard/orders">) {
  const { user } = await requireOnboarded("/dashboard/orders");
  const filter = parseOrdersFilter(await searchParams);
  const { role, status, page } = filter;

  const supabase = await createClient();
  let query = supabase
    .from("orders")
    .select(
      "id, order_number, title, amount, freelancer_earnings, status, source, created_at, payment_due_at",
      { count: "exact" },
    )
    .eq(role === "client" ? "client_id" : "freelancer_id", user.id);
  if (status) query = query.eq("status", status);
  const { data: orders, count } = await query
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  const tabs = [
    { key: "client", label: "Pembelian (sebagai klien)" },
    { key: "freelancer", label: "Penjualan (sebagai freelancer)" },
  ] as const;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold tracking-tight">Pesanan</h1>
      <div className="flex flex-wrap gap-2" role="tablist">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={ordersHref({ role: tab.key })}
            role="tab"
            aria-selected={role === tab.key}
            className={cn(
              "border-border rounded-xl border-2 px-4 py-2 text-sm font-bold transition-colors",
              role === tab.key
                ? "bg-primary text-primary-foreground shadow-hard-sm"
                : "bg-card hover:bg-highlight/60",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>
      <nav aria-label="Filter status" className="flex flex-wrap gap-1.5">
        {[undefined, ...ORDER_STATUSES].map((value) => (
          <Link
            key={value ?? "all"}
            href={ordersHref({ role, status: value })}
            aria-current={status === value ? "page" : undefined}
            className={cn(
              "rounded-full border-2 px-3 py-1.5 text-xs font-bold transition-colors",
              status === value
                ? "bg-highlight border-border shadow-hard-sm"
                : "bg-muted hover:border-border border-transparent",
            )}
          >
            {value ? orderStatusLabels[value] : "Semua"}
          </Link>
        ))}
      </nav>
      {orders && orders.length > 0 ? (
        <ul className="bg-card divide-hairline shadow-ledge divide-y rounded-2xl border-2">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                href={`/dashboard/orders/${order.id}` as Route}
                className="hover:bg-highlight/30 flex flex-col gap-2 p-4 transition-colors sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="min-w-0">
                  <span className="block truncate font-bold">
                    {order.title}
                  </span>
                  <span className="text-muted-foreground block text-sm">
                    {formatOrderCode(order.order_number)} ·{" "}
                    {order.source === "service" ? "Layanan" : "Lowongan"} ·{" "}
                    {formatIdr(
                      role === "client"
                        ? order.amount
                        : order.freelancer_earnings,
                    )}{" "}
                    · {formatDate(order.created_at)}
                  </span>
                </span>
                <StatusBadge
                  status={order.status}
                  label={orderStatusLabels[order.status]}
                  className="self-start sm:self-center"
                />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={ClipboardList}
          title="Belum ada pesanan"
          description={
            status
              ? "Tidak ada pesanan dengan status ini."
              : role === "client"
                ? "Pesanan muncul setelah Anda memesan layanan atau merekrut freelancer."
                : "Pesanan muncul setelah layanan Anda dipesan atau proposal Anda diterima."
          }
        />
      )}
      <Pagination
        page={page}
        totalPages={totalPages}
        prevHref={page > 1 ? ordersHref({ ...filter, page: page - 1 }) : null}
        nextHref={
          page < totalPages ? ordersHref({ ...filter, page: page + 1 }) : null
        }
      />
    </div>
  );
}
