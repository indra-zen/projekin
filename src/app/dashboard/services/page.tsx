import Link from "next/link";
import type { Route } from "next";
import { Plus } from "lucide-react";
import { requireOnboarded } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
import { formatIdr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ServiceActions } from "@/components/services/service-actions";

export default async function ManageServicesPage() {
  const viewer = await requireOnboarded("/dashboard/services");
  const supabase = await createClient();
  const { data: services, error } = await supabase
    .from("services")
    .select("id,title,status,price,delivery_days,cover_image_path")
    .eq("freelancer_id", viewer.user.id)
    .order("created_at", { ascending: false });
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-3xl font-extrabold tracking-tight">Layanan saya</h1><p className="text-muted-foreground mt-2">Kelola layanan yang Anda tawarkan di marketplace.</p></div>
        <Button asChild><Link href={"/dashboard/services/new" as Route}><Plus className="mr-2 size-4" />Buat layanan</Link></Button>
      </div>
      {error ? <Card><CardContent className="py-12 text-center">Layanan gagal dimuat. Coba lagi nanti.</CardContent></Card> : services && services.length > 0 ? (
        <div className="grid gap-4">{services.map((service) => <Card key={service.id} className="rounded-2xl"><CardHeader className="flex-row items-start justify-between"><div><CardTitle>{service.title}</CardTitle><p className="text-muted-foreground mt-2 text-sm">{formatIdr(service.price)} · {service.delivery_days} hari</p></div><span className="bg-secondary text-secondary-foreground rounded-full px-3 py-1 text-xs font-semibold">{service.status}</span></CardHeader><CardContent className="flex flex-wrap items-center justify-between gap-3"><Button asChild size="sm" variant="outline"><Link href={`/dashboard/services/${service.id}/edit` as Route}>Edit</Link></Button><ServiceActions id={service.id} status={service.status} /></CardContent></Card>)}</div>
      ) : <Card className="rounded-2xl"><CardContent className="py-16 text-center"><h2 className="text-xl font-bold">Belum ada layanan</h2><p className="text-muted-foreground mt-2">Buat layanan pertama Anda untuk mulai ditemukan klien.</p><Button asChild className="mt-5"><Link href={"/dashboard/services/new" as Route}>Buat layanan</Link></Button></CardContent></Card>}
    </div>
  );
}
