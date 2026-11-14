import { ArrowLeft, Pencil } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CloseJobForm, ProposalDecision } from "@/components/jobs/job-forms";
import { StatusBadge } from "@/components/jobs/status-badge";
import { UserAvatar } from "@/components/profile/user-avatar";
import { RatingSummary } from "@/components/reviews/review-display";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VerifiedStudentBadge } from "@/components/verification/verification-badge";
import { isVerifiedStudent } from "@/lib/capabilities";
import {
  formatBudgetRange,
  formatDate,
  formatIdr,
  formatOrderCode,
} from "@/lib/format";
import {
  jobStatusLabels,
  orderStatusLabels,
  proposalReasonLabels,
  proposalStatusLabels,
} from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/common";
import { requireOnboarded } from "@/server/auth";

export const metadata: Metadata = { title: "Kelola lowongan" };

export default async function ManageJobPage({
  params,
}: PageProps<"/dashboard/jobs/[id]">) {
  const { id } = await params;
  const { user } = await requireOnboarded(`/dashboard/jobs/${id}`);
  if (!uuidSchema.safeParse(id).success) notFound();

  const supabase = await createClient();
  const { data: job } = await supabase
    .from("jobs")
    .select(
      "id, client_id, title, description, requirements, budget_min, budget_max, deadline, status, closed_reason, created_at, category:categories(name)",
    )
    .eq("id", id)
    .maybeSingle();
  // Owner-only page: other users get a 404 (the RPCs enforce ownership too).
  if (!job || job.client_id !== user.id) notFound();

  const [{ data: proposals }, { data: orders }] = await Promise.all([
    supabase
      .from("proposals")
      .select(
        "id, freelancer_id, cover_letter, price, delivery_days, revisions_included, status, status_reason, created_at, freelancer:freelancer_profiles(headline, status, verified_until, university:universities(short_name, name), profile:profiles(username, full_name, avatar_path))",
      )
      .eq("job_id", job.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("orders")
      .select("id, order_number, status")
      .eq("job_id", job.id)
      .neq("status", "cancelled")
      .limit(1),
  ]);
  const liveOrder = orders?.[0];
  const editable = job.status === "open" && (proposals?.length ?? 0) === 0;
  // FR-PROP-03: each freelancer's rating next to their proposal.
  const freelancerIds = [
    ...new Set((proposals ?? []).map((p) => p.freelancer_id)),
  ];
  const { data: ratings } =
    freelancerIds.length > 0
      ? await supabase
          .from("freelancer_rating_stats")
          .select("user_id, rating_avg, rating_count")
          .in("user_id", freelancerIds)
      : { data: [] };
  const ratingByFreelancer = new Map(
    (ratings ?? []).map((r) => [r.user_id, r] as const),
  );

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/jobs"
        className="text-muted-foreground inline-flex items-center gap-1 text-sm hover:underline"
      >
        <ArrowLeft className="size-4" /> Lowongan saya
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-primary text-xs font-bold tracking-widest uppercase">
              {job.category?.name}
            </span>
            <StatusBadge
              status={job.status}
              label={jobStatusLabels[job.status]}
            />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight break-words">
            {job.title}
          </h1>
          <p className="text-muted-foreground text-sm">
            {formatBudgetRange(job.budget_min, job.budget_max)} · diposting{" "}
            {formatDate(job.created_at)}
            {job.deadline ? ` · tenggat ${formatDate(job.deadline)}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/jobs/${job.id}` as Route}>Lihat halaman publik</Link>
          </Button>
          {editable ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/dashboard/jobs/${job.id}/edit` as Route}>
                <Pencil className="mr-2 size-4" /> Ubah
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      {liveOrder ? (
        <Card className="border-primary/30 rounded-2xl">
          <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm">
              Pesanan <strong>{formatOrderCode(liveOrder.order_number)}</strong>
              : {orderStatusLabels[liveOrder.status]}
            </p>
            <Button size="sm" asChild>
              <Link href={`/dashboard/orders/${liveOrder.id}` as Route}>
                Buka pesanan
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {job.status === "open" ? (
        <div className="flex flex-wrap items-start gap-3">
          <CloseJobForm jobId={job.id} />
          {!editable ? (
            <p className="text-muted-foreground max-w-md text-xs">
              Lowongan yang sudah menerima proposal tidak dapat diubah. Tutup
              lowongan lalu buat yang baru jika perlu perubahan.
            </p>
          ) : null}
        </div>
      ) : null}
      {job.status === "closed" && job.closed_reason ? (
        <p className="text-muted-foreground text-sm">
          Alasan penutupan: {job.closed_reason}
        </p>
      ) : null}

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">
            Proposal ({proposals?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {proposals && proposals.length > 0 ? (
            <ul className="space-y-4">
              {proposals.map((p) => {
                const profile = p.freelancer?.profile;
                const name =
                  profile?.full_name ??
                  (profile ? `@${profile.username}` : "Freelancer");
                const overBudget =
                  p.price < job.budget_min || p.price > job.budget_max;
                return (
                  <li key={p.id} className="rounded-2xl border p-4 sm:p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        {profile ? (
                          <UserAvatar
                            path={profile.avatar_path}
                            name={profile.full_name}
                            username={profile.username}
                          />
                        ) : null}
                        <div className="min-w-0">
                          {profile ? (
                            <Link
                              href={`/u/${profile.username}` as Route}
                              className="block truncate font-semibold hover:underline"
                            >
                              {name}
                            </Link>
                          ) : null}
                          {p.freelancer?.headline ? (
                            <p className="text-muted-foreground truncate text-xs">
                              {p.freelancer.headline}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <StatusBadge
                        status={p.status}
                        label={proposalStatusLabels[p.status]}
                        className="self-start"
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {isVerifiedStudent(p.freelancer) ? (
                        <VerifiedStudentBadge
                          university={
                            p.freelancer?.university?.short_name ??
                            p.freelancer?.university?.name
                          }
                        />
                      ) : null}
                      <RatingSummary
                        avg={
                          ratingByFreelancer.get(p.freelancer_id)?.rating_avg ??
                          null
                        }
                        count={
                          ratingByFreelancer.get(p.freelancer_id)
                            ?.rating_count ?? null
                        }
                      />
                    </div>
                    <p className="mt-3 text-sm">
                      <strong>{formatIdr(p.price)}</strong> · {p.delivery_days}{" "}
                      hari · {p.revisions_included} revisi
                      {overBudget ? (
                        <span className="ml-2 text-xs text-amber-700">
                          (di luar anggaran)
                        </span>
                      ) : null}
                    </p>
                    <p className="text-muted-foreground mt-3 text-sm leading-6 whitespace-pre-wrap">
                      {p.cover_letter}
                    </p>
                    {p.status_reason && p.status !== "submitted" ? (
                      <p className="text-muted-foreground mt-2 text-xs">
                        Keterangan:{" "}
                        {proposalReasonLabels[p.status_reason] ??
                          p.status_reason}
                      </p>
                    ) : null}
                    {p.status === "submitted" && job.status === "open" ? (
                      <div className="mt-4">
                        <ProposalDecision
                          proposalId={p.id}
                          freelancerName={name}
                        />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">
              Belum ada proposal masuk.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
