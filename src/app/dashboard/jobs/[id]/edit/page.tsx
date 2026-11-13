import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JobForm } from "@/components/jobs/job-forms";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/common";
import { todayJakarta } from "@/lib/validation/job";
import { messageFor } from "@/server/error-messages";
import { requireOnboarded } from "@/server/auth";

export const metadata: Metadata = { title: "Ubah lowongan" };

export default async function EditJobPage({
  params,
}: PageProps<"/dashboard/jobs/[id]/edit">) {
  const { id } = await params;
  const { user } = await requireOnboarded(`/dashboard/jobs/${id}/edit`);
  if (!uuidSchema.safeParse(id).success) notFound();

  const supabase = await createClient();
  const [{ data: job }, { data: categories }] = await Promise.all([
    supabase
      .from("jobs")
      .select(
        "id, client_id, category_id, title, description, requirements, budget_min, budget_max, deadline, status, proposals(count)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("categories").select("id, name").order("sort_order"),
  ]);
  if (!job || job.client_id !== user.id) notFound();
  const editable =
    job.status === "open" && (job.proposals[0]?.count ?? 0) === 0;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold tracking-tight">Ubah lowongan</h1>
      {editable ? (
        <Card className="rounded-2xl">
          <CardContent className="pt-6">
            <JobForm
              categories={categories ?? []}
              minDate={todayJakarta()}
              defaults={{
                id: job.id,
                categoryId: job.category_id,
                title: job.title,
                description: job.description,
                requirements: job.requirements ?? "",
                budgetMin: String(job.budget_min),
                budgetMax: String(job.budget_max),
                deadline: job.deadline ?? "",
              }}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <p className="text-muted-foreground">
            {messageFor("INVALID_STATE", "JOB_NOT_EDITABLE")}
          </p>
          <Link
            href={`/dashboard/jobs/${job.id}` as Route}
            className="text-primary font-semibold hover:underline"
          >
            Kembali ke lowongan
          </Link>
        </div>
      )}
    </div>
  );
}
