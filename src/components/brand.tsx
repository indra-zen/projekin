import Link from "next/link";

export function Brand() {
  return (
    <Link
      href="/"
      className="group flex items-center gap-2.5 rounded-xl"
      aria-label="Beranda Projekin"
    >
      <span className="bg-primary text-primary-foreground border-border shadow-hard-sm flex size-9 -rotate-3 items-center justify-center rounded-xl border-2 text-lg font-extrabold transition-transform motion-safe:group-hover:rotate-3">
        P
      </span>
      <span className="font-display text-foreground text-xl font-extrabold tracking-tight">
        projekin
        <span aria-hidden className="text-accent">
          .
        </span>
      </span>
    </Link>
  );
}
