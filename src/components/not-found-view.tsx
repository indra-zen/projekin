import { ArrowLeft, Search } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Shared body of the `not-found.tsx` pages (PRD NFR-11, ARCHITECTURE §11.1). */
export function NotFoundView({
  title = "Halaman yang Anda cari tidak ada.",
  description = "Tautannya mungkin salah, atau halamannya sudah dipindahkan.",
  backHref = "/",
  backLabel = "Ke beranda",
}: {
  title?: string;
  description?: string;
  backHref?: Route;
  backLabel?: string;
}) {
  return (
    <div className="mx-auto w-full max-w-lg text-center">
      <p
        aria-hidden
        className="font-display text-primary text-8xl leading-none font-extrabold tracking-tight sm:text-9xl"
      >
        4<span className="text-accent">0</span>4
      </p>
      <span className="eyebrow mt-6">Tidak ditemukan</span>
      <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-balance">
        {title}
      </h1>
      <p className="text-muted-foreground mt-3 leading-7">{description}</p>
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <Button asChild>
          <Link href={backHref}>
            <ArrowLeft className="mr-2 size-4" /> {backLabel}
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/services">
            <Search className="mr-2 size-4" /> Cari jasa
          </Link>
        </Button>
      </div>
    </div>
  );
}
