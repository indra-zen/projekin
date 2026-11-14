import { Star } from "lucide-react";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const ratingFormatter = new Intl.NumberFormat("id-ID", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** Average and count from the rating views; renders nothing without reviews. */
export function RatingSummary({
  avg,
  count,
  className,
}: {
  avg: number | null;
  count: number | null;
  className?: string;
}) {
  if (!count) return null;
  const value = ratingFormatter.format(avg ?? 0);
  return (
    <span
      className={cn(
        "text-muted-foreground inline-flex items-center gap-1 text-sm",
        className,
      )}
    >
      <Star className="fill-highlight text-foreground size-4" aria-hidden />
      <span className="sr-only">Rating rata-rata</span>
      <span className="text-foreground font-semibold">{value}</span>
      <span>({count} ulasan)</span>
    </span>
  );
}

export type ReviewItem = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer: { username: string; full_name: string | null } | null;
};

/** Review cards. Comments are plain text (BR-26). */
export function ReviewList({ reviews }: { reviews: ReviewItem[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {reviews.map((review) => (
        <li
          key={review.id}
          className="bg-card border-border min-w-0 rounded-xl border-2 p-4"
        >
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="min-w-0 truncate font-semibold">
              {review.reviewer?.full_name ??
                `@${review.reviewer?.username ?? "pengguna"}`}
            </span>
            <span
              role="img"
              aria-label={`${review.rating} dari 5 bintang`}
              className="text-foreground shrink-0"
            >
              {"★".repeat(review.rating)}
              {/* Empty stars differ by shape, not by a faint colour. */}
              {"☆".repeat(Math.max(0, 5 - review.rating))}
            </span>
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            {formatDate(review.created_at)}
          </p>
          {review.comment ? (
            <p className="text-muted-foreground mt-2 text-sm leading-6 break-words whitespace-pre-wrap">
              {review.comment}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
