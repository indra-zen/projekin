import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Teach tailwind-merge the design tokens from globals.css, otherwise e.g.
// `shadow-hard` would not replace `shadow-sm` and `bg-highlight` would not
// replace `bg-card` (docs/DESIGN_SYSTEM.md §4.1).
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      color: ["lilac", "highlight", "success", "danger-soft", "hairline"],
      shadow: ["hard-sm", "hard", "hard-lg", "ledge"],
      font: ["display"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
