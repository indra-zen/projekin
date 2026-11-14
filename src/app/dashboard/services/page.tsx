import Link from "next/link";
import type { Route } from "next";
import { Plus, Store } from "lucide-react";
import { requireOnboarded } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
import { formatIdr } from "@/lib/format";
import { serviceStatusLabels } from "@/lib/labels";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ServiceActions } from "@/components/services/service-actions";
import { ledgeAt } from "@/lib/ledge";
import { cn } from "@/lib/utils";

const statusTone: Record<string, string> = {
  published: "bg-success",
  paused: "bg-highlight",
  draft: "bg-muted",
  archived: "bg-muted",
};

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
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Layanan saya
          </h1>
          <p className="text-muted-foreground mt-2">
            Kelola layanan yang Anda tawarkan di marketplace.
          </p>
        </div>
        <Button asChild>
          <Link href={"/dashboard/services/new" as Route}>
            <Plus className="mr-2 size-4" />
            Buat layanan
          </Link>
        </Button>
      </div>
      {error ? (
        <EmptyState
          icon={Store}
          title="Layanan gagal dimuat"
          description="Coba lagi nanti."
        />
      ) : services && services.length > 0 ? (
        <div className="grid gap-y-8">
          {services.map((service, index) => (
            <Card key={service.id} className={ledgeAt(index)}>
              <CardHeader className="flex-row items-start justify-between">
                <div>
                  <CardTitle>{service.title}</CardTitle>
                  <p className="text-muted-foreground mt-2 text-sm">
                    <span className="font-display text-foreground text-lg font-extrabold">
                      {formatIdr(service.price)}
                    </span>{" "}
                    · {service.delivery_days} hari
                  </p>
                </div>
                <span
                  className={cn(
                    "sticker shrink-0 self-start",
                    statusTone[service.status] ?? "bg-muted",
                  )}
                >
                  {serviceStatusLabels[service.status]}
                </span>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center justify-between gap-3">
                <Button asChild size="sm" variant="outline">
                  <Link
                    href={`/dashboard/services/${service.id}/edit` as Route}
                  >
                    Edit
                  </Link>
                </Button>
                <ServiceActions id={service.id} status={service.status} />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Store}
          title="Belum ada layanan"
          description="Buat layanan pertama Anda untuk mulai ditemukan klien."
        >
          <Button asChild>
            <Link href={"/dashboard/services/new" as Route}>Buat layanan</Link>
          </Button>
        </EmptyState>
      )}
    </div>
  );
}
