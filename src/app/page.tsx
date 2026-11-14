import type { Route } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  GraduationCap,
  Megaphone,
  Search,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ledgeAt } from "@/lib/ledge";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

// The hero's three-step flow, drawn as a stack of ledge cards.
const flow = [
  {
    title: "Pilih jasa atau pasang pekerjaan",
    text: "Jelajahi jasa mahasiswa, atau minta proposal dari mereka.",
    ledge: "[--ledge:var(--highlight)]",
    offset: "",
  },
  {
    title: "Bayar lewat Midtrans",
    text: "QRIS, GoPay, ShopeePay, atau virtual account bank.",
    ledge: "[--ledge:var(--accent)]",
    offset: "sm:translate-x-8",
  },
  {
    title: "Dana ditahan sampai selesai",
    text: "Freelancer dibayar setelah Anda menerima hasil kerja.",
    ledge: "[--ledge:var(--lilac)]",
    offset: "sm:translate-x-3",
  },
] as const;

const trust = [
  {
    icon: BadgeCheck,
    title: "Mahasiswa terverifikasi",
    text: "Freelancer wajib lolos verifikasi status mahasiswa aktif.",
    tile: "bg-success",
  },
  {
    icon: Wallet,
    title: "Bayar lewat Midtrans",
    text: "QRIS, GoPay, ShopeePay, atau virtual account bank.",
    tile: "bg-secondary",
  },
  {
    icon: ShieldCheck,
    title: "Dana ditahan sampai selesai",
    text: "Freelancer dibayar setelah Anda menerima hasil kerja.",
    tile: "bg-accent",
  },
] as const;

