import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/server/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FreelancerModerationForm,
  ServiceModerationForm,
} from "@/components/admin/moderation-forms";

export default async function ModerationPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: freelancers }, { data: services }] = await Promise.all([
    supabase
      .from("freelancer_profiles")
      .select(
        "user_id,status,verified_until,profile:profiles!freelancer_profiles_user_id_fkey(username,full_name)",
      )
      .order("updated_at", { ascending: false })
      .limit(100),
    supabase
      .from("services")
      .select("id,title,status,blocked_at,blocked_reason,freelancer_id")
      .order("updated_at", { ascending: false })
      .limit(100),
  ]);
  return (
    <div className="space-y-6">
      <div>
        <p className="text-primary text-sm font-bold tracking-widest uppercase">
          Admin
        </p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight">
          Moderasi marketplace
        </h1>
        <p className="text-muted-foreground mt-2">
          Kelola status freelancer dan visibilitas layanan.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Freelancer</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {freelancers?.map((item) => (
              <div
                key={item.user_id}
                className="flex flex-wrap items-center justify-between gap-4 py-4"
              >
                <div>
                  <p className="font-semibold">
                    {item.profile?.full_name ?? item.profile?.username}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    @{item.profile?.username} · {item.status}
                  </p>
                </div>
                <FreelancerModerationForm
                  userId={item.user_id}
                  suspended={item.status === "suspended"}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Layanan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {services?.map((item) => (
              <div key={item.id} className="space-y-3 py-4">
                <div>
                  <p className="font-semibold">{item.title}</p>
                  <p className="text-muted-foreground text-sm">
                    {item.status}
                    {item.blocked_at ? " · diblokir" : ""}
                  </p>
                </div>
                <ServiceModerationForm
                  serviceId={item.id}
                  blocked={Boolean(item.blocked_at)}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
