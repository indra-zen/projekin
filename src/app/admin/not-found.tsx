import type { Metadata } from "next";
import { NotFoundView } from "@/components/not-found-view";

export const metadata: Metadata = { title: "Data tidak ditemukan" };

/**
 * `notFound()` inside an admin page keeps the admin navigation. Non-admins
 * never see this: the admin layout's own `notFound()` is handled by the root
 * boundary, outside the admin layout.
 */
export default function AdminNotFound() {
  return (
    <div className="py-8">
      <NotFoundView
        title="Data yang Anda cari tidak ada."
        description="Pengajuan atau data ini mungkin sudah diproses atau dihapus."
        backHref="/admin"
        backLabel="Ke ringkasan admin"
      />
    </div>
  );
}
