import * as React from "react";
import { cn } from "@/lib/utils";

// Chevron as a CSS background so the control stays a plain native <select>
// (works without client JS). Needs `img-src data:` once the full CSP ships.
const chevron =
  "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='%2317130F' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3.5 6l4.5 4.5L12.5 6'/%3E%3C/svg%3E\")] bg-[length:1rem_1rem] bg-[position:right_0.75rem_center] bg-no-repeat";

/** Native `<select>` styled to match Input. Same props as a plain select. */
function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        "border-input bg-card shadow-hard-sm focus-visible:shadow-hard aria-invalid:border-destructive aria-invalid:bg-danger-soft/40 h-11 w-full min-w-0 appearance-none rounded-xl border-2 py-1 pr-10 pl-3 text-base font-medium transition-[box-shadow] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none md:text-sm",
        chevron,
        className,
      )}
      {...props}
    />
  );
}

export { NativeSelect };
