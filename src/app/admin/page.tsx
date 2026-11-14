import type { Metadata, Route } from "next";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/server/auth";

export const metadata: Metadata = { title: "Admin" };

/** FR-ADM-03: the queues that need an admin, with their sizes. */
export default async function AdminOverviewPage() {
  await requireAdmin();
  const supabase = await createClient();
  const head = { count: "exact", head: true } as const;
  const [verifications, disputes, refunds, payouts] = await Promise.all([
    supabase
      .from("student_verifications")
      .select("id", head)
      .eq("status", "pending"),
    supabase.from("disputes").select("id", head).eq("status", "open"),
    supabase.from("payments").select("id", head).eq("refund_status", "pending"),
    supabase.from("orders").select("id", head).eq("payout_status", "pending"),
  ]);

  const queues: {
    href: Route;
    label: string;
    count: number | null;
    hint: string;
  }[] = [
    {
      href: "/admin/verifications",
      label: "Verifikasi mahasiswa",
      count: verifications.count,
      hint: "Dokumen KTM menunggu ditinjau",
    },
    {
      href: "/admin/disputes" as Route,
      label: "Sengketa terbuka",
      count: disputes.count,
      hint: "Pesanan menunggu keputusan admin",
    },
    {
      href: "/admin/refunds" as Route,
      label: "Pengembalian dana",
      count: refunds.count,
      hint: "Pembayaran yang harus dikembalikan ke klien",
    },
    {
      href: "/admin/payouts" as Route,
      label: "Pencairan freelancer",
      count: payouts.count,
      hint: "Pesanan selesai yang belum dibayarkan",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-primary text-sm font-bold tracking-widest uppercase">
          Admin
        </p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight">
          Ringkasan
        </h1>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {queues.map((queue) => (
          <Link key={queue.href} href={queue.href}>
            <Card className="hover:border-primary/50 rounded-2xl transition-colors">
              <CardContent>
                <p className="text-muted-foreground text-sm">{queue.label}</p>
                <p className="mt-1 text-4xl font-extrabold">
                  {queue.count ?? "–"}
                </p>
                <p className="text-muted-foreground mt-2 text-xs">
                  {queue.hint}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
