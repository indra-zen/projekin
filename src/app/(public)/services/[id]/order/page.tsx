import { ArrowLeft, Clock } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ServiceOrderForm } from "@/components/orders/order-forms";
import { UserAvatar } from "@/components/profile/user-avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatIdr } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/common";
import { requireOnboarded } from "@/server/auth";

export const metadata: Metadata = { title: "Pesan layanan" };

export default async function OrderServicePage({
  params,
}: PageProps<"/services/[id]/order">) {
  const { id } = await params;
  const viewer = await requireOnboarded(`/services/${id}/order`);
  if (!uuidSchema.safeParse(id).success) notFound();

  const supabase = await createClient();
  // RLS: published services of eligible freelancers (or the viewer's own).
  const { data: service } = await supabase
    .from("services")
    .select(
      "id, title, price, delivery_days, revisions_included, requirements_prompt, status, blocked_at, freelancer_id, freelancer:freelancer_profiles(profile:profiles(username, full_name, avatar_path))",
    )
    .eq("id", id)
    .maybeSingle();
  if (!service) notFound();

  const own = service.freelancer_id === viewer.user.id;
  const orderable = service.status === "published" && !service.blocked_at;
  const profile = service.freelancer?.profile;

  return (
    <div className="container max-w-3xl space-y-6 py-10 md:py-14">
      <Link
        href={`/services/${service.id}` as Route}
        className="text-muted-foreground inline-flex items-center gap-1 text-sm hover:underline"
      >
        <ArrowLeft className="size-4" /> Kembali ke layanan
      </Link>
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">
          Pesan layanan
        </h1>
        <p className="text-muted-foreground mt-2 break-words">
          {service.title}
        </p>
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Ringkasan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {profile ? (
            <div className="flex items-center gap-3">
              <UserAvatar
                path={profile.avatar_path}
                name={profile.full_name}
                username={profile.username}
              />
              <span className="font-semibold">
                {profile.full_name ?? `@${profile.username}`}
              </span>
            </div>
          ) : null}
          <dl className="grid grid-cols-[1fr_auto] gap-y-2">
            <dt className="text-muted-foreground">Harga</dt>
            <dd className="text-lg font-extrabold">
              {formatIdr(service.price)}
            </dd>
            <dt className="text-muted-foreground">Pengerjaan</dt>
            <dd>{service.delivery_days} hari setelah pembayaran</dd>
            <dt className="text-muted-foreground">Revisi</dt>
            <dd>{service.revisions_included} kali</dd>
          </dl>
          <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-amber-900">
            <Clock className="mt-0.5 size-4 shrink-0" />
            Selesaikan pembayaran dalam 24 jam setelah pesanan dibuat. Pesanan
            yang tidak dibayar dibatalkan otomatis. Harga dihitung dari data
            layanan di server.
          </p>
        </CardContent>
      </Card>

      {own ? (
        <div className="bg-muted/40 rounded-2xl border border-dashed p-6 text-sm">
          Ini layanan Anda sendiri, jadi tidak dapat dipesan.
        </div>
      ) : !orderable ? (
        <div className="bg-muted/40 rounded-2xl border border-dashed p-6 text-sm">
          Layanan ini sedang tidak dapat dipesan.{" "}
          <Link
            href="/services"
            className="text-primary font-semibold hover:underline"
          >
            Cari layanan lain
          </Link>
        </div>
      ) : (
        <Card className="rounded-2xl">
          <CardContent>
            <ServiceOrderForm
              serviceId={service.id}
              prompt={service.requirements_prompt}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
