import { cn } from "@/lib/utils";

/** Route-level loading placeholder shared by the marketplace listings. */
export function ListingSkeleton({ variant }: { variant: "cards" | "rows" }) {
  const block = "bg-muted motion-safe:animate-pulse";
  return (
    <div role="status" aria-label="Memuat">
      <div className="border-border bg-lilac/25 border-b-2">
        <div className="container py-10 md:py-14">
          <div className={cn(block, "h-6 w-32 rounded-full")} />
          <div className={cn(block, "mt-4 h-12 w-full max-w-xl rounded-xl")} />
          <div className="bg-card border-border mt-8 h-28 rounded-2xl border-2 sm:h-20" />
        </div>
      </div>
      <div className="container py-10 md:py-14">
        <div
          className={
            variant === "cards"
              ? "grid gap-x-6 gap-y-9 sm:grid-cols-2 lg:grid-cols-3"
              : "grid gap-y-8"
          }
        >
          {Array.from({ length: variant === "cards" ? 6 : 4 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "bg-card border-border rounded-2xl border-2",
                variant === "cards" ? "h-80" : "h-44",
              )}
            >
              <div
                className={cn(
                  block,
                  variant === "cards"
                    ? "aspect-[16/10] rounded-t-[14px]"
                    : "m-5 h-6 w-1/3 rounded-full",
                )}
              />
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">Memuat…</span>
    </div>
  );
}
