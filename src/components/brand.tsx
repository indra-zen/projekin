import Link from "next/link";

export function Brand() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2.5"
      aria-label="Projekin home"
    >
      <span className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-xl text-lg font-black">
        P
      </span>
      <span className="text-foreground text-xl font-bold tracking-tight">
        projekin<span className="text-primary">.</span>
      </span>
    </Link>
  );
}
