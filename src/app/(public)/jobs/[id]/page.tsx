import { ArrowLeft, CalendarDays } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ProposalForm } from "@/components/jobs/job-forms";
import { StatusBadge } from "@/components/jobs/status-badge";
import { UserAvatar } from "@/components/profile/user-avatar";
import { RatingSummary } from "@/components/reviews/review-display";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBudgetRange, formatDate, formatIdr } from "@/lib/format";
import {
  jobStatusLabels,
  proposalReasonLabels,
  proposalStatusLabels,
} from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/common";
import { getVerificationStatus, getViewer } from "@/server/auth";

const loadJob = cache(async (id: string) => {
  if (!uuidSchema.safeParse(id).success) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("jobs")
    .select(
      "id, client_id, title, description, requirements, budget_min, budget_max, deadline, status, created_at, category:categories(name), client:profiles!jobs_client_id_fkey(username, full_name, avatar_path, location)",
    )
    .eq("id", id)
    .maybeSingle();
  return data;
});

export async function generateMetadata({
  params,
}: PageProps<"/jobs/[id]">): Promise<Metadata> {
  const job = await loadJob((await params).id);
  return { title: job?.title ?? "Lowongan tidak ditemukan" };
}

async function ProposalPanel({
  job,
}: {
  job: NonNullable<Awaited<ReturnType<typeof loadJob>>>;
}) {
  const viewer = await getViewer();
  const budgetHint = `Anggaran klien: ${formatBudgetRange(job.budget_min, job.budget_max)}`;

  if (!viewer) {
    return (
      <div className="space-y-3 text-sm">
        <p>Masuk sebagai mahasiswa terverifikasi untuk mengirim proposal.</p>
        <Button asChild>
          <Link
            href={
              `/login?next=${encodeURIComponent(`/jobs/${job.id}`)}` as Route
            }
          >
            Masuk
          </Link>
        </Button>
      </div>
    );
  }
  if (viewer.user.id === job.client_id) {
    return (
      <div className="space-y-3 text-sm">
        <p>Ini lowongan Anda.</p>
        <Button variant="outline" asChild>
          <Link href={`/dashboard/jobs/${job.id}` as Route}>
            Kelola lowongan &amp; proposal
          </Link>
        </Button>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: mine } = await supabase
    .from("proposals")
    .select("id, status, status_reason, price, delivery_days, created_at")
    .eq("job_id", job.id)
    .eq("freelancer_id", viewer.user.id)
    .maybeSingle();
  if (mine) {
    return (
      <div className="space-y-2 text-sm">
        <p className="flex flex-wrap items-center gap-2">
          Proposal Anda:{" "}
          <StatusBadge
            status={mine.status}
            label={proposalStatusLabels[mine.status]}
          />
        </p>
        <p className="text-muted-foreground">
          {formatIdr(mine.price)} · {mine.delivery_days} hari · dikirim{" "}
          {formatDate(mine.created_at)}
        </p>
        {mine.status_reason ? (
          <p className="text-muted-foreground">
            Keterangan:{" "}
            {proposalReasonLabels[mine.status_reason] ?? mine.status_reason}
          </p>
        ) : null}
        <Link
          href="/dashboard/proposals"
          className="text-primary font-semibold hover:underline"
        >
          Lihat semua proposal saya
        </Link>
      </div>
    );
  }
  if (job.status !== "open") {
    return (
      <p className="text-muted-foreground text-sm">
        Lowongan ini sudah tidak menerima proposal.
      </p>
    );
  }
  if (!viewer.onboarded) {
    return (
      <Button asChild>
        <Link href="/onboarding">Lengkapi profil terlebih dahulu</Link>
      </Button>
    );
  }
  const status = await getVerificationStatus();
  if (status?.state !== "verified" || status.isSuspended) {
    return (
      <div className="space-y-3 text-sm">
        <p>Hanya mahasiswa terverifikasi yang dapat mengirim proposal.</p>
        <Button asChild>
          <Link href="/dashboard/verification">
            Verifikasi sebagai mahasiswa
          </Link>
        </Button>
      </div>
    );
  }
  return <ProposalForm jobId={job.id} budgetHint={budgetHint} />;
}

export default async function JobDetailPage({
  params,
}: PageProps<"/jobs/[id]">) {
  const job = await loadJob((await params).id);
  if (!job) notFound();
  // FR-REV-02: freelancers see the client's rating before proposing.
  const supabase = await createClient();
  const { data: clientStats } = await supabase
    .from("client_rating_stats")
    .select("rating_avg, rating_count")
    .eq("user_id", job.client_id)
    .maybeSingle();

  return (
    <div className="container max-w-5xl py-10 md:py-14">
      <Link
        href="/jobs"
        className="text-muted-foreground inline-flex items-center gap-1 text-sm hover:underline"
      >
        <ArrowLeft className="size-4" /> Semua lowongan
      </Link>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {job.category?.name ? (
                <span className="sticker bg-highlight">
                  {job.category.name}
                </span>
              ) : null}
              {job.status !== "open" ? (
                <StatusBadge
                  status={job.status}
                  label={jobStatusLabels[job.status]}
                />
              ) : null}
            </div>
            <h1 className="text-3xl leading-tight font-extrabold tracking-tight text-balance break-words md:text-4xl">
              {job.title}
            </h1>
            <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <span>Diposting {formatDate(job.created_at)}</span>
              {job.deadline ? (
                <span className="sticker bg-secondary">
                  <CalendarDays className="size-3.5" aria-hidden /> Tenggat{" "}
                  {formatDate(job.deadline)}
                </span>
              ) : null}
            </div>
          </div>
          <section className="bg-card border-border shadow-ledge rounded-2xl border-2 p-6">
            <h2 className="text-xl font-extrabold">Deskripsi</h2>
            <p className="mt-3 leading-7 whitespace-pre-wrap">
              {job.description}
            </p>
            {job.requirements ? (
              <>
                <h2 className="border-hairline mt-6 border-t pt-6 text-xl font-extrabold">
                  Persyaratan
                </h2>
                <p className="mt-3 leading-7 whitespace-pre-wrap">
                  {job.requirements}
                </p>
              </>
            ) : null}
          </section>
          <Card className="[--ledge:var(--primary)]">
            <CardHeader>
              <CardTitle className="text-lg">Kirim proposal</CardTitle>
            </CardHeader>
            <CardContent>
              <ProposalPanel job={job} />
            </CardContent>
          </Card>
        </div>
        {/* Budget and client first on small screens: freelancers decide on those. */}
        <aside className="order-first space-y-4 lg:order-none">
          <div className="bg-success border-border shadow-hard rounded-2xl border-2 p-5">
            <p className="text-xs font-extrabold tracking-widest uppercase">
              Anggaran
            </p>
            <p className="font-display mt-2 text-2xl leading-tight font-extrabold">
              {formatBudgetRange(job.budget_min, job.budget_max)}
            </p>
          </div>
          {job.client ? (
            <div className="bg-card border-border shadow-ledge rounded-2xl border-2 p-5 [--ledge:var(--accent)]">
              <p className="text-xs font-extrabold tracking-widest uppercase">
                Klien
              </p>
              <Link
                href={`/u/${job.client.username}` as Route}
                className="mt-3 flex items-center gap-3 hover:underline"
              >
                <UserAvatar
                  path={job.client.avatar_path}
                  name={job.client.full_name}
                  username={job.client.username}
                />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">
                    {job.client.full_name ?? `@${job.client.username}`}
                  </span>
                  {job.client.location ? (
                    <span className="text-muted-foreground block truncate text-xs">
                      {job.client.location}
                    </span>
                  ) : null}
                </span>
              </Link>
              <RatingSummary
                avg={clientStats?.rating_avg ?? null}
                count={clientStats?.rating_count ?? null}
                className="mt-3"
              />
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
