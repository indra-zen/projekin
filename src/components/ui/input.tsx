import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "border-input selection:bg-primary selection:text-primary-foreground file:text-foreground placeholder:text-muted-foreground bg-card shadow-hard-sm h-11 w-full min-w-0 rounded-xl border-2 px-3 py-1 text-base font-medium transition-[box-shadow] file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-bold disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none md:text-sm",
        "focus-visible:shadow-hard",
        "aria-invalid:border-destructive aria-invalid:bg-danger-soft/40",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