export default async function HomePage() {
  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, slug")
    .order("sort_order")
    .limit(8);

  return (
    <div>
      {/* Hero */}
      <section className="border-border relative overflow-x-clip border-b-2">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 [background-image:radial-gradient(var(--foreground)_1.5px,transparent_1.5px)] [background-size:18px_18px] opacity-[0.12] lg:block"
        />
        <div className="relative container grid gap-14 py-14 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:py-24">
          <div className="max-w-2xl">
            <span className="eyebrow bg-secondary">
              <Sparkles className="size-3.5" /> Marketplace talenta mahasiswa
            </span>
            <h1 className="mt-6 text-4xl leading-[1.05] font-extrabold tracking-[-0.03em] text-balance sm:text-5xl lg:text-6xl">
              Proyek hebat dimulai dari{" "}
              <span className="marker text-primary">orang yang tepat.</span>
            </h1>
            <p className="text-muted-foreground mt-6 max-w-xl text-lg leading-8">
              Projekin mempertemukan klien dengan mahasiswa berbakat yang siap
              mengerjakan desain, pemrograman, penulisan, dan banyak lagi.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <Link href="/services">
                  <Search className="mr-2 size-5" /> Cari jasa
                </Link>
              </Button>
              <Button size="lg" variant="secondary" asChild>
                <Link href="/jobs">
                  <Megaphone className="mr-2 size-5" /> Lihat lowongan
                </Link>
              </Button>
            </div>
            <p className="mt-6 text-sm font-semibold">
              Anda mahasiswa?{" "}
              <Link
                href="/register"
                className="text-primary underline decoration-2 underline-offset-4"
              >
                Daftar dan tawarkan jasa Anda{" "}
                <ArrowRight className="inline size-4" />
              </Link>
            </p>
          </div>

          <div className="relative mx-auto w-full max-w-md lg:max-w-none lg:pl-6">
            <div
              aria-hidden
              className="bg-lilac/40 absolute -top-8 -right-6 size-44 rounded-full"
            />
            <div
              aria-hidden
              className="bg-secondary/50 absolute -bottom-6 -left-4 size-28 rounded-full"
            />
            <span className="sticker bg-success shadow-hard-sm absolute -top-4 right-2 z-10 -rotate-6 px-3 py-1.5 text-sm">
              <BadgeCheck className="size-4" /> Freelancer = mahasiswa aktif
            </span>
            <ol className="relative space-y-6 pt-6 pb-2">
              {flow.map((step, i) => (
                <li
                  key={step.title}
                  className={cn(
                    "bg-card border-border shadow-ledge flex items-center gap-4 rounded-2xl border-2 p-4",
                    step.ledge,
                    step.offset,
                  )}
                >
                  <span className="bg-secondary border-border font-display shadow-hard-sm flex size-12 shrink-0 items-center justify-center rounded-xl border-2 text-xl font-extrabold">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="font-bold">{step.title}</p>
                    <p className="text-muted-foreground mt-0.5 text-sm leading-5">
                      {step.text}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Categories (real data) */}
      {categories && categories.length > 0 ? (
        <section className="container py-16 md:py-20">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <span className="eyebrow">Mulai jelajahi</span>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-balance md:text-4xl">
                Apa yang ingin Anda kerjakan?
              </h2>
            </div>
          </div>
          <ul className="mt-10 grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((category, index) => (
              <li key={category.id}>
                <Link
                  href={`/services?category=${category.slug}` as Route}
                  className={cn(
                    "group bg-card border-border shadow-ledge flex h-full flex-col rounded-2xl border-2 p-5 transition-transform motion-safe:hover:-translate-y-1 motion-safe:focus-visible:-translate-y-1",
                    ledgeAt(index),
                  )}
                >
                  <span className="bg-muted border-border font-display mb-8 flex size-11 items-center justify-center rounded-xl border-2 text-base font-extrabold">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="text-lg leading-snug font-bold">
                    {category.name}
                  </span>
                  <span className="text-muted-foreground mt-auto pt-3 text-sm font-medium">
                    Lihat jasa mahasiswa{" "}
                    <ArrowRight className="ml-1 inline size-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/services"
                className={cn(
                  "group bg-highlight border-border shadow-ledge flex h-full min-h-40 flex-col justify-between rounded-2xl border-2 p-5 transition-transform motion-safe:hover:-translate-y-1 motion-safe:focus-visible:-translate-y-1",
                  ledgeAt(categories.length),
                )}
              >
                <span className="bg-card border-border shadow-hard-sm flex size-11 items-center justify-center rounded-xl border-2">
                  <ArrowRight
                    className="size-5 transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </span>
                <span className="font-display text-2xl font-extrabold">
                  Lihat semua jasa
                </span>
              </Link>
            </li>
          </ul>
        </section>
      ) : null}

      {/* Two ways to work */}
      <section className="border-border bg-lilac/25 border-y-2">
        <div className="container py-16 md:py-20">
          <span className="eyebrow">Dua cara bekerja</span>
          <h2 className="mt-4 max-w-2xl text-3xl font-extrabold tracking-tight text-balance md:text-4xl">
            Pesan jasa yang sudah siap, atau pasang pekerjaan Anda sendiri.
          </h2>
          <div className="mt-10 grid gap-x-6 gap-y-8 md:grid-cols-2">
            <div className="bg-card border-border shadow-ledge flex flex-col rounded-2xl border-2 p-6 [--ledge:var(--secondary)] md:p-8">
              <span className="bg-secondary border-border shadow-hard-sm flex size-12 items-center justify-center rounded-xl border-2">
                <Search className="size-6" aria-hidden />
              </span>
              <h3 className="mt-5 text-2xl font-extrabold">Pesan jasa</h3>
              <p className="text-muted-foreground mt-2 leading-7">
                Pilih layanan dengan harga dan waktu pengerjaan yang jelas, lalu
                bayar dan pantau pesanan sampai hasil kerja Anda terima.
              </p>
              <Button className="mt-6 w-fit" asChild>
                <Link href="/services">
                  Cari jasa <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
            </div>
            <div className="bg-card border-border shadow-ledge flex flex-col rounded-2xl border-2 p-6 [--ledge:var(--accent)] md:p-8">
              <span className="bg-accent border-border shadow-hard-sm flex size-12 items-center justify-center rounded-xl border-2">
                <Megaphone className="size-6" aria-hidden />
              </span>
              <h3 className="mt-5 text-2xl font-extrabold">Pasang pekerjaan</h3>
              <p className="text-muted-foreground mt-2 leading-7">
                Ceritakan kebutuhan dan anggaran Anda, terima proposal dari
                mahasiswa terverifikasi, lalu pilih yang paling cocok.
              </p>
              <Button variant="accent" className="mt-6 w-fit" asChild>
                <Link href="/dashboard/jobs/new">
                  Posting pekerjaan <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Why Projekin */}
      <section className="container py-16 md:py-20">
        <span className="eyebrow">Kenapa Projekin</span>
        <h2 className="mt-4 max-w-2xl text-3xl font-extrabold tracking-tight text-balance md:text-4xl">
          Aman dari awal sampai akhir.
        </h2>
        <ul className="mt-10 grid gap-5 md:grid-cols-3">
          {trust.map(({ icon: Icon, title, text, tile }) => (
            <li
              key={title}
              className="bg-card border-border shadow-hard rounded-2xl border-2 p-6"
            >
              <span
                className={cn(
                  "border-border shadow-hard-sm flex size-12 items-center justify-center rounded-xl border-2",
                  tile,
                )}
              >
                <Icon className="size-6" aria-hidden />
              </span>
              <h3 className="mt-5 text-lg font-bold">{title}</h3>
              <p className="text-muted-foreground mt-2 text-sm leading-6">
                {text}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* Student call to action */}
      <section className="container pb-16 md:pb-20">
        <div className="bg-lilac border-border shadow-hard-lg grid gap-8 rounded-2xl border-2 p-6 sm:p-10 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div>
            <span className="eyebrow bg-card">
              <GraduationCap className="size-3.5" /> Untuk mahasiswa
            </span>
            <h2 className="mt-5 text-3xl font-extrabold tracking-tight text-balance text-white sm:text-4xl">
              Ubah keahlian kuliah menjadi penghasilan.
            </h2>
            <Button variant="secondary" size="lg" className="mt-7" asChild>
              <Link href="/register">
                Daftar sebagai freelancer <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
          </div>
          <ol className="bg-card border-border space-y-4 rounded-2xl border-2 p-5 sm:p-6">
            {["Daftar", "Verifikasi KTM", "Tawarkan jasa Anda"].map(
              (step, i) => (
                <li key={step} className="flex items-center gap-4">
                  <span className="bg-highlight border-border font-display shadow-hard-sm flex size-10 shrink-0 items-center justify-center rounded-xl border-2 font-extrabold">
                    {i + 1}
                  </span>
                  <span className="font-bold">{step}</span>
                </li>
              ),
            )}
          </ol>
        </div>
      </section>

      {/* Closing band */}
      <section className="bg-highlight border-border border-t-2">
        <div className="container flex flex-col items-start justify-between gap-6 py-14 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-extrabold tracking-widest uppercase">
              Siap memulai?
            </p>
            <h2 className="mt-2 max-w-xl text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">
              Wujudkan ide Anda bersama talenta mahasiswa.
            </h2>
          </div>
          <Button size="lg" asChild>
            <Link href="/register">
              Gabung dengan Projekin <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
