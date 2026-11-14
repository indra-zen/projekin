import Link from "next/link";
import { Brand } from "@/components/brand";

const linkClass =
  "text-foreground hover:text-primary rounded-md text-sm font-semibold underline-offset-4 hover:underline";

export function SiteFooter() {
  return (
    <footer className="bg-muted border-border border-t-2">
      <div className="container grid gap-10 py-10 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="max-w-sm space-y-4">
          <Brand />
          <p className="text-muted-foreground text-sm leading-6">
            Marketplace talenta mahasiswa. Temukan jasa, pasang pekerjaan, dan
            bayar dengan aman lewat Midtrans.
          </p>
        </div>
        <nav aria-label="Jelajahi">
          <p className="font-display text-base font-extrabold">Jelajahi</p>
          <ul className="mt-3 space-y-2">
            <li>
              <Link href="/services" className={linkClass}>
                Cari jasa
              </Link>
            </li>
            <li>
              <Link href="/jobs" className={linkClass}>
                Cari pekerjaan
              </Link>
            </li>
            <li>
              <Link href="/register" className={linkClass}>
                Daftar sebagai mahasiswa
              </Link>
            </li>
          </ul>
        </nav>
        <nav aria-label="Informasi hukum">
          <p className="font-display text-base font-extrabold">Informasi</p>
          <ul className="mt-3 space-y-2">
            <li>
              <Link href="/terms" className={linkClass}>
                Syarat &amp; Ketentuan
              </Link>
            </li>
            <li>
              <Link href="/privacy" className={linkClass}>
                Kebijakan Privasi
              </Link>
            </li>
          </ul>
        </nav>
      </div>
      <div className="border-border border-t-2">
        <div className="text-muted-foreground container flex flex-col gap-3 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Projekin. Dibangun untuk talenta mahasiswa.</p>
          <span className="sticker bg-highlight w-fit">
            Mode uji · Midtrans Sandbox
          </span>
        </div>
      </div>
    </footer>
  );
}
