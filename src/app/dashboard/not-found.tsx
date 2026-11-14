import type { Metadata } from "next";
import { NotFoundView } from "@/components/not-found-view";

export const metadata: Metadata = { title: "Data tidak ditemukan" };

/** `notFound()` inside the dashboard keeps the dashboard navigation. */
export default function DashboardNotFound() {
  return (
    <div className="py-8">
      <NotFoundView
        title="Data yang Anda cari tidak ada."
        description="Data ini mungkin sudah dihapus, atau bukan milik akun Anda."
        backHref="/dashboard"
        backLabel="Ke dasbor"
      />
    </div>
  );
}
