import {
  ArrowUpRight,
  BriefcaseBusiness,
  CheckCircle2,
  Lock,
  ShoppingBag,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { UserAvatar } from "@/components/profile/user-avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { VerificationBadge } from "@/components/verification/verification-badge";
import { getCapabilities } from "@/lib/capabilities";
import { createClient } from "@/lib/supabase/server";
import { getVerificationStatus, requireOnboarded } from "@/server/auth";

export const metadata: Metadata = { title: "Dasbor" };

function Capability({
  allowed,
  children,
}: {
  allowed: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-2 text-sm">
      {allowed ? (
        <CheckCircle2 className="text-primary size-4 shrink-0" />
      ) : (
        <Lock className="text-muted-foreground size-4 shrink-0" />
      )}
      <span className={allowed ? "" : "text-muted-foreground"}>{children}</span>
    </li>
  );
}

export default async function DashboardPage() {
  const viewer = await requireOnboarded("/dashboard");
  const status = await getVerificationStatus();
  const state = status?.state ?? "unverified";
  const caps = getCapabilities({
    onboarded: viewer.onboarded,
    verificationState: state,
    isSuspended: status?.isSuspended ?? false,
    isAdmin: viewer.isAdmin,
  });
  const { profile } = viewer;
  const supabase = await createClient();
  const [{ count: clientOrders }, { count: freelancerOrders }, { count: pendingActions }] =
    await Promise.all([
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("client_id", viewer.user.id)
        .in("status", ["awaiting_payment", "delivered", "disputed"]),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("freelancer_id", viewer.user.id)
        .in("status", ["in_progress", "disputed"]),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("client_id", viewer.user.id)
        .eq("status", "delivered"),
    ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <UserAvatar
          path={profile.avatar_path}
          name={profile.full_name}
          username={profile.username}
          className="size-14"
        />
        <div className="min-w-0">
          <p className="text-primary text-sm font-bold tracking-widest uppercase">
            Ruang kerja Anda
          </p>
          <h1 className="mt-1 truncate text-3xl font-extrabold tracking-tight">
            Halo, {profile.full_name}
          </h1>
          <Link
            href={`/u/${profile.username}`}
            className="text-muted-foreground text-sm hover:underline"
          >
            @{profile.username} · lihat profil publik
          </Link>
        </div>

        <section aria-label="Ringkasan aktivitas" className="grid gap-3 sm:grid-cols-3">
          <Link href="/dashboard/orders" className="bg-card rounded-2xl border p-4 transition-shadow hover:shadow-sm">
            <p className="text-muted-foreground text-sm">Pesanan klien perlu perhatian</p>
            <p className="mt-1 text-2xl font-bold">{clientOrders ?? 0}</p>
            <p className="text-muted-foreground mt-1 text-xs">
              Pembayaran, pengiriman, atau sengketa
            </p>
          </Link>
          <Link href="/dashboard/orders?role=freelancer" className="bg-card rounded-2xl border p-4 transition-shadow hover:shadow-sm">
            <p className="text-muted-foreground text-sm">Pekerjaan aktif</p>
            <p className="mt-1 text-2xl font-bold">{freelancerOrders ?? 0}</p>
            <p className="text-muted-foreground mt-1 text-xs">
              Dikerjakan atau dalam sengketa
            </p>
          </Link>
          <Link href="/dashboard/orders?status=delivered" className="border-primary/30 bg-primary/5 rounded-2xl border p-4 transition-shadow hover:shadow-sm">
            <p className="text-primary text-sm font-semibold">Notifikasi penting</p>
            <p className="mt-1 text-2xl font-bold">{pendingActions ?? 0}</p>
            <p className="text-muted-foreground mt-1 text-xs">
              Hasil kerja menunggu konfirmasi
            </p>
          </Link>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader>
            <ShoppingBag className="text-primary size-5" />
            <CardTitle className="text-lg">Sebagai klien</CardTitle>
            <CardDescription>
              Setiap akun dapat memesan jasa dan memposting pekerjaan.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <ul className="space-y-2">
              <Capability allowed={caps.canOrderServices}>
                Memesan jasa mahasiswa
              </Capability>
              <Capability allowed={caps.canPostJobs}>
                Memposting pekerjaan dan menerima proposal
              </Capability>
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/dashboard/jobs/new">Posting pekerjaan</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/services">
                  Jelajahi jasa <ArrowUpRight className="ml-2 size-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <BriefcaseBusiness className="text-primary size-5" />
            <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
              Sebagai freelancer <VerificationBadge state={state} />
            </CardTitle>
            <CardDescription>
              Hanya mahasiswa terverifikasi yang dapat menawarkan jasa dan
              mengirim proposal.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <ul className="space-y-2">
              <Capability allowed={caps.canPublishServices}>
                Mempublikasikan jasa
              </Capability>
              <Capability allowed={caps.canSubmitProposals}>
                Mengirim proposal ke pekerjaan
              </Capability>
            </ul>
            {status?.isSuspended ? (
              <p className="text-destructive text-sm">
                Akun freelancer Anda sedang ditangguhkan. Hubungi admin
                Projekin.
              </p>
            ) : null}
            {caps.canPublishServices ? (
              <Button variant="outline" asChild>
                <Link href="/dashboard/freelancer">
                  Kelola profil freelancer
                </Link>
              </Button>
            ) : (
              <Button asChild>
                <Link href="/dashboard/verification">
                  {state === "pending"
                    ? "Lihat status verifikasi"
                    : "Verifikasi sebagai mahasiswa"}
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {caps.canReviewVerifications ? (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg">Admin</CardTitle>
            <CardDescription>
              Tinjau pengajuan verifikasi mahasiswa.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild>
              <Link href="/admin/verifications">Buka antrean verifikasi</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
