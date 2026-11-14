import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UserAvatar } from "@/components/profile/user-avatar";
import { RatingSummary, ReviewList } from "@/components/reviews/review-display";
import { Button } from "@/components/ui/button";
import { env } from "@/lib/env";
import { formatIdr } from "@/lib/format";
import { publicObjectUrl, SERVICE_MEDIA_BUCKET } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/common";

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const supabase = await createClient();
  const { data: service } = await supabase
    .from("service_listings")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!service || !service.freelancer_id) notFound();

  // FR-SVC-06: rating summary and the latest reviews from this service's orders.
  const [{ data: portfolio }, { data: reviews }, { data: freelancerStats }] =
    await Promise.all([
      supabase
        .from("portfolio_items")
        .select("id,title,description,external_url,image_paths")
        .eq("freelancer_id", service.freelancer_id)
        .order("sort_order"),
      supabase
        .from("reviews")
        .select(
          "id, rating, comment, created_at, reviewer:profiles!reviews_reviewer_id_fkey(username, full_name)",
        )
        .eq("service_id", id)
        .eq("reviewer_role", "client")
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("freelancer_rating_stats")
        .select("rating_avg, rating_count")
        .eq("user_id", service.freelancer_id)
        .maybeSingle(),
    ]);

  return (
    <div className="container py-10 md:py-16">
      <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
        <main className="min-w-0">
          <div className="bg-muted aspect-video overflow-hidden rounded-3xl">
            {service.cover_image_path ? (
              // eslint-disable-next-line @next/next/no-img-element -- public Storage URL, not optimised
              <img
                src={publicObjectUrl(
                  env.NEXT_PUBLIC_SUPABASE_URL,
                  SERVICE_MEDIA_BUCKET,
                  service.cover_image_path,
                )}
                alt=""
                className="size-full object-cover"
              />
            ) : null}
          </div>
          <p className="text-primary mt-8 text-sm font-bold tracking-widest uppercase">
            {service.category_name}
          </p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight break-words">
            {service.title}
          </h1>
          <RatingSummary
            avg={service.rating_avg}
            count={service.rating_count}
            className="mt-3"
          />
          <p className="text-muted-foreground mt-6 leading-8 break-words whitespace-pre-wrap">
            {service.description}
          </p>

          {reviews && reviews.length > 0 ? (
            <section className="mt-10 space-y-4 border-t pt-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-bold">Ulasan layanan ini</h2>
                <RatingSummary
                  avg={service.rating_avg}
                  count={service.rating_count}
                />
              </div>
              <ReviewList reviews={reviews} />
            </section>
          ) : null}

          <div className="mt-10 border-t pt-8">
            <h2 className="text-xl font-bold">Tentang freelancer</h2>
            <Link
              href={`/u/${service.freelancer_username}` as Route}
              className="mt-5 flex items-center gap-3"
            >
              <UserAvatar
                path={service.freelancer_avatar_path}
                name={service.freelancer_name}
                username={service.freelancer_username ?? ""}
                className="size-14"
              />
              <div className="min-w-0">
                <p className="font-bold">
                  {service.freelancer_name ?? service.freelancer_username}
                </p>
                <p className="text-muted-foreground text-sm">
                  {service.freelancer_headline}
                </p>
                <RatingSummary
                  avg={freelancerStats?.rating_avg ?? null}
                  count={freelancerStats?.rating_count ?? null}
                />
              </div>
            </Link>
            {portfolio && portfolio.length > 0 ? (
              <div className="mt-8">
                <h3 className="font-bold">Portofolio</h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {portfolio.map((item) => (
                    <div key={item.id} className="bg-muted rounded-xl p-4">
                      <p className="font-semibold">{item.title}</p>
                      {item.description ? (
                        <p className="text-muted-foreground mt-1 text-sm">
                          {item.description}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </main>
        <aside className="bg-card h-fit rounded-2xl border p-6 shadow-sm lg:sticky lg:top-8">
          <p className="text-muted-foreground text-sm">Mulai dari</p>
          <p className="mt-2 text-3xl font-extrabold">
            {formatIdr(service.price ?? 0)}
          </p>
          <div className="text-muted-foreground mt-5 flex justify-between text-sm">
            <span>Pengerjaan</span>
            <span>{service.delivery_days} hari</span>
          </div>
          <div className="text-muted-foreground mt-2 flex justify-between text-sm">
            <span>Revisi</span>
            <span>{service.revisions_included} kali</span>
          </div>
          <Button className="mt-6 w-full" asChild>
            <Link href={`/services/${service.id}/order` as Route}>
              Pesan layanan
            </Link>
          </Button>
        </aside>
      </div>
    </div>
  );
}
