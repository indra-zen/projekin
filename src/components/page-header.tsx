import type * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Full-width lilac band with the eyebrow sticker, display title and lead.
 * Children (for example a search form) sit inside the band under the title.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  children,
  className,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "border-border bg-lilac/25 relative overflow-hidden border-b-2",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute top-6 right-[6%] hidden size-32 [background-image:radial-gradient(var(--foreground)_1.5px,transparent_1.5px)] [background-size:14px_14px] opacity-20 md:block"
      />
      <div className="relative container py-10 md:py-14">
        <div className="max-w-3xl">
          <span className="eyebrow">{eyebrow}</span>
          <h1 className="mt-4 text-3xl leading-[1.08] font-extrabold tracking-tight text-balance sm:text-4xl md:text-5xl">
            {title}
          </h1>
          {description ? (
            <p className="text-muted-foreground mt-4 text-base leading-7 text-pretty md:text-lg">
              {description}
            </p>
          ) : null}
        </div>
        {children ? <div className="mt-8">{children}</div> : null}
      </div>
    </section>
  );
}
