import type { Metadata } from "next";
import { UniversityDomainsForm } from "@/components/admin/university-domains-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/server/auth";

export const metadata: Metadata = { title: "Admin · Kampus" };

/** Student email domains per university (FR-VER-02: instant verification). */
export default async function AdminUniversitiesPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data: universities } = await supabase
    .from("universities")
    .select("id, name, short_name, email_domains, is_active")
    .order("name");

  return (
    <div className="space-y-6">
      <div>
        <span className="eyebrow">Admin</span>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight">Kampus</h1>
        <p className="text-muted-foreground mt-2">
          Mahasiswa yang email akunnya memakai domain di bawah ini langsung
          terverifikasi tanpa unggah KTM.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {universities?.map((u) => (
          <Card key={u.id}>
            <CardHeader>
              <CardTitle className="text-lg">
                {u.name}
                {u.is_active ? "" : " (nonaktif)"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <UniversityDomainsForm
                universityId={u.id}
                domains={u.email_domains}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
