import type { Metadata, Route } from "next";
import Link from "next/link";
import { StatusBadge } from "@/components/jobs/status-badge";
import { WithdrawProposalButton } from "@/components/jobs/withdraw-proposal-button";
import { Button } from "@/components/ui/button";
import { formatDate, formatIdr } from "@/lib/format";
import { proposalReasonLabels, proposalStatusLabels } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { requireOnboarded } from "@/server/auth";

export const metadata: Metadata = { title: "Proposal saya" };

export default async function MyProposalsPage() {
  const { user } = await requireOnboarded("/dashboard/proposals");
  const supabase = await createClient();
  const [{ data: proposals }, { data: orders }] = await Promise.all([
    supabase
      .from("proposals")
      .select(
        "id, job_id, price, delivery_days, status, status_reason, created_at, job:jobs(title, status)",
      )
      .eq("freelancer_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("orders")
      .select("id, proposal_id")
      .eq("freelancer_id", user.id)
      .neq("status", "cancelled"),
  ]);
  const orderByProposal = new Map(
    (orders ?? []).map((o) => [o.proposal_id, o.id]),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Proposal saya
          </h1>
          <p className="text-muted-foreground mt-2">
            Status proposal yang Anda kirim sebagai freelancer.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/jobs">Cari pekerjaan</Link>
        </Button>
      </div>
      {proposals && proposals.length > 0 ? (
        <ul className="bg-card divide-y rounded-2xl border">
          {proposals.map((p) => {
            const orderId = orderByProposal.get(p.id);
            return (
              <li key={p.id} className="flex flex-col gap-3 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <Link
                      href={`/jobs/${p.job_id}` as Route}
                      className="block truncate font-semibold hover:underline"
                    >
                      {p.job?.title ?? "Lowongan"}
                    </Link>
                    <p className="text-muted-foreground text-sm">
                      {formatIdr(p.price)} · {p.delivery_days} hari · dikirim{" "}
                      {formatDate(p.created_at)}
                    </p>
                    {p.status_reason && p.status !== "submitted" ? (
                      <p className="text-muted-foreground text-xs">
                        Keterangan:{" "}
                        {proposalReasonLabels[p.status_reason] ??
                          p.status_reason}
                      </p>
                    ) : null}
                  </div>
                  <StatusBadge
                    status={p.status}
                    label={proposalStatusLabels[p.status]}
                    className="self-start"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {p.status === "submitted" ? (
                    <WithdrawProposalButton proposalId={p.id} />
                  ) : null}
                  {orderId ? (
                    <Button size="sm" asChild>
                      <Link href={`/dashboard/orders/${orderId}` as Route}>
                        Buka pesanan
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="bg-muted/40 rounded-3xl border border-dashed py-16 text-center">
          <h2 className="text-xl font-bold">Belum ada proposal</h2>
          <p className="text-muted-foreground mt-2">
            Temukan lowongan yang sesuai dengan keahlian Anda.
          </p>
        </div>
      )}
    </div>
  );
}
