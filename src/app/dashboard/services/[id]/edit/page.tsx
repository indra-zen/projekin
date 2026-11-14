import { notFound } from "next/navigation";
import { ServiceForm } from "@/components/services/service-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { requireOnboarded } from "@/server/auth";

export default async function EditServicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requireOnboarded("/dashboard/services");
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: service }, { data: categories }] = await Promise.all([
    supabase
      .from("services")
      .select(
        "id,category_id,title,description,price,delivery_days,revisions_included,requirements_prompt,cover_image_path,status",
      )
      .eq("id", id)
      .eq("freelancer_id", viewer.user.id)
      .maybeSingle(),
    supabase.from("categories").select("id,name").order("sort_order"),
  ]);
  if (!service || service.status === "archived") notFound();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Edit layanan</h1>
        <p className="text-muted-foreground mt-2">
          Perbarui detail layanan Anda.
        </p>
      </div>
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Detail layanan</CardTitle>
        </CardHeader>
        <CardContent>
          <ServiceForm
            categories={categories ?? []}
            defaults={{
              id: service.id,
              categoryId: service.category_id,
              title: service.title,
              description: service.description,
              price: String(service.price),
              deliveryDays: String(service.delivery_days),
              revisionsIncluded: String(service.revisions_included),
              requirementsPrompt: service.requirements_prompt ?? "",
              coverImagePath: service.cover_image_path,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
