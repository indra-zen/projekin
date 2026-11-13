import type { Metadata } from "next";

export const metadata: Metadata = { title: "Syarat & Ketentuan" };

export default function Page() {
  return (
    <div className="container max-w-3xl py-12 md:py-16">
      <h1 className="text-3xl font-extrabold tracking-tight">
        Syarat & Ketentuan
      </h1>
      <div className="bg-muted/40 text-muted-foreground mt-6 rounded-2xl border border-dashed p-6 text-sm leading-6">
        Dokumen ini sedang disiapkan oleh tim Projekin dan akan dipublikasikan
        sebelum peluncuran. Hubungi tim Projekin jika Anda memiliki pertanyaan.
      </div>
    </div>
  );
}
