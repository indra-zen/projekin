import type { Metadata } from "next";
import { JobForm } from "@/components/jobs/job-forms";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { todayJakarta } from "@/lib/validation/job";
import { requireOnboarded } from "@/server/auth";

export const metadata: Metadata = { title: "Posting pekerjaan" };

export default async function NewJobPage() {
  await requireOnboarded("/dashboard/jobs/new");
  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name")
    .order("sort_order");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">
          Posting pekerjaan
        </h1>
        <p className="text-muted-foreground mt-2">
          Lowongan dapat diubah selama belum ada proposal masuk.
        </p>
      </div>
      <Card className="rounded-2xl">
        <CardContent>
          <JobForm
            categories={categories ?? []}
            minDate={todayJakarta()}
            defaults={{
              categoryId: "",
              title: "",
              description: "",
              requirements: "",
              budgetMin: "",
              budgetMax: "",
              deadline: "",
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
