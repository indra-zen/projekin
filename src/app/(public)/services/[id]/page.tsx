import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { publicObjectUrl, SERVICE_MEDIA_BUCKET } from "@/lib/storage";
import { formatIdr } from "@/lib/format";
import { env } from "@/lib/env";
import { UserAvatar } from "@/components/profile/user-avatar";
import { Button } from "@/components/ui/button";

export default async function ServiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: service } = await supabase.from("service_listings").select("*").eq("id", id).maybeSingle();
  if (!service) notFound();
  const { data: portfolio } = await supabase.from("portfolio_items").select("id,title,description,external_url,image_paths").eq("freelancer_id", service.freelancer_id).order("sort_order");
  return <div className="container py-10 md:py-16"><div className="grid gap-10 lg:grid-cols-[1fr_360px]"><main><div className="bg-muted aspect-video overflow-hidden rounded-3xl">{service.cover_image_path ? <img src={publicObjectUrl(env.NEXT_PUBLIC_SUPABASE_URL, SERVICE_MEDIA_BUCKET, service.cover_image_path)} alt="" className="size-full object-cover" /> : null}</div><p className="text-primary mt-8 text-sm font-bold tracking-widest uppercase">{service.category_name}</p><h1 className="mt-3 text-4xl font-extrabold tracking-tight">{service.title}</h1><p className="text-muted-foreground mt-6 leading-8 whitespace-pre-wrap">{service.description}</p><div className="mt-10 border-t pt-8"><h2 className="text-xl font-bold">Tentang freelancer</h2><Link href={`/u/${service.freelancer_username}`} className="mt-5 flex items-center gap-3"><UserAvatar path={service.freelancer_avatar_path} name={service.freelancer_name} username={service.freelancer_username} className="size-14" /><div><p className="font-bold">{service.freelancer_name ?? service.freelancer_username}</p><p className="text-muted-foreground text-sm">{service.freelancer_headline}</p></div></Link>{portfolio && portfolio.length > 0 ? <div className="mt-8"><h3 className="font-bold">Portofolio</h3><div className="mt-4 grid gap-3 sm:grid-cols-2">{portfolio.map((item) => <div key={item.id} className="bg-muted rounded-xl p-4"><p className="font-semibold">{item.title}</p>{item.description ? <p className="text-muted-foreground mt-1 text-sm">{item.description}</p> : null}</div>)}</div></div> : null}</div></main><aside className="h-fit rounded-2xl border bg-card p-6 shadow-sm lg:sticky lg:top-8"><p className="text-muted-foreground text-sm">Mulai dari</p><p className="mt-2 text-3xl font-extrabold">{formatIdr(service.price)}</p><div className="text-muted-foreground mt-5 flex justify-between text-sm"><span>Pengerjaan</span><span>{service.delivery_days} hari</span></div><div className="text-muted-foreground mt-2 flex justify-between text-sm"><span>Revisi</span><span>{service.revisions_included} kali</span></div><Button className="mt-6 w-full" disabled>Pesan layanan (segera hadir)</Button></aside></div></div>;
}
