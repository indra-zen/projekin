import type { Route } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  GraduationCap,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

const steps = [
  {
    icon: BadgeCheck,
    title: "Mahasiswa terverifikasi",
    text: "Freelancer wajib lolos verifikasi status mahasiswa aktif.",
  },
  {
    icon: Wallet,
    title: "Bayar lewat Midtrans",
    text: "QRIS, GoPay, ShopeePay, atau virtual account bank.",
  },
  {
    icon: ShieldCheck,
    title: "Dana ditahan sampai selesai",
    text: "Freelancer dibayar setelah Anda menerima hasil kerja.",
  },
];

export default async function HomePage() {
  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, slug")
    .order("sort_order")
    .limit(8);

  return (
    <div>
      <section className="border-border/70 relative overflow-hidden border-b">
        <div className="container grid gap-12 py-18 md:grid-cols-[1.05fr_.95fr] md:items-center md:py-28">
          <div className="max-w-2xl">
            <div className="bg-secondary text-secondary-foreground mb-6 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold tracking-wider uppercase">
              <Sparkles className="size-3.5" /> Marketplace talenta mahasiswa
            </div>
            <h1 className="text-5xl leading-[1.08] font-extrabold tracking-[-0.04em] sm:text-6xl">
              Proyek hebat dimulai dari{" "}
              <span className="text-primary">orang yang tepat.</span>
            </h1>
            <p className="text-muted-foreground mt-6 max-w-xl text-lg leading-8">
              Projekin mempertemukan klien dengan mahasiswa berbakat yang siap
              mengerjakan desain, pemrograman, penulisan, dan banyak lagi.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <Link href="/services">
                  Cari jasa <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/jobs">Lihat lowongan</Link>
              </Button>
            </div>
            <div className="text-muted-foreground mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="text-primary size-4" /> Mahasiswa
                terverifikasi
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle2 className="text-primary size-4" /> Pembayaran aman
              </span>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-md">
            <div className="bg-secondary/70 absolute -inset-8 rounded-full blur-3xl" />
            <div className="border-border bg-card shadow-primary/10 relative rounded-3xl border p-5 shadow-2xl">
              <div className="border-border border-b pb-5">
                <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                  Cara kerja
                </p>
                <p className="mt-1 text-lg font-bold">
                  Aman dari awal sampai akhir
                </p>
              </div>
              <ol className="space-y-3 py-5">
                {steps.map(({ icon: Icon, title, text }) => (
                  <li
                    key={title}
                    className="border-border/80 flex items-center gap-3 rounded-2xl border p-3"
                  >
                    <div className="bg-muted text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
                      <Icon className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{title}</p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {text}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="bg-primary text-primary-foreground flex items-center gap-3 rounded-2xl p-4">
                <GraduationCap className="size-6 shrink-0" />
                <div>
                  <p className="text-sm font-bold">Anda mahasiswa?</p>
                  <p className="text-primary-foreground/75 mt-0.5 text-xs">
                    Daftar, verifikasi KTM, lalu tawarkan jasa Anda.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      {categories && categories.length > 0 ? (
        <section className="container py-16 md:py-20">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="text-primary text-sm font-bold tracking-widest uppercase">
                Mulai jelajahi
              </p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight">
                Apa yang ingin Anda kerjakan?
              </h2>
            </div>
            <Link
              href="/services"
              className="text-primary text-sm font-bold hover:underline"
            >
              Lihat semua jasa <ArrowRight className="ml-1 inline size-4" />
            </Link>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((category, index) => (
              <Link
                key={category.id}
                href={`/services?category=${category.slug}` as Route}
                className="group border-border bg-card hover:border-primary/40 hover:shadow-primary/5 rounded-2xl border p-5 transition-all hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="bg-secondary text-primary mb-10 flex size-10 items-center justify-center rounded-xl text-sm font-bold">
                  {String(index + 1).padStart(2, "0")}
                </div>
                <p className="font-bold">{category.name}</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  Lihat jasa mahasiswa{" "}
                  <ArrowRight className="ml-1 inline size-3.5 transition-transform group-hover:translate-x-1" />
                </p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
      <section className="bg-foreground text-background py-16">
        <div className="container flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
          <div>
            <p className="text-primary-foreground/60 text-sm font-bold tracking-widest uppercase">
              Siap memulai?
            </p>
            <h2 className="mt-3 max-w-xl text-3xl font-bold tracking-tight sm:text-4xl">
              Wujudkan ide Anda bersama talenta mahasiswa.
            </h2>
          </div>
          <Button size="lg" variant="secondary" asChild>
            <Link href="/register">
              Gabung dengan Projekin <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
