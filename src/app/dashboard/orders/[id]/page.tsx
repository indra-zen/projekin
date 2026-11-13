import { ArrowLeft, Clock } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CancelOrderForm } from "@/components/jobs/job-forms";
import { StatusBadge } from "@/components/jobs/status-badge";
import { UserAvatar } from "@/components/profile/user-avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, formatIdr, formatOrderCode } from "@/lib/format";
import { orderEventLabels, orderStatusLabels } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/common";
import { requireOnboarded } from "@/server/auth";

export const metadata: Metadata = { title: "Detail pesanan" };

export default async function OrderDetailPage({
  params,
}: PageProps<"/dashboard/orders/[id]">) {
  const { id } = await params;
  const viewer = await requireOnboarded(`/dashboard/orders/${id}`);
  if (!uuidSchema.safeParse(id).success) notFound();

  const supabase = await createClient();
  // RLS: only the two parties (and admins) can read the order.
  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, order_number, source, job_id, title, brief, requirements, amount, platform_fee, freelancer_earnings, delivery_days, revisions_allowed, status, payment_due_at, cancelled_at, cancellation_reason, created_at, client_id, freelancer_id, client:profiles!orders_client_id_fkey(username, full_name, avatar_path), freelancer:freelancer_profiles(profile:profiles(username, full_name, avatar_path))",
    )
    .eq("id", id)
    .maybeSingle();
  if (!order) notFound();

  const { data: events } = await supabase
    .from("order_events")
    .select("id, event_type, created_at, payload")
    .eq("order_id", order.id)
    .order("created_at", { ascending: true });

  const isClient = viewer.user.id === order.client_id;
  const isFreelancer = viewer.user.id === order.freelancer_id;
  const counterpart = isClient ? order.freelancer?.profile : order.client;
  const canCancel =
    order.status === "awaiting_payment" &&
    (isClient || isFreelancer || viewer.isAdmin);

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
        ) : null}
      </div>

      {order.status === "awaiting_payment" ? (
        <Card className="rounded-2xl border-amber-200 bg-amber-50/60">
          <CardContent className="space-y-3 pt-6 text-sm">
            <p className="flex items-center gap-2 font-semibold text-amber-900">
              <Clock className="size-4" /> Menunggu pembayaran hingga{" "}
              {formatDateTime(order.payment_due_at)}
            </p>
            <p className="text-amber-900/80">
              {isClient
                ? "Pembayaran melalui Midtrans akan tersedia pada tahap berikutnya. Freelancer mulai bekerja setelah pembayaran terkonfirmasi."
                : "Klien belum membayar. Jangan mulai bekerja sebelum pembayaran terkonfirmasi."}
            </p>
            {canCancel ? <CancelOrderForm orderId={order.id} /> : null}
          </CardContent>
        </Card>
      ) : null}
      {order.status === "cancelled" ? (
        <p className="text-muted-foreground text-sm">
          Dibatalkan{" "}
          {order.cancelled_at ? formatDateTime(order.cancelled_at) : ""}
          {order.cancellation_reason
            ? ` · Alasan: ${order.cancellation_reason}`
            : ""}
        </p>
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
                <p className="font-semibold">Persyaratan</p>
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

      {events && events.length > 0 ? (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg">Riwayat</CardTitle>
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
