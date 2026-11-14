import { ArrowLeft, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Halaman tidak ditemukan" };

/** Indonesian 404 (PRD NFR-11) for unknown routes and `notFound()` calls. */
export default function NotFound() {
  return (
    <div className="container flex min-h-[60svh] items-center justify-center py-16">
      <div className="w-full max-w-lg text-center">
        <p
          aria-hidden
          className="font-display text-primary text-8xl leading-none font-extrabold tracking-tight sm:text-9xl"
        >
          4<span className="text-accent">0</span>4
        </p>
        <span className="eyebrow mt-6">Tidak ditemukan</span>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-balance">
          Halaman yang Anda cari tidak ada.
        </h1>
        <p className="text-muted-foreground mt-3 leading-7">
          Tautannya mungkin salah, atau halamannya sudah dipindahkan.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild>
            <Link href="/">
              <ArrowLeft className="mr-2 size-4" /> Ke beranda
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/services">
              <Search className="mr-2 size-4" /> Cari jasa
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
