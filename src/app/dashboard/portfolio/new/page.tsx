import { requireOnboarded } from "@/server/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PortfolioForm } from "@/components/portfolio/portfolio-form";
export default async function NewPortfolioPage() {
  await requireOnboarded("/dashboard/portfolio/new");
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tambah karya portofolio</CardTitle>
      </CardHeader>
      <CardContent>
        <PortfolioForm
          defaults={{
            title: "",
            description: "",
            externalUrl: "",
            imagePaths: [],
            sortOrder: "0",
          }}
        />
      </CardContent>
    </Card>
  );
}
