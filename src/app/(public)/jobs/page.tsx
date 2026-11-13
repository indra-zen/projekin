import { CalendarDays, Search } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { UserAvatar } from "@/components/profile/user-avatar";
import { Button } from "@/components/ui/button";
import { formatBudgetRange, formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import {
  parseJobsSearch,
  sanitizeSearchTerm,
  type JobsSearch,
} from "@/lib/validation/job";

export const metadata: Metadata = { title: "Cari pekerjaan" };

const PAGE_SIZE = 20;
const fieldClass =
  "border-input h-10 rounded-md border bg-transparent px-3 text-sm";

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

  return (
    <div className="container py-12 md:py-16">
      <div className="max-w-3xl">
        <p className="text-primary text-sm font-bold tracking-widest uppercase">
          Lowongan
        </p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">
          Temukan proyek yang layak dikerjakan.
        </h1>
        <p className="text-muted-foreground mt-5 text-lg">
          Kirim proposal ke pekerjaan dari klien, lalu bangun portofolio Anda.
          Hanya mahasiswa terverifikasi yang dapat mengirim proposal.
        </p>
      </div>

      <form
        className="bg-card mt-10 grid gap-3 rounded-2xl border p-4 shadow-sm md:grid-cols-[1fr_180px_130px_130px_150px_auto]"
        role="search"
      >
        <div className="flex items-center gap-2">
          <Search className="text-muted-foreground size-5 shrink-0" />
          <input
            name="q"
            defaultValue={search.q}
            maxLength={100}
            aria-label="Kata kunci"
            className="h-10 w-full bg-transparent outline-none"
            placeholder="Cari pekerjaan…"
          />
        </div>
        <select
          name="category"
          defaultValue={search.category ?? ""}
          aria-label="Kategori"
          className={fieldClass}
        >
          <option value="">Semua kategori</option>
          {categories?.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          name="minBudget"
          type="number"
          min={0}
          step={1000}
          defaultValue={search.minBudget}
          aria-label="Anggaran minimum"
          placeholder="Anggaran min"
          className={fieldClass}
        />
        <input
          name="maxBudget"
          type="number"
          min={0}
          step={1000}
          defaultValue={search.maxBudget}
          aria-label="Anggaran maksimum"
          placeholder="Anggaran maks"
          className={fieldClass}
        />
        <select
          name="sort"
          defaultValue={search.sort}
          aria-label="Urutkan"
          className={fieldClass}
        >
          <option value="newest">Terbaru</option>
          <option value="budget_desc">Anggaran tertinggi</option>
        </select>
        <Button type="submit">Cari</Button>
      </form>

      {error ? (
        <div className="bg-muted/40 mt-10 rounded-3xl border border-dashed py-20 text-center">
          <h2 className="text-xl font-bold">Lowongan belum dapat dimuat</h2>
          <p className="text-muted-foreground mt-2">
            Coba muat ulang halaman beberapa saat lagi.
          </p>
        </div>
      ) : jobs && jobs.length > 0 ? (
        <>
          <p className="text-muted-foreground mt-8 text-sm">
            {count} lowongan ditemukan
          </p>
          <ul className="mt-4 grid gap-4">
            {jobs.map((job) => (
              <li key={job.id}>
                <Link
                  href={`/jobs/${job.id}` as Route}
                  className="bg-card block rounded-2xl border p-5 transition-shadow hover:shadow-md sm:p-6"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-2">
                      <p className="text-primary text-xs font-bold tracking-widest uppercase">
                        {job.category?.name}
                      </p>
                      <h2 className="text-lg font-bold break-words">
                        {job.title}
                      </h2>
                      <p className="text-muted-foreground line-clamp-2 text-sm">
                        {job.description}
                      </p>
                    </div>
                    <strong className="shrink-0 text-sm sm:text-base">
                      {formatBudgetRange(job.budget_min, job.budget_max)}
                    </strong>
                  </div>
                  <div className="text-muted-foreground mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                    {job.client ? (
                      <span className="flex items-center gap-2">
                        <UserAvatar
                          path={job.client.avatar_path}
                          name={job.client.full_name}
                          username={job.client.username}
                          className="size-6"
                        />
                        {job.client.full_name ?? `@${job.client.username}`}
                      </span>
                    ) : null}
                    <span>Diposting {formatDate(job.created_at)}</span>
                    {job.deadline ? (
                      <span className="flex items-center gap-1">
                        <CalendarDays className="size-3.5" /> Tenggat{" "}
                        {formatDate(job.deadline)}
                      </span>
                    ) : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
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
          <h2 className="text-xl font-bold">Belum ada lowongan yang cocok</h2>
          <p className="text-muted-foreground mt-2">
            Coba ubah kata kunci atau filter Anda.
          </p>
        </div>
      )}
    </div>
  );
}
