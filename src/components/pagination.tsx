import { ArrowLeft, ArrowRight } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Previous / next page links for server-paginated lists. */
export function Pagination({
  page,
  totalPages,
  prevHref,
  nextHref,
}: {
  page: number;
  totalPages: number;
  prevHref: Route | null;
  nextHref: Route | null;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav
      className="mt-10 flex items-center justify-between gap-3"
      aria-label="Halaman"
    >
      {prevHref ? (
        <Button variant="outline" asChild>
          <Link href={prevHref} rel="prev">
            <ArrowLeft className="mr-2 size-4" /> Sebelumnya
          </Link>
        </Button>
      ) : (
        <span />
      )}
      <span className="sticker bg-card" aria-current="page">
        Halaman {page} dari {totalPages}
      </span>
      {nextHref ? (
        <Button variant="outline" asChild>
          <Link href={nextHref} rel="next">
            Berikutnya <ArrowRight className="ml-2 size-4" />
          </Link>
        </Button>
      ) : (
        <span />
      )}
    </nav>
  );
}
