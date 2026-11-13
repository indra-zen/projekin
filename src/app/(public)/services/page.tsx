import Link from "next/link";
import type { Route } from "next";
import { Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { publicObjectUrl, SERVICE_MEDIA_BUCKET } from "@/lib/storage";
import { formatIdr } from "@/lib/format";
import { env } from "@/lib/env";
import { UserAvatar } from "@/components/profile/user-avatar";
import { Button } from "@/components/ui/button";

export default async function ServicesPage({ searchParams }: PageProps<"/services">) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const searchTerm = query.replace(/[^\p{L}\p{N}\s_-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 100);
  const category = typeof params.category === "string" ? params.category : "";
  const min = typeof params.min === "string" && /^\d+$/.test(params.min) ? Number(params.min) : 0;
  const max = typeof params.max === "string" && /^\d+$/.test(params.max) ? Number(params.max) : 50000000;
  const supabase = await createClient();
  const [{ data: categories }, { data: services, error }] = await Promise.all([
    supabase.from("categories").select("id, name, slug").order("sort_order"),
    (searchTerm
      ? supabase
          .from("service_listings")
          .select("*")
          .or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
      : supabase.from("service_listings").select("*")
    ).gte("price", min).lte("price", max).order("created_at", { ascending: false }).limit(24),
  ]);
  const filteredServices = category ? services?.filter((service) => service.category_slug === category) : services;
  return <div className="container py-12 md:py-16">
    <div className="max-w-3xl"><p className="text-primary text-sm font-bold tracking-widest uppercase">Marketplace</p><h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">Temukan layanan dari mahasiswa terverifikasi.</h1><p className="text-muted-foreground mt-5 text-lg">Pilih keahlian yang Anda butuhkan dan dukung talenta mahasiswa Indonesia.</p></div>
    <form className="bg-card mt-10 grid gap-3 rounded-2xl border p-4 shadow-sm md:grid-cols-[1fr_180px_140px_120px_auto]">
      <div className="flex items-center gap-2"><Search className="text-muted-foreground size-5" /><input name="q" defaultValue={query} className="h-10 w-full bg-transparent outline-none" placeholder="Cari layanan…" /></div>
      <select name="category" defaultValue={category} className="border-input h-10 rounded-md border bg-transparent px-3 text-sm"><option value="">Semua kategori</option>{categories?.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}</select>
      <input name="min" type="number" min={10000} placeholder="Harga min" className="border-input h-10 rounded-md border bg-transparent px-3 text-sm" /><input name="max" type="number" placeholder="Harga max" className="border-input h-10 rounded-md border bg-transparent px-3 text-sm" /><Button type="submit">Cari</Button>
    </form>
    {error ? <div className="bg-muted/40 mt-10 rounded-3xl border border-dashed py-20 text-center"><h2 className="text-xl font-bold">Layanan belum dapat dimuat</h2><p className="text-muted-foreground mt-2">Coba muat ulang halaman beberapa saat lagi.</p></div> : filteredServices && filteredServices.length > 0 ? <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{filteredServices.map((service) => <Link key={service.id} href={`/services/${service.id}` as Route} className="bg-card overflow-hidden rounded-2xl border transition-shadow hover:shadow-lg"><div className="bg-muted aspect-[16/10]">{service.cover_image_path ? <img src={publicObjectUrl(env.NEXT_PUBLIC_SUPABASE_URL, SERVICE_MEDIA_BUCKET, service.cover_image_path)} alt="" className="size-full object-cover" /> : null}</div><div className="space-y-4 p-5"><p className="text-primary text-xs font-bold tracking-widest uppercase">{service.category_name}</p><h2 className="line-clamp-2 text-lg font-bold">{service.title}</h2><div className="flex items-center gap-2"><UserAvatar path={service.freelancer_avatar_path} name={service.freelancer_name} username={service.freelancer_username ?? ""} /><span className="text-muted-foreground text-sm">{service.freelancer_name ?? `@${service.freelancer_username}`}</span></div><div className="flex items-end justify-between"><span className="text-muted-foreground text-sm">{service.delivery_days} hari</span><strong>{formatIdr(service.price ?? 0)}</strong></div></div></Link>)}</div> : <div className="bg-muted/40 mt-12 rounded-3xl border border-dashed py-20 text-center"><h2 className="text-xl font-bold">Belum ada layanan yang cocok</h2><p className="text-muted-foreground mt-2">Coba ubah kata kunci atau filter Anda.</p></div>}
  </div>;
}
