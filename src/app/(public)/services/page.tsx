import { Clock, Search, SearchX } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { UserAvatar } from "@/components/profile/user-avatar";
import { RatingSummary } from "@/components/reviews/review-display";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { env } from "@/lib/env";
import { formatIdr } from "@/lib/format";
import { ledgeAt } from "@/lib/ledge";
import { publicObjectUrl, SERVICE_MEDIA_BUCKET } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { sanitizeSearchTerm } from "@/lib/validation/job";
import { cn } from "@/lib/utils";
import {
  parseServicesSearch,
  type ServicesSearch,
} from "@/lib/validation/service";

export const metadata: Metadata = { title: "Cari jasa" };

const PAGE_SIZE = 20;
const coverTints = [
  "bg-lilac/40",
  "bg-secondary/50",
  "bg-accent/35",
  "bg-success",
  "bg-highlight",
] as const;

function pageHref(search: ServicesSearch, page: number): Route {
  const params = new URLSearchParams();
  if (search.q) params.set("q", search.q);
  if (search.category) params.set("category", search.category);
  if (search.minPrice !== undefined)
    params.set("minPrice", String(search.minPrice));
  if (search.maxPrice !== undefined)
    params.set("maxPrice", String(search.maxPrice));
  if (search.sort !== "newest") params.set("sort", search.sort);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return (qs ? `/services?${qs}` : "/services") as Route;
}

/**
 * FR-SVC-05: published, unblocked services of eligible freelancers (the
 * service_listings view, under the services RLS policy), filtered and sorted
 * in the database and paginated, so nothing beyond the first page is lost.
 */
