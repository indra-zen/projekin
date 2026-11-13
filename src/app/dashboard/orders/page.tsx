import type { Metadata, Route } from "next";
import Link from "next/link";
import { StatusBadge } from "@/components/jobs/status-badge";
import { formatDate, formatIdr, formatOrderCode } from "@/lib/format";
import { orderStatusLabels } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { requireOnboarded } from "@/server/auth";

export const metadata: Metadata = { title: "Pesanan" };

export default async function OrdersPage({
  searchParams,
}: PageProps<"/dashboard/orders">) {
  const { user } = await requireOnboarded("/dashboard/orders");
  const role =
    (await searchParams).role === "freelancer" ? "freelancer" : "client";
  const supabase = await createClient();
  const { data: orders } = await supabase
    .from("orders")
    .select(
      "id, order_number, title, amount, freelancer_earnings, status, created_at",
    )
    .eq(role === "client" ? "client_id" : "freelancer_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const tabs = [
    {
      key: "client",
      label: "Pembelian (sebagai klien)",
      href: "/dashboard/orders",
    },
    {
      key: "freelancer",
      label: "Penjualan (sebagai freelancer)",
      href: "/dashboard/orders?role=freelancer",
    },
  ] as const;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold tracking-tight">Pesanan</h1>
      <div className="flex flex-wrap gap-2" role="tablist">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href as Route}
            role="tab"
            aria-selected={role === tab.key}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-medium",
              role === tab.key
                ? "bg-secondary text-secondary-foreground border-primary/30"
                : "hover:bg-muted",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>
      {orders && orders.length > 0 ? (
        <ul className="bg-card divide-y rounded-2xl border">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                href={`/dashboard/orders/${order.id}` as Route}
                className="hover:bg-muted/40 flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">
                    {order.title}
                  </span>
                  <span className="text-muted-foreground block text-sm">
                    {formatOrderCode(order.order_number)} ·{" "}
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
        <div className="bg-muted/40 rounded-3xl border border-dashed py-16 text-center">
          <h2 className="text-xl font-bold">Belum ada pesanan</h2>
          <p className="text-muted-foreground mt-2">
            {role === "client"
              ? "Pesanan muncul setelah Anda merekrut freelancer."
              : "Pesanan muncul setelah proposal Anda diterima."}
          </p>
        </div>
      )}
    </div>
  );
}
