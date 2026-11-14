import { Search } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { UserAvatar } from "@/components/profile/user-avatar";
import { RatingSummary } from "@/components/reviews/review-display";
import { Button } from "@/components/ui/button";
import { env } from "@/lib/env";
import { formatIdr } from "@/lib/format";
import { publicObjectUrl, SERVICE_MEDIA_BUCKET } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { sanitizeSearchTerm } from "@/lib/validation/job";
import {
  parseServicesSearch,
  type ServicesSearch,
} from "@/lib/validation/service";

export const metadata: Metadata = { title: "Cari jasa" };

const PAGE_SIZE = 20;
const fieldClass =
  "border-input h-10 rounded-md border bg-transparent px-3 text-sm";

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

  return (
    <div className="container py-12 md:py-16">
      <div className="max-w-3xl">
        <p className="text-primary text-sm font-bold tracking-widest uppercase">
          Marketplace
        </p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">
          Temukan layanan dari mahasiswa terverifikasi.
        </h1>
        <p className="text-muted-foreground mt-5 text-lg">
          Pilih keahlian yang Anda butuhkan dan dukung talenta mahasiswa
          Indonesia.
        </p>
      </div>

      <form
        className="bg-card mt-10 grid gap-3 rounded-2xl border p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-[1fr_180px_130px_130px_170px_auto]"
        role="search"
      >
        <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-1">
          <Search className="text-muted-foreground size-5 shrink-0" />
          <input
            name="q"
            defaultValue={search.q}
            maxLength={100}
            aria-label="Kata kunci"
            className="h-10 w-full min-w-0 bg-transparent outline-none"
            placeholder="Cari layanan…"
          />
        </div>
        <select
          name="category"
          defaultValue={search.category ?? ""}
          aria-label="Kategori"
          className={fieldClass}
        >
          <option value="">Semua kategori</option>
          {categories?.map((item) => (
            <option key={item.id} value={item.slug}>
              {item.name}
            </option>
          ))}
        </select>
        <input
          name="minPrice"
          type="number"
          min={0}
          step={1000}
          defaultValue={search.minPrice}
          aria-label="Harga minimum"
          placeholder="Harga min"
          className={fieldClass}
        />
        <input
          name="maxPrice"
          type="number"
          min={0}
          step={1000}
          defaultValue={search.maxPrice}
          aria-label="Harga maksimum"
          placeholder="Harga maks"
          className={fieldClass}
        />
        <select
          name="sort"
          defaultValue={search.sort}
          aria-label="Urutkan"
          className={fieldClass}
        >
          <option value="newest">Terbaru</option>
          <option value="price_asc">Harga terendah</option>
          <option value="price_desc">Harga tertinggi</option>
          <option value="rating">Rating tertinggi</option>
        </select>
        <Button type="submit" className="sm:col-span-2 lg:col-span-1">
          Cari
        </Button>
      </form>

      {failed ? (
        <div className="bg-muted/40 mt-10 rounded-3xl border border-dashed py-20 text-center">
          <h2 className="text-xl font-bold">Layanan belum dapat dimuat</h2>
          <p className="text-muted-foreground mt-2">
            Coba muat ulang halaman beberapa saat lagi.
          </p>
        </div>
      ) : items.length > 0 ? (
        <>
          <p className="text-muted-foreground mt-8 text-sm">
            {count} layanan ditemukan
          </p>
          <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((service) => (
              <Link
                key={service.id}
                href={`/services/${service.id}` as Route}
                className="bg-card overflow-hidden rounded-2xl border transition-shadow hover:shadow-lg"
              >
                <div className="bg-muted aspect-[16/10]">
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
                <div className="space-y-4 p-5">
                  <p className="text-primary text-xs font-bold tracking-widest uppercase">
                    {service.category_name}
                  </p>
                  <h2 className="line-clamp-2 text-lg font-bold break-words">
                    {service.title}
                  </h2>
                  <div className="flex min-w-0 items-center gap-2">
                    <UserAvatar
                      path={service.freelancer_avatar_path}
                      name={service.freelancer_name}
                      username={service.freelancer_username ?? ""}
                    />
                    <span className="text-muted-foreground truncate text-sm">
                      {service.freelancer_name ??
                        `@${service.freelancer_username}`}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <span className="text-muted-foreground text-sm">
                      {service.delivery_days} hari
                    </span>
                    <strong>{formatIdr(service.price ?? 0)}</strong>
                  </div>
                  <RatingSummary
                    avg={service.rating_avg}
                    count={service.rating_count}
                  />
                </div>
              </Link>
            ))}
          </div>
          {totalPages > 1 ? (
            <nav
              className="mt-8 flex items-center justify-between gap-3"
              aria-label="Halaman"
            >
              {search.page > 1 ? (
                <Button variant="outline" asChild>
                  <Link href={pageHref(search, search.page - 1)}>
                    Sebelumnya
                  </Link>
                </Button>
              ) : (
                <span />
              )}
              <span className="text-muted-foreground text-sm">
                Halaman {search.page} dari {totalPages}
              </span>
              {search.page < totalPages ? (
                <Button variant="outline" asChild>
                  <Link href={pageHref(search, search.page + 1)}>
                    Berikutnya
                  </Link>
                </Button>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </>
      ) : (
        <div className="bg-muted/40 mt-12 rounded-3xl border border-dashed py-20 text-center">
          <h2 className="text-xl font-bold">Belum ada layanan yang cocok</h2>
          <p className="text-muted-foreground mt-2">
            Coba ubah kata kunci atau filter Anda.
          </p>
        </div>
      )}
    </div>
  );
}