export default async function ServicesPage({
  searchParams,
}: PageProps<"/services">) {
  const search = parseServicesSearch(await searchParams);
  // Letters, digits, spaces, "_" and "-" only: safe inside the or() filter.
  const term = sanitizeSearchTerm(search.q);
  const supabase = await createClient();

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, slug")
    .order("sort_order");

  let query = supabase.from("service_listings").select("*", { count: "exact" });
  if (term)
    query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%`);
  if (search.category) query = query.eq("category_slug", search.category);
  if (search.minPrice !== undefined)
    query = query.gte("price", search.minPrice);
  if (search.maxPrice !== undefined)
    query = query.lte("price", search.maxPrice);
  switch (search.sort) {
    case "price_asc":
      query = query.order("price", { ascending: true });
      break;
    case "price_desc":
      query = query.order("price", { ascending: false });
      break;
    case "rating":
      query = query
        .order("rating_avg", { ascending: false })
        .order("rating_count", { ascending: false });
      break;
    default:
      query = query.order("published_at", {
        ascending: false,
        nullsFirst: false,
      });
  }
  // Stable order across pages.
  query = query.order("created_at", { ascending: false }).order("id");

  const from = (search.page - 1) * PAGE_SIZE;
  const {
    data: services,
    count,
    error,
  } = await query.range(from, from + PAGE_SIZE - 1);
  // PGRST103: a page past the end is an empty result, not a failure.
  const failed = error !== null && error.code !== "PGRST103";
  const items = services ?? [];
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  const filtered = Boolean(
    search.q ||
    search.category ||
    search.minPrice !== undefined ||
    search.maxPrice !== undefined ||
    search.sort !== "newest",
  );

  return (
    <div>
      <PageHeader
        eyebrow="Marketplace"
        title="Temukan layanan dari mahasiswa terverifikasi."
        description="Pilih keahlian yang Anda butuhkan dan dukung talenta mahasiswa Indonesia."
      >
        <form
          className="bg-card border-border shadow-hard grid gap-3 rounded-2xl border-2 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_180px_130px_130px_170px_auto]"
          role="search"
        >
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2"
              aria-hidden
            />
            <Input
              name="q"
              defaultValue={search.q}
              maxLength={100}
              aria-label="Kata kunci"
              className="pl-10"
              placeholder="Cari layanan…"
            />
          </div>
          <NativeSelect
            name="category"
            defaultValue={search.category ?? ""}
            aria-label="Kategori"
          >
            <option value="">Semua kategori</option>
            {categories?.map((item) => (
              <option key={item.id} value={item.slug}>
                {item.name}
              </option>
            ))}
          </NativeSelect>
          <Input
            name="minPrice"
            type="number"
            min={0}
            step={1000}
            defaultValue={search.minPrice}
            aria-label="Harga minimum"
            placeholder="Harga min"
          />
          <Input
            name="maxPrice"
            type="number"
            min={0}
            step={1000}
            defaultValue={search.maxPrice}
            aria-label="Harga maksimum"
            placeholder="Harga maks"
          />
          <NativeSelect
            name="sort"
            defaultValue={search.sort}
            aria-label="Urutkan"
          >
            <option value="newest">Terbaru</option>
            <option value="price_asc">Harga terendah</option>
            <option value="price_desc">Harga tertinggi</option>
            <option value="rating">Rating tertinggi</option>
          </NativeSelect>
          <Button type="submit" className="sm:col-span-2 lg:col-span-1">
            Cari
          </Button>
        </form>
      </PageHeader>

      <div className="container py-10 md:py-14">
        {failed ? (
          <EmptyState
            icon={SearchX}
            title="Layanan belum dapat dimuat"
            description="Coba muat ulang halaman beberapa saat lagi."
          />
        ) : items.length > 0 ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-bold">{count} layanan ditemukan</p>
              {filtered ? (
                <Link
                  href="/services"
                  className="text-primary text-sm font-bold underline decoration-2 underline-offset-4"
                >
                  Atur ulang filter
                </Link>
              ) : null}
            </div>
            <div className="mt-6 grid gap-x-6 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((service, index) => (
                <Link
                  key={service.id}
                  href={`/services/${service.id}` as Route}
                  className={cn(
                    "group bg-card border-border shadow-ledge flex flex-col overflow-hidden rounded-2xl border-2 transition-transform motion-safe:hover:-translate-y-1 motion-safe:focus-visible:-translate-y-1",
                    ledgeAt(index),
                  )}
                >
                  <div
                    className={cn(
                      "border-border relative aspect-[16/10] border-b-2",
                      coverTints[index % coverTints.length],
                    )}
                  >
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
                        className="font-display absolute inset-0 flex items-center justify-center text-8xl font-extrabold opacity-25"
                      >
                        {(service.category_name ?? "P").charAt(0)}
                      </span>
                    )}
                    {service.category_name ? (
                      <span className="sticker bg-highlight shadow-hard-sm absolute top-3 left-3">
                        {service.category_name}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-1 flex-col gap-4 p-5">
                    <h2 className="line-clamp-2 font-sans text-lg leading-snug font-bold break-words decoration-2 underline-offset-4 group-hover:underline">
                      {service.title}
                    </h2>
                    <div className="flex min-w-0 items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <UserAvatar
                          path={service.freelancer_avatar_path}
                          name={service.freelancer_name}
                          username={service.freelancer_username ?? ""}
                          className="size-8 shrink-0"
                        />
                        <span className="truncate text-sm font-semibold">
                          {service.freelancer_name ??
                            `@${service.freelancer_username}`}
                        </span>
                      </div>
                      <RatingSummary
                        avg={service.rating_avg}
                        count={service.rating_count}
                        className="shrink-0"
                      />
                    </div>
                    <div className="border-hairline mt-auto flex items-end justify-between gap-2 border-t pt-4">
                      <div>
                        <p className="text-muted-foreground text-xs font-semibold">
                          Harga
                        </p>
                        <strong className="font-display text-2xl font-extrabold">
                          {formatIdr(service.price ?? 0)}
                        </strong>
                      </div>
                      <span className="sticker bg-muted">
                        <Clock className="size-3.5" aria-hidden />
                        {service.delivery_days} hari
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            <Pagination
              page={search.page}
              totalPages={totalPages}
              prevHref={
                search.page > 1 ? pageHref(search, search.page - 1) : null
              }
              nextHref={
                search.page < totalPages
                  ? pageHref(search, search.page + 1)
                  : null
              }
            />
          </>
        ) : (
          <EmptyState
            icon={SearchX}
            title="Belum ada layanan yang cocok"
            description="Coba ubah kata kunci atau filter Anda."
          >
            {filtered ? (
              <Button variant="outline" asChild>
                <Link href="/services">Atur ulang filter</Link>
              </Button>
            ) : null}
          </EmptyState>
        )}
      </div>
    </div>
  );
}
