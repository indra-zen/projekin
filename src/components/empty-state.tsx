import type { LucideIcon } from "lucide-react";
import type * as React from "react";
import { cn } from "@/lib/utils";

/** Dashed, outlined placeholder for empty and failed lists. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-border bg-card/60 flex flex-col items-center rounded-2xl border-2 border-dashed px-6 py-14 text-center",
        className,
      )}
    >
      {Icon ? (
        <span className="bg-secondary border-border shadow-hard-sm mb-5 flex size-14 items-center justify-center rounded-xl border-2">
          <Icon className="size-7" aria-hidden />
        </span>
      ) : null}
      <h2 className="text-xl font-bold">{title}</h2>
      {description ? (
        <p className="text-muted-foreground mt-2 max-w-md">{description}</p>
      ) : null}
      {children ? <div className="mt-6">{children}</div> : null}
    </div>
  );
}
