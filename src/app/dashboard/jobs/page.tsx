import { Plus } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { StatusBadge } from "@/components/jobs/status-badge";
import { Button } from "@/components/ui/button";
import { formatBudgetRange, formatDate } from "@/lib/format";
import { jobStatusLabels } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { requireOnboarded } from "@/server/auth";

export const metadata: Metadata = { title: "Lowongan saya" };

export default async function MyJobsPage() {
  const { user } = await requireOnboarded("/dashboard/jobs");
  const supabase = await createClient();
  const { data: jobs } = await supabase
    .from("jobs")
    .select(
      "id, title, status, budget_min, budget_max, created_at, proposals(count)",
    )
    .eq("client_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Lowongan saya
          </h1>
          <p className="text-muted-foreground mt-2">
            Posting pekerjaan, tinjau proposal, dan rekrut freelancer mahasiswa.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/jobs/new">
            <Plus className="mr-2 size-4" /> Posting pekerjaan
          </Link>
        </Button>
      </div>
      {jobs && jobs.length > 0 ? (
        <ul className="bg-card divide-y rounded-2xl border">
          {jobs.map((job) => (
            <li key={job.id}>
              <Link
                href={`/dashboard/jobs/${job.id}` as Route}
                className="hover:bg-muted/40 flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">
                    {job.title}
                  </span>
                  <span className="text-muted-foreground block text-sm">
                    {formatBudgetRange(job.budget_min, job.budget_max)} ·{" "}
                    {formatDate(job.created_at)} ·{" "}
                    {job.proposals[0]?.count ?? 0} proposal
                  </span>
                </span>
                <StatusBadge
                  status={job.status}
                  label={jobStatusLabels[job.status]}
                  className="self-start sm:self-center"
                />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="bg-muted/40 rounded-3xl border border-dashed py-16 text-center">
          <h2 className="text-xl font-bold">Belum ada lowongan</h2>
          <p className="text-muted-foreground mt-2">
            Posting pekerjaan pertama Anda dan terima proposal dari mahasiswa
            terverifikasi.
          </p>
        </div>
      )}
    </div>
  );
}
