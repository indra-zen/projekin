import { notFound } from "next/navigation";
import { requireOnboarded } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PortfolioForm } from "@/components/portfolio/portfolio-form";

export default async function EditPortfolioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requireOnboarded("/dashboard/portfolio");
  const { id } = await params;
  const supabase = await createClient();
  const { data: item } = await supabase
    .from("portfolio_items")
    .select("id,title,description,external_url,image_paths,sort_order")
    .eq("id", id)
    .eq("freelancer_id", viewer.user.id)
    .maybeSingle();
  if (!item) notFound();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit karya portofolio</CardTitle>
      </CardHeader>
      <CardContent>
        <PortfolioForm
          defaults={{
            id: item.id,
            title: item.title,
            description: item.description ?? "",
            externalUrl: item.external_url ?? "",
            imagePaths: item.image_paths,
            sortOrder: String(item.sort_order),
          }}
        />
      </CardContent>
    </Card>
  );
}
