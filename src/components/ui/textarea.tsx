import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-input placeholder:text-muted-foreground bg-card aria-invalid:border-destructive aria-invalid:bg-danger-soft/40 shadow-hard-sm focus-visible:shadow-hard flex field-sizing-content min-h-20 w-full rounded-xl border-2 px-3 py-2 text-base font-medium transition-[box-shadow] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
