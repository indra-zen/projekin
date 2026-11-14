import { redirect } from "next/navigation";
import { ServiceForm } from "@/components/services/service-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { requireOnboarded, getVerificationStatus } from "@/server/auth";

export default async function NewServicePage() {
  await requireOnboarded("/dashboard/services/new");
  const status = await getVerificationStatus();
  if (status?.state !== "verified" || status.isSuspended)
    redirect("/dashboard/verification");
  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("categories")
    .select("id,name")
    .order("sort_order");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Buat layanan</h1>
        <p className="text-muted-foreground mt-2">
          Jelaskan keahlian yang dapat Anda bantu.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Detail layanan</CardTitle>
        </CardHeader>
        <CardContent>
          <ServiceForm
            categories={categories ?? []}
            defaults={{
              categoryId: "",
              title: "",
              description: "",
              price: "",
              deliveryDays: "7",
              revisionsIncluded: "1",
              requirementsPrompt: "",
              coverImagePath: null,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
