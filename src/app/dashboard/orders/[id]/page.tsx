import { ArrowLeft, CheckCircle2, Clock, PackageCheck } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CancelOrderForm,
  CompleteOrderForm,
  DeliverOrderForm,
} from "@/components/orders/order-forms";
import { PaymentPanel } from "@/components/orders/payment-panel";
import { StatusBadge } from "@/components/jobs/status-badge";
import { UserAvatar } from "@/components/profile/user-avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { env } from "@/lib/env";
import {
  formatDateTime,
  formatIdr,
  formatOrderCode,
  paymentWindowOpen,
} from "@/lib/format";
import {
  cancellationReasonLabels,
  orderEventLabels,
  orderStatusLabels,
  paymentStatusLabels,
  paymentTypeLabel,
  payoutStatusLabels,
  refundStatusLabels,
} from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/common";
import { requireOnboarded } from "@/server/auth";

export const metadata: Metadata = { title: "Detail pesanan" };

export default async function OrderDetailPage({
  params,
  searchParams,
}: PageProps<"/dashboard/orders/[id]">) {
  const { id } = await params;
  const returnedFromPayment = (await searchParams).payment === "finish";
  const viewer = await requireOnboarded(`/dashboard/orders/${id}`);
  if (!uuidSchema.safeParse(id).success) notFound();

  const supabase = await createClient();
  // RLS: only the two parties (and admins) can read the order.
  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, order_number, source, job_id, service_id, title, brief, requirements, amount, platform_fee, freelancer_earnings, delivery_days, revisions_allowed, status, payment_due_at, paid_at, due_at, delivered_at, completed_at, cancelled_at, cancelled_by, cancellation_reason, payout_status, created_at, client_id, freelancer_id, client:profiles!orders_client_id_fkey(username, full_name, avatar_path), freelancer:freelancer_profiles(profile:profiles(username, full_name, avatar_path))",
    )
    .eq("id", id)
    .maybeSingle();
  if (!order) notFound();

  const [{ data: events }, { data: deliveries }, { data: payments }] =
    await Promise.all([
      supabase
        .from("order_events")
        .select("id, event_type, created_at")
        .eq("order_id", order.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("order_deliveries")
        .select("id, delivery_number, message, created_at")
        .eq("order_id", order.id)
        .order("delivery_number", { ascending: false }),
      // RLS: the client and admins see payments; the freelancer gets none.
      supabase
        .from("payments")
        .select(
          "id, attempt_no, midtrans_order_id, status, payment_type, gross_amount, paid_at, created_at, refund_status",
        )
        .eq("order_id", order.id)
        .order("attempt_no", { ascending: false }),
    ]);

  const isClient = viewer.user.id === order.client_id;
  const isFreelancer = viewer.user.id === order.freelancer_id;
  const counterpart = isClient ? order.freelancer?.profile : order.client;
  const attempts = payments ?? [];
  const liveAttempt = attempts.find(
    (p) => p.status === "initiated" || p.status === "pending",
  );
  const refundPending = attempts.some((p) => p.refund_status === "pending");
  const deliveryList = deliveries ?? [];
  const latestDelivery = deliveryList[0];

  const awaitingPayment = order.status === "awaiting_payment";
  const canCancel =
    (awaitingPayment && (isClient || isFreelancer || viewer.isAdmin)) ||
    (order.status === "in_progress" &&
      isFreelancer &&
      deliveryList.length === 0);

  return (
    <div className="space-y-6">
      <Link
        href={
          (isFreelancer
            ? "/dashboard/orders?role=freelancer"
            : "/dashboard/orders") as Route
        }
        className="text-muted-foreground inline-flex items-center gap-1 text-sm hover:underline"
      >
        <ArrowLeft className="size-4" /> Pesanan
      </Link>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-sm font-semibold">
            {formatOrderCode(order.order_number)}
          </span>
          <StatusBadge
            status={order.status}
            label={orderStatusLabels[order.status]}
          />
          <span className="text-muted-foreground text-xs">
            {order.source === "service" ? "Pesanan layanan" : "Dari lowongan"}
          </span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight break-words">
          {order.title}
        </h1>
        {order.job_id ? (
          <Link
            href={`/jobs/${order.job_id}` as Route}
            className="text-primary text-sm font-semibold hover:underline"
          >
            Lihat lowongan asal
          </Link>
        ) : order.service_id ? (
          <Link
            href={`/services/${order.service_id}` as Route}
            className="text-primary text-sm font-semibold hover:underline"
          >
            Lihat layanan
          </Link>
        ) : null}
      </div>

      {awaitingPayment ? (
        <Card className="rounded-2xl border-amber-200 bg-amber-50/60">
          <CardContent className="space-y-4 pt-6 text-sm">
            <p className="flex items-center gap-2 font-semibold text-amber-900">
              <Clock className="size-4" /> Menunggu pembayaran hingga{" "}
              {formatDateTime(order.payment_due_at)}
            </p>
            {isClient ? (
              <PaymentPanel
                orderId={order.id}
                clientKey={env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY ?? null}
                canPay={paymentWindowOpen(order.payment_due_at)}
                resume={liveAttempt?.status === "pending"}
                hasAttempt={attempts.length > 0}
                autoSync={
                  returnedFromPayment || liveAttempt?.status === "pending"
                }
              />
            ) : (
              <p className="text-amber-900/80">
                Klien belum membayar. Jangan mulai bekerja sebelum status
                pesanan berubah menjadi &quot;Dikerjakan&quot;. Pesanan batal
                otomatis jika tidak dibayar sampai batas waktu.
              </p>
            )}
            {canCancel ? <CancelOrderForm orderId={order.id} /> : null}
          </CardContent>
        </Card>
      ) : null}

      {order.status === "in_progress" ? (
        <Card className="rounded-2xl">
          <CardContent className="space-y-4 pt-6 text-sm">
            <p className="font-semibold">
              Sedang dikerjakan
              {order.due_at ? ` · tenggat ${formatDateTime(order.due_at)}` : ""}
            </p>
            {isFreelancer ? (
              <>
                <DeliverOrderForm orderId={order.id} />
                {canCancel ? (
                  <CancelOrderForm orderId={order.id} refundNotice />
                ) : null}
              </>
            ) : (
              <p className="text-muted-foreground">
                Pembayaran Anda sudah diterima. Freelancer akan mengirim hasil
                kerja di halaman ini.
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}

      {order.status === "delivered" ? (
        <Card className="border-primary/30 rounded-2xl">
          <CardContent className="space-y-4 pt-6 text-sm">
            <p className="flex items-center gap-2 font-semibold">
              <PackageCheck className="size-4" /> Hasil kerja sudah dikirim
              {order.delivered_at
                ? ` · ${formatDateTime(order.delivered_at)}`
                : ""}
            </p>
            {isClient ? (
              <CompleteOrderForm orderId={order.id} />
            ) : (
              <p className="text-muted-foreground">
                Menunggu klien mengonfirmasi bahwa pesanan selesai.
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}

      {order.status === "completed" ? (
        <Card className="rounded-2xl">
          <CardContent className="space-y-1 pt-6 text-sm">
            <p className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="text-primary size-4" /> Pesanan selesai
              {order.completed_at
                ? ` · ${formatDateTime(order.completed_at)}`
                : ""}
            </p>
            {!isClient ? (
              <p className="text-muted-foreground">
                Status pencairan: {payoutStatusLabels[order.payout_status]}.
                Dana dicairkan manual oleh admin (tanpa escrow).
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {order.status === "cancelled" ? (
        <Card className="rounded-2xl">
          <CardContent className="space-y-1 pt-6 text-sm">
            <p className="font-semibold">
              Dibatalkan
              {order.cancelled_at
                ? ` · ${formatDateTime(order.cancelled_at)}`
                : ""}
              {order.cancelled_by === null ? " (otomatis oleh sistem)" : ""}
            </p>
            {order.cancellation_reason ? (
              <p className="text-muted-foreground">
                Alasan:{" "}
                {cancellationReasonLabels[order.cancellation_reason] ??
                  order.cancellation_reason}
              </p>
            ) : null}
            {refundPending ? (
              <p className="font-medium text-amber-800">
                {refundStatusLabels.pending}.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {latestDelivery ? (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg">Hasil kerja</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-4 text-sm">
              {deliveryList.map((delivery) => (
                <li key={delivery.id} className="space-y-1">
                  <p className="text-muted-foreground text-xs">
                    Pengiriman #{delivery.delivery_number} ·{" "}
                    {formatDateTime(delivery.created_at)}
                  </p>
                  <p className="leading-6 whitespace-pre-wrap">
                    {delivery.message}
                  </p>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <Card className="min-w-0 rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg">Ringkasan pekerjaan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p className="leading-6 whitespace-pre-wrap">{order.brief}</p>
            {order.requirements ? (
              <div>
                <p className="font-semibold">
                  {order.source === "service"
                    ? "Kebutuhan klien"
                    : "Persyaratan"}
                </p>
                <p className="text-muted-foreground mt-1 leading-6 whitespace-pre-wrap">
                  {order.requirements}
                </p>
              </div>
            ) : null}
            <p className="text-muted-foreground">
              {order.delivery_days} hari pengerjaan setelah pembayaran ·{" "}
              {order.revisions_allowed} revisi
            </p>
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg">Biaya</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-[1fr_auto] gap-y-2 text-sm">
                <dt className="text-muted-foreground">Harga</dt>
                <dd className="font-semibold">{formatIdr(order.amount)}</dd>
                {!isClient ? (
                  <>
                    <dt className="text-muted-foreground">
                      Biaya platform (10%)
                    </dt>
                    <dd>−{formatIdr(order.platform_fee)}</dd>
                    <dt className="text-muted-foreground">Pendapatan Anda</dt>
                    <dd className="font-semibold">
                      {formatIdr(order.freelancer_earnings)}
                    </dd>
                  </>
                ) : null}
                {order.paid_at ? (
                  <>
                    <dt className="text-muted-foreground">Dibayar</dt>
                    <dd>{formatDateTime(order.paid_at)}</dd>
                  </>
                ) : null}
              </dl>
            </CardContent>
          </Card>
          {counterpart ? (
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-lg">
                  {isClient ? "Freelancer" : "Klien"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Link
                  href={`/u/${counterpart.username}` as Route}
                  className="flex items-center gap-3 hover:underline"
                >
                  <UserAvatar
                    path={counterpart.avatar_path}
                    name={counterpart.full_name}
                    username={counterpart.username}
                  />
                  <span className="truncate font-semibold">
                    {counterpart.full_name ?? `@${counterpart.username}`}
                  </span>
                </Link>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      {attempts.length > 0 ? (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg">Riwayat pembayaran</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-muted-foreground text-xs">
                <tr>
                  <th className="py-2 pr-3 font-medium">Percobaan</th>
                  <th className="py-2 pr-3 font-medium">ID Midtrans</th>
                  <th className="py-2 pr-3 font-medium">Metode</th>
                  <th className="py-2 pr-3 font-medium">Jumlah</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {attempts.map((p) => (
                  <tr key={p.id} className="align-top">
                    <td className="py-2 pr-3">
                      #{p.attempt_no}
                      <span className="text-muted-foreground block text-xs">
                        {formatDateTime(p.created_at)}
                      </span>
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">
                      {p.midtrans_order_id}
                    </td>
                    <td className="py-2 pr-3">
                      {paymentTypeLabel(p.payment_type)}
                    </td>
                    <td className="py-2 pr-3">{formatIdr(p.gross_amount)}</td>
                    <td className="py-2">
                      <StatusBadge
                        status={p.status}
                        label={paymentStatusLabels[p.status]}
                      />
                      {p.paid_at ? (
                        <span className="text-muted-foreground block text-xs">
                          {formatDateTime(p.paid_at)}
                        </span>
                      ) : null}
                      {p.refund_status !== "none" ? (
                        <span className="block text-xs font-medium text-amber-800">
                          {refundStatusLabels[p.refund_status]}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}

      {events && events.length > 0 ? (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg">Riwayat pesanan</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2 text-sm">
              {events.map((event) => (
                <li
                  key={event.id}
                  className="flex flex-col sm:flex-row sm:gap-3"
                >
                  <span className="text-muted-foreground shrink-0">
                    {formatDateTime(event.created_at)}
                  </span>
                  <span>
                    {orderEventLabels[event.event_type] ?? event.event_type}
                  </span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
