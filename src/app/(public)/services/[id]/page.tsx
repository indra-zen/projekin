import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { UserAvatar } from "@/components/profile/user-avatar";
import { RatingSummary, ReviewList } from "@/components/reviews/review-display";
import { Button } from "@/components/ui/button";
import { env } from "@/lib/env";
import { formatIdr } from "@/lib/format";
import { publicObjectUrl, SERVICE_MEDIA_BUCKET } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import {
  BASE_OPEN_GRAPH,
  excerpt,
  SITE_PREVIEW_IMAGE,
} from "@/lib/site-metadata";
import { uuidSchema } from "@/lib/validation/common";

// One query per request for both the page and its metadata. RLS: published
// services of eligible freelancers (or the viewer's own).
const loadService = cache(async (id: string) => {
  if (!uuidSchema.safeParse(id).success) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("service_listings")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!data?.freelancer_id) return null;
  return { ...data, freelancer_id: data.freelancer_id };
});

/** Link preview when a service URL is shared (WhatsApp, Facebook, X, ...). */
export async function generateMetadata({
  params,
}: PageProps<"/services/[id]">): Promise<Metadata> {
  const service = await loadService((await params).id);
  if (!service) return { title: "Layanan tidak ditemukan" };

  const title = service.title ?? "Layanan";
  const facts = [
    service.price != null ? formatIdr(service.price) : null,
    service.delivery_days != null
      ? `${service.delivery_days} hari pengerjaan`
      : null,
    service.freelancer_name ? `oleh ${service.freelancer_name}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const description = excerpt(
    [facts, service.description].filter(Boolean).join(". "),
    200,
  );
  const image = service.cover_image_path
    ? {
        url: publicObjectUrl(
          env.NEXT_PUBLIC_SUPABASE_URL,
          SERVICE_MEDIA_BUCKET,
          service.cover_image_path,
        ),
        alt: `Sampul layanan: ${title}`,
      }
    : SITE_PREVIEW_IMAGE;

  return {
    title,
    description,
    openGraph: {
      ...BASE_OPEN_GRAPH,
      type: "website",
      title,
      description,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const service = await loadService(id);
  if (!service) notFound();
  const supabase = await createClient();

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
        <div className="min-w-0">
          <div className="bg-lilac/30 border-border shadow-hard relative aspect-video overflow-hidden rounded-2xl border-2">
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
            ) : (
              <span
                aria-hidden
                className="font-display absolute inset-0 flex items-center justify-center text-9xl font-extrabold opacity-25"
              >
                {(service.category_name ?? "P").charAt(0)}
              </span>
            )}
          </div>
          {service.category_name ? (
            <span className="sticker bg-highlight mt-8">
              {service.category_name}
            </span>
          ) : null}
          <h1 className="mt-4 text-3xl leading-tight font-extrabold tracking-tight text-balance break-words md:text-4xl">
            {service.title}
          </h1>
          <RatingSummary
            avg={service.rating_avg}
            count={service.rating_count}
            className="mt-3"
          />
          <p className="mt-6 leading-8 break-words whitespace-pre-wrap">
            {service.description}
          </p>

          {reviews && reviews.length > 0 ? (
            <section className="border-hairline mt-10 space-y-5 border-t pt-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-2xl font-extrabold">Ulasan layanan ini</h2>
                <RatingSummary
                  avg={service.rating_avg}
                  count={service.rating_count}
                />
              </div>
              <ReviewList reviews={reviews} />
            </section>
          ) : null}

          <div className="border-hairline mt-10 border-t pt-8">
            <h2 className="text-2xl font-extrabold">Tentang freelancer</h2>
            <Link
              href={`/u/${service.freelancer_username}` as Route}
              className="group bg-card border-border shadow-hard-sm mt-5 flex items-center gap-4 rounded-2xl border-2 p-4 transition-transform motion-safe:hover:-translate-y-0.5"
            >
              <UserAvatar
                path={service.freelancer_avatar_path}
                name={service.freelancer_name}
                username={service.freelancer_username ?? ""}
                className="size-14"
              />
              <div className="min-w-0">
                <p className="font-bold decoration-2 underline-offset-4 group-hover:underline">
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
                <h3 className="text-lg font-bold">Portofolio</h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {portfolio.map((item) => (
                    <div
                      key={item.id}
                      className="bg-card border-border rounded-xl border-2 p-4"
                    >
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
        </div>
        <aside className="bg-card border-border shadow-hard-lg h-fit rounded-2xl border-2 p-6 lg:sticky lg:top-8">
          <p className="text-muted-foreground text-sm font-semibold">
            Mulai dari
          </p>
          <p className="font-display mt-1 text-4xl font-extrabold">
            {formatIdr(service.price ?? 0)}
          </p>
          <dl className="border-hairline mt-5 space-y-2 border-t pt-5 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Pengerjaan</dt>
              <dd className="sticker bg-muted">{service.delivery_days} hari</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Revisi</dt>
              <dd className="sticker bg-muted">
                {service.revisions_included} kali
              </dd>
            </div>
          </dl>
          <Button size="lg" className="mt-6 w-full" asChild>
            <Link href={`/services/${service.id}/order` as Route}>
              Pesan layanan
            </Link>
          </Button>
        </aside>
      </div>
    </div>
  );
}
