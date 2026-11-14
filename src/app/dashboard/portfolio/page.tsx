import Link from "next/link";
import { requireOnboarded } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
import { Images } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { ledgeAt } from "@/lib/ledge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PortfolioForm } from "@/components/portfolio/portfolio-form";
import { DeletePortfolioButton } from "@/components/portfolio/delete-portfolio-button";
import type { Route } from "next";

export default async function PortfolioPage() {
  const viewer = await requireOnboarded("/dashboard/portfolio");
  const supabase = await createClient();
  const [{ data: freelancer }, { data: items }] = await Promise.all([
    supabase
      .from("freelancer_profiles")
      .select("user_id")
      .eq("user_id", viewer.user.id)
      .maybeSingle(),
    supabase
      .from("portfolio_items")
      .select("id,title,description,external_url,image_paths,sort_order")
      .eq("freelancer_id", viewer.user.id)
      .order("sort_order"),
  ]);
  if (!freelancer)
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-extrabold tracking-tight">Portofolio</h1>
        <EmptyState
          icon={Images}
          title="Profil freelancer belum tersedia"
          description="Selesaikan verifikasi mahasiswa terlebih dahulu."
        >
          <Button asChild>
            <Link href="/dashboard/verification">Verifikasi mahasiswa</Link>
          </Button>
        </EmptyState>
      </div>
    );
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Portofolio</h1>
          <p className="text-muted-foreground mt-2">
            Tampilkan karya terbaik Anda kepada calon klien.
          </p>
        </div>
        <Button asChild>
          <Link href={"/dashboard/portfolio/new" as Route}>Tambah karya</Link>
        </Button>
      </div>
      <Card className="[--ledge:var(--primary)]">
        <CardHeader>
          <CardTitle>Tambah karya</CardTitle>
        </CardHeader>
        <CardContent>
          <PortfolioForm
            defaults={{
              title: "",
              description: "",
              externalUrl: "",
              imagePaths: [],
              sortOrder: String(items?.length ?? 0),
            }}
          />
        </CardContent>
      </Card>
      <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2">
        {items?.map((item, index) => (
          <Card key={item.id} className={ledgeAt(index)}>
            <CardHeader>
              <CardTitle>{item.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-muted-foreground text-sm">
                {item.description || "Tanpa deskripsi"}
              </p>
              <div className="flex gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/dashboard/portfolio/${item.id}/edit` as Route}>
                    Edit
                  </Link>
                </Button>
                <DeletePortfolioButton id={item.id} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
