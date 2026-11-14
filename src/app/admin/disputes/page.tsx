import type { Metadata, Route } from "next";
import Link from "next/link";
import { ResolveDisputeForm } from "@/components/admin/money-forms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, formatIdr, formatOrderCode } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/server/auth";

export const metadata: Metadata = { title: "Admin · Sengketa" };

const columns =
  "id, order_id, reason, status, resolution, admin_note, created_at, resolved_at, opener:profiles!disputes_opened_by_fkey(username, full_name), order:orders(order_number, title, amount, client_id, client:profiles!orders_client_id_fkey(username, full_name), freelancer:freelancer_profiles(profile:profiles(username, full_name)))";

const resolutionLabels: Record<string, string> = {
  release_to_freelancer: "Dana diteruskan ke freelancer",
  refund_client: "Dana dikembalikan ke klien",
};

type Person = { username: string; full_name: string | null } | null;
const name = (p: Person) => p?.full_name ?? (p ? `@${p.username}` : "–");

/** FR-ADM-04 (BR-21): open disputes first, then the latest decisions. */
export default async function AdminDisputesPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: open }, { data: resolved }] = await Promise.all([
    supabase
      .from("disputes")
      .select(columns)
      .eq("status", "open")
      .order("created_at", { ascending: true })
      .limit(100),
    supabase
      .from("disputes")
      .select(columns)
      .eq("status", "resolved")
      .order("resolved_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <span className="eyebrow">Admin</span>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight">
          Sengketa pesanan
        </h1>
        <p className="text-muted-foreground mt-2">
          Baca pesan, hasil kerja, dan lampiran di halaman pesanan sebelum
          memutuskan.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Menunggu keputusan ({open?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {open && open.length > 0 ? (
            <ul className="divide-hairline divide-y">
              {open.map((d) => (
                <li key={d.id} className="grid gap-4 py-5 lg:grid-cols-2">
                  <div className="min-w-0 space-y-2 text-sm">
                    <Link
                      href={`/dashboard/orders/${d.order_id}` as Route}
                      className="text-primary font-bold underline-offset-4 hover:underline"
                    >
                      {d.order
                        ? formatOrderCode(d.order.order_number)
                        : "Pesanan"}{" "}
                      · {d.order?.title}
                    </Link>
                    <p className="text-muted-foreground">
                      Klien {name(d.order?.client ?? null)} · Freelancer{" "}
                      {name(d.order?.freelancer?.profile ?? null)} ·{" "}
                      {formatIdr(d.order?.amount ?? 0)}
                    </p>
                    <p className="text-muted-foreground">
                      Dibuka oleh {name(d.opener)} ·{" "}
                      {formatDateTime(d.created_at)}
                    </p>
                    <p className="bg-muted border-border rounded-xl border-2 p-3 break-words whitespace-pre-wrap">
                      {d.reason}
                    </p>
                  </div>
                  <ResolveDisputeForm disputeId={d.id} orderId={d.order_id} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">
              Tidak ada sengketa yang menunggu keputusan.
            </p>
          )}
        </CardContent>
      </Card>

      {resolved && resolved.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Keputusan terbaru</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-hairline divide-y text-sm">
              {resolved.map((d) => (
                <li key={d.id} className="space-y-1 py-3">
                  <Link
                    href={`/dashboard/orders/${d.order_id}` as Route}
                    className="font-bold underline-offset-4 hover:underline"
                  >
                    {d.order
                      ? formatOrderCode(d.order.order_number)
                      : "Pesanan"}{" "}
                    · {d.order?.title}
                  </Link>
                  <p className="text-muted-foreground">
                    {resolutionLabels[d.resolution ?? ""] ?? d.resolution} ·{" "}
                    {d.resolved_at ? formatDateTime(d.resolved_at) : ""}
                  </p>
                  <p className="break-words whitespace-pre-wrap">
                    {d.admin_note}
                  </p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
