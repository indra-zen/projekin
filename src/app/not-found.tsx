import type { Metadata } from "next";
import { NotFoundView } from "@/components/not-found-view";

export const metadata: Metadata = { title: "Halaman tidak ditemukan" };

/** Indonesian 404 (PRD NFR-11) for unknown routes and `notFound()` calls. */
export default function NotFound() {
  return (
    <div className="container flex min-h-[60svh] items-center justify-center py-16">
      <NotFoundView />
    </div>
  );
}
