import type { Metadata, Route } from "next";
import Link from "next/link";
import { MarkPayoutForm } from "@/components/admin/money-forms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, formatIdr, formatOrderCode } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/server/auth";

export const metadata: Metadata = { title: "Admin · Pencairan" };

const freelancerColumns =
  "freelancer:freelancer_profiles(profile:profiles(username, full_name))";

/** FR-ADM-05 (BR-23): completed orders whose earnings are not yet paid out. */
export default async function AdminPayoutsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: pending }, { data: paid }] = await Promise.all([
    supabase
      .from("orders")
      .select(
        `id, order_number, title, amount, platform_fee, freelancer_earnings, completed_at, ${freelancerColumns}`,
      )
      .eq("payout_status", "pending")
      .order("completed_at", { ascending: true })
      .limit(100),
    supabase
      .from("orders")
      .select(
        `id, order_number, freelancer_earnings, payout_reference, payout_marked_at, ${freelancerColumns}`,
      )
      .eq("payout_status", "paid")
      .order("payout_marked_at", { ascending: false, nullsFirst: false })
      .limit(20),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <span className="eyebrow">Admin</span>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight">
          Pencairan freelancer
        </h1>
        <p className="text-muted-foreground mt-2">
          Transfer pendapatan freelancer di luar platform (data rekening
          disepakati langsung), lalu catat referensinya di sini.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Menunggu dibayar ({pending?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pending && pending.length > 0 ? (
            <ul className="divide-hairline divide-y">
              {pending.map((o) => (
                <li key={o.id} className="grid gap-4 py-5 lg:grid-cols-2">
                  <div className="min-w-0 space-y-1 text-sm">
                    <Link
                      href={`/dashboard/orders/${o.id}` as Route}
                      className="text-primary font-bold underline-offset-4 hover:underline"
                    >
                      {formatOrderCode(o.order_number)} · {o.title}
                    </Link>
                    <p>
                      Dibayarkan ke{" "}
                      <strong>
                        {o.freelancer?.profile?.full_name ??
                          `@${o.freelancer?.profile?.username ?? "-"}`}
                      </strong>
                      : <strong>{formatIdr(o.freelancer_earnings)}</strong>
                    </p>
                    <p className="text-muted-foreground">
                      Harga {formatIdr(o.amount)} − biaya platform{" "}
                      {formatIdr(o.platform_fee)} · selesai{" "}
                      {o.completed_at ? formatDateTime(o.completed_at) : "-"}
                    </p>
                  </div>
                  <MarkPayoutForm orderId={o.id} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">
              Tidak ada pencairan yang menunggu.
            </p>
          )}
        </CardContent>
      </Card>

      {paid && paid.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Sudah dibayar</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-hairline divide-y text-sm">
              {paid.map((o) => (
                <li
                  key={o.id}
                  className="flex flex-wrap justify-between gap-2 py-3"
                >
                  <span className="font-medium">
                    {formatOrderCode(o.order_number)} ·{" "}
                    {o.freelancer?.profile?.full_name ??
                      `@${o.freelancer?.profile?.username ?? "-"}`}{" "}
                    · {formatIdr(o.freelancer_earnings)}
                  </span>
                  <span className="text-muted-foreground break-all">
                    {o.payout_reference}
                    {o.payout_marked_at
                      ? ` · ${formatDateTime(o.payout_marked_at)}`
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
