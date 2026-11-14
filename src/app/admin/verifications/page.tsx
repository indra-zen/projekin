import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/server/auth";

export const metadata: Metadata = { title: "Admin · Verifikasi mahasiswa" };

const statusLabels = {
  pending: "Menunggu",
  approved: "Disetujui",
  rejected: "Ditolak",
} as const;

const selectColumns =
  "id, status, method, created_at, reviewed_at, university:universities(name), profile:profiles!student_verifications_user_id_fkey(username, full_name)";

export default async function AdminVerificationsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: pending }, { data: recent }] = await Promise.all([
    supabase
      .from("student_verifications")
      .select(selectColumns)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(100),
    supabase
      .from("student_verifications")
      .select(selectColumns)
      .neq("status", "pending")
      .order("reviewed_at", { ascending: false, nullsFirst: false })
      .limit(20),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <span className="eyebrow">Admin</span>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight">
          Verifikasi mahasiswa
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Menunggu peninjauan ({pending?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pending && pending.length > 0 ? (
            <ul className="divide-hairline divide-y">
              {pending.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/admin/verifications/${item.id}`}
                    className="hover:bg-highlight/30 -mx-3 flex items-center justify-between gap-3 rounded-xl px-3 py-3 transition-colors"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-bold">
                        {item.profile?.full_name}{" "}
                        <span className="text-muted-foreground font-normal">
                          @{item.profile?.username}
                        </span>
                      </span>
                      <span className="text-muted-foreground block truncate text-sm">
                        {item.university?.name} · diajukan{" "}
                        {formatDateTime(item.created_at)}
                      </span>
                    </span>
                    <ChevronRight className="text-muted-foreground size-4 shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">
              Tidak ada pengajuan yang menunggu.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Keputusan terbaru</CardTitle>
        </CardHeader>
        <CardContent>
          {recent && recent.length > 0 ? (
            <ul className="divide-hairline divide-y text-sm">
              {recent.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <Link
                    href={`/admin/verifications/${item.id}`}
                    className="font-medium hover:underline"
                  >
                    {item.profile?.full_name} · {item.university?.name}
                  </Link>
                  <span className="text-muted-foreground">
                    {statusLabels[item.status]}
                    {item.method === "email_domain" ? " (otomatis, email)" : ""}
                    {item.reviewed_at
                      ? ` · ${formatDateTime(item.reviewed_at)}`
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">
              Belum ada keputusan.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
