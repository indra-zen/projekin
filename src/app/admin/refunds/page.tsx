import type { Metadata, Route } from "next";
import Link from "next/link";
import { MarkRefundForm } from "@/components/admin/money-forms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, formatIdr, formatOrderCode } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/server/auth";

export const metadata: Metadata = { title: "Admin · Pengembalian dana" };

/** FR-ADM-05 (BR-24): paid payments of cancelled orders, late or duplicate payments. */
export default async function AdminRefundsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: pending }, { data: done }] = await Promise.all([
    supabase
      .from("payments")
      .select(
        "id, order_id, midtrans_order_id, gross_amount, payment_type, paid_at, order:orders(order_number, title, status, client:profiles!orders_client_id_fkey(username, full_name))",
      )
      .eq("refund_status", "pending")
      .order("paid_at", { ascending: true })
      .limit(100),
    supabase
      .from("payments")
      .select(
        "id, order_id, gross_amount, refund_reference, refund_marked_at, order:orders(order_number, title)",
      )
      .eq("refund_status", "refunded")
      .order("refund_marked_at", { ascending: false, nullsFirst: false })
      .limit(20),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-primary text-sm font-bold tracking-widest uppercase">
          Admin
        </p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight">
          Pengembalian dana
        </h1>
        <p className="text-muted-foreground mt-2">
          Kembalikan dana lewat dasbor Midtrans (Sandbox) atau transfer manual,
          lalu catat referensinya di sini.
        </p>
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">
            Menunggu diproses ({pending?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pending && pending.length > 0 ? (
            <ul className="divide-y">
              {pending.map((p) => (
                <li key={p.id} className="grid gap-4 py-5 lg:grid-cols-2">
                  <div className="min-w-0 space-y-1 text-sm">
                    <Link
                      href={`/dashboard/orders/${p.order_id}` as Route}
                      className="text-primary font-semibold hover:underline"
                    >
                      {p.order
                        ? formatOrderCode(p.order.order_number)
                        : "Pesanan"}{" "}
                      · {p.order?.title}
                    </Link>
                    <p className="font-semibold">{formatIdr(p.gross_amount)}</p>
                    <p className="text-muted-foreground break-all">
                      Klien{" "}
                      {p.order?.client?.full_name ??
                        `@${p.order?.client?.username ?? "-"}`}{" "}
                      · Midtrans {p.midtrans_order_id} · {p.payment_type ?? "-"}
                    </p>
                    <p className="text-muted-foreground">
                      Dibayar {p.paid_at ? formatDateTime(p.paid_at) : "-"}
                    </p>
                  </div>
                  <MarkRefundForm paymentId={p.id} orderId={p.order_id} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">
              Tidak ada pengembalian dana yang menunggu.
            </p>
          )}
        </CardContent>
      </Card>

      {done && done.length > 0 ? (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg">Sudah dikembalikan</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {done.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap justify-between gap-2 py-3"
                >
                  <span className="font-medium">
                    {p.order ? formatOrderCode(p.order.order_number) : ""} ·{" "}
                    {formatIdr(p.gross_amount)}
                  </span>
                  <span className="text-muted-foreground break-all">
                    {p.refund_reference}
                    {p.refund_marked_at
                      ? ` · ${formatDateTime(p.refund_marked_at)}`
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
