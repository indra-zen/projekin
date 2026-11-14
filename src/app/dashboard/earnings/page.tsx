import type { Metadata, Route } from "next";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate, formatIdr, formatOrderCode } from "@/lib/format";
import { payoutStatusLabels } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
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
        {totals.map((t) => (
          <Card key={t.label} className="rounded-2xl">
            <CardContent>
              <p className="text-muted-foreground text-sm">{t.label}</p>
              <p className="mt-1 text-2xl font-extrabold">
                {formatIdr(t.value)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {orders.length > 0 ? (
        <Card className="rounded-2xl">
          <CardContent>
            <ul className="divide-y text-sm">
              {orders.map((o) => (
                <li
                  key={o.id}
                  className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/dashboard/orders/${o.id}` as Route}
                      className="font-semibold break-words hover:underline"
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
                  <div className="shrink-0 sm:text-right">
                    <p className="font-bold">
                      {formatIdr(o.freelancer_earnings)}
                    </p>
                    <p
                      className={cn(
                        "text-xs",
                        o.payout_status === "paid"
                          ? "text-emerald-700"
                          : "text-amber-700",
                      )}
                    >
                      {payoutStatusLabels[o.payout_status]}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : (
        <div className="bg-muted/40 rounded-3xl border border-dashed py-16 text-center">
          <h2 className="text-lg font-bold">Belum ada pendapatan</h2>
          <p className="text-muted-foreground mt-2 text-sm">
            Pendapatan muncul di sini setelah klien menyelesaikan pesanan Anda.
          </p>
        </div>
      )}
    </div>
  );
}
