import { CalendarDays, Search, SearchX } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { UserAvatar } from "@/components/profile/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { formatBudgetRange, formatDate } from "@/lib/format";
import { ledgeAt } from "@/lib/ledge";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import {
  parseJobsSearch,
  sanitizeSearchTerm,
  type JobsSearch,
} from "@/lib/validation/job";

export const metadata: Metadata = { title: "Cari pekerjaan" };

const PAGE_SIZE = 20;

function pageHref(search: JobsSearch, page: number): Route {
  const params = new URLSearchParams();
  if (search.q) params.set("q", search.q);
  if (search.category) params.set("category", search.category);
  if (search.minBudget !== undefined)
    params.set("minBudget", String(search.minBudget));
  if (search.maxBudget !== undefined)
    params.set("maxBudget", String(search.maxBudget));
  if (search.sort !== "newest") params.set("sort", search.sort);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return (qs ? `/jobs?${qs}` : "/jobs") as Route;
}

export default async function JobsPage({ searchParams }: PageProps<"/jobs">) {
  const search = parseJobsSearch(await searchParams);
  const term = sanitizeSearchTerm(search.q);
  const supabase = await createClient();

  const { data: categories } = await supabase
    .from("categories")
    .select("id, slug, name")
    .order("sort_order");
  const category = categories?.find((c) => c.slug === search.category);

  let query = supabase
    .from("jobs")
    .select(
      "id, title, description, budget_min, budget_max, deadline, created_at, category:categories(name), client:profiles!jobs_client_id_fkey(username, full_name, avatar_path)",
      { count: "exact" },
    )
    .eq("status", "open");
  if (term)
    query = query.textSearch("search", term, {
      type: "websearch",
      config: "simple",
    });
  if (category) query = query.eq("category_id", category.id);
  // Overlap filters: the job's budget range intersects the requested range.
  if (search.minBudget !== undefined)
    query = query.gte("budget_max", search.minBudget);
  if (search.maxBudget !== undefined)
    query = query.lte("budget_min", search.maxBudget);
  query =
    search.sort === "budget_desc"
      ? query
          .order("budget_max", { ascending: false })
          .order("created_at", { ascending: false })
      : query.order("created_at", { ascending: false });
  const from = (search.page - 1) * PAGE_SIZE;
  const {
    data: jobs,
    count,
    error,
  } = await query.range(from, from + PAGE_SIZE - 1);
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  const filtered = Boolean(
    search.q ||
    search.category ||
    search.minBudget !== undefined ||
    search.maxBudget !== undefined ||
    search.sort !== "newest",
  );
  const failed = error !== null && error.code !== "PGRST103";

  return (
    <div>
      <PageHeader
        eyebrow="Lowongan"
        title="Temukan proyek yang layak dikerjakan."
        description="Kirim proposal ke pekerjaan dari klien, lalu bangun portofolio Anda. Hanya mahasiswa terverifikasi yang dapat mengirim proposal."
      >
        <form
          className="bg-card border-border shadow-hard grid gap-3 rounded-2xl border-2 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_170px_160px_160px_170px_auto]"
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
              placeholder="Cari pekerjaan…"
            />
          </div>
          <NativeSelect
            name="category"
            defaultValue={search.category ?? ""}
            aria-label="Kategori"
          >
            <option value="">Semua kategori</option>
            {categories?.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
          <Input
            name="minBudget"
            type="number"
            min={0}
            step={1000}
            defaultValue={search.minBudget}
            aria-label="Anggaran minimum"
            placeholder="Anggaran min"
          />
          <Input
            name="maxBudget"
            type="number"
            min={0}
            step={1000}
            defaultValue={search.maxBudget}
            aria-label="Anggaran maksimum"
            placeholder="Anggaran maks"
          />
          <NativeSelect
            name="sort"
            defaultValue={search.sort}
            aria-label="Urutkan"
          >
            <option value="newest">Terbaru</option>
            <option value="budget_desc">Anggaran tertinggi</option>
          </NativeSelect>
          <Button type="submit" className="sm:col-span-2 lg:col-span-1">
            Cari
          </Button>
        </form>
      </PageHeader>

      <div className="container py-10 md:py-14">
        {/* PGRST103: a page past the end is an empty result, not a failure. */}
        {failed ? (
          <EmptyState
            icon={SearchX}
            title="Lowongan belum dapat dimuat"
            description="Coba muat ulang halaman beberapa saat lagi."
          />
        ) : jobs && jobs.length > 0 ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-bold">{count} lowongan ditemukan</p>
              {filtered ? (
                <Link
                  href="/jobs"
                  className="text-primary text-sm font-bold underline decoration-2 underline-offset-4"
                >
                  Atur ulang filter
                </Link>
              ) : null}
            </div>
            <ul className="mt-6 grid gap-y-8">
              {jobs.map((job, index) => (
                <li key={job.id}>
                  <Link
                    href={`/jobs/${job.id}` as Route}
                    className={cn(
                      "group bg-card border-border shadow-ledge block rounded-2xl border-2 p-5 transition-transform motion-safe:hover:-translate-y-1 motion-safe:focus-visible:-translate-y-1 sm:p-6",
                      ledgeAt(index),
                    )}
                  >
                    <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between md:gap-8">
                      <div className="min-w-0 space-y-3">
                        {job.category?.name ? (
                          <span className="sticker bg-highlight">
                            {job.category.name}
                          </span>
                        ) : null}
                        <h2 className="font-sans text-xl leading-snug font-bold break-words decoration-2 underline-offset-4 group-hover:underline">
                          {job.title}
                        </h2>
                        <p className="text-muted-foreground line-clamp-2 text-sm leading-6">
                          {job.description}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col gap-3 sm:flex-row md:w-64 md:flex-col">
                        <div className="bg-success border-border rounded-xl border-2 px-3 py-2 sm:flex-1">
                          <p className="text-xs font-bold">Anggaran</p>
                          <p className="font-display text-lg leading-tight font-extrabold">
                            {formatBudgetRange(job.budget_min, job.budget_max)}
                          </p>
                        </div>
                        {job.deadline ? (
                          <div className="bg-secondary border-border rounded-xl border-2 px-3 py-2 sm:flex-1">
                            <p className="flex items-center gap-1 text-xs font-bold">
                              <CalendarDays className="size-3.5" aria-hidden />{" "}
                              Tenggat
                            </p>
                            <p className="text-sm font-bold">
                              {formatDate(job.deadline)}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="border-hairline text-muted-foreground mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-4 text-xs">
                      {job.client ? (
                        <span className="text-foreground flex items-center gap-2 font-semibold">
                          <UserAvatar
                            path={job.client.avatar_path}
                            name={job.client.full_name}
                            username={job.client.username}
                            className="size-7"
                          />
                          {job.client.full_name ?? `@${job.client.username}`}
                        </span>
                      ) : null}
                      <span>Diposting {formatDate(job.created_at)}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
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
            title="Belum ada lowongan yang cocok"
            description="Coba ubah kata kunci atau filter Anda."
          >
            {filtered ? (
              <Button variant="outline" asChild>
                <Link href="/jobs">Atur ulang filter</Link>
              </Button>
            ) : null}
          </EmptyState>
        )}
      </div>
    </div>
  );
}
