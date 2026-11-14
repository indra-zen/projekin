import type { Metadata, Route } from "next";
import Link from "next/link";
import { Wallet } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/jobs/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate, formatIdr, formatOrderCode } from "@/lib/format";
import { payoutStatusLabels } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

const tileColours = ["bg-highlight", "bg-success", "bg-secondary"] as const;
import { requireOnboarded } from "@/server/auth";

export const metadata: Metadata = { title: "Pendapatan" };

/** FR-EARN-01: completed sales with fee, earnings and payout status. */
export default async function EarningsPage() {
  const { user } = await requireOnboarded("/dashboard/earnings");
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select(
      "id, order_number, title, amount, platform_fee, freelancer_earnings, payout_status, completed_at",
    )
    .eq("freelancer_id", user.id)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(500);
  const orders = data ?? [];
  const sum = (status: "pending" | "paid") =>
    orders
      .filter((o) => o.payout_status === status)
      .reduce((total, o) => total + o.freelancer_earnings, 0);

  const totals = [
    { label: "Menunggu pencairan", value: sum("pending") },
    { label: "Sudah dicairkan", value: sum("paid") },
    {
      label: "Total pendapatan",
      value: orders.reduce((total, o) => total + o.freelancer_earnings, 0),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Pendapatan</h1>
        <p className="text-muted-foreground mt-2">
          Pendapatan dari pesanan yang selesai, setelah biaya platform 10%.
          Admin mencairkan dana secara manual di luar platform.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {totals.map((t, i) => (
          <div
            key={t.label}
            className={cn(
              "border-border shadow-hard rounded-2xl border-2 p-4",
              tileColours[i % tileColours.length],
            )}
          >
            <p className="text-sm font-bold">{t.label}</p>
            <p className="font-display mt-1 text-2xl font-extrabold tabular-nums">
              {formatIdr(t.value)}
            </p>
          </div>
        ))}
      </div>

      {orders.length > 0 ? (
        <Card>
          <CardContent>
            <ul className="divide-hairline divide-y text-sm">
              {orders.map((o) => (
                <li
                  key={o.id}
                  className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/dashboard/orders/${o.id}` as Route}
                      className="font-bold break-words underline-offset-4 hover:underline"
                    >
                      {formatOrderCode(o.order_number)} · {o.title}
                    </Link>
                    <p className="text-muted-foreground">
                      {formatIdr(o.amount)} − biaya {formatIdr(o.platform_fee)}
                      {o.completed_at
                        ? ` · selesai ${formatDate(o.completed_at)}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-start gap-1.5 sm:items-end">
                    <p className="font-display text-lg font-extrabold">
                      {formatIdr(o.freelancer_earnings)}
                    </p>
                    <StatusBadge
                      status={o.payout_status}
                      label={payoutStatusLabels[o.payout_status]}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          icon={Wallet}
          title="Belum ada pendapatan"
          description="Pendapatan muncul di sini setelah klien menyelesaikan pesanan Anda."
        />
      )}
    </div>
  );
}
