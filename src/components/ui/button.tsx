import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Neo-Brutalism button (docs/DESIGN_SYSTEM.md §3, §6): 2px ink outline, hard
 * diagonal shadow, lifts on hover and presses into its shadow when active.
 */
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center whitespace-nowrap rounded-xl border-2 border-border text-sm font-bold",
    "shadow-hard transition-[transform,box-shadow,background-color] duration-100",
    "motion-safe:hover:-translate-x-px motion-safe:hover:-translate-y-px hover:shadow-[5px_5px_0_0_var(--foreground)]",
    "motion-safe:active:translate-x-0.5 motion-safe:active:translate-y-0.5 active:shadow-none",
    "disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none",
    "aria-disabled:pointer-events-none aria-disabled:opacity-50 aria-disabled:shadow-none",
  ],
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/85",
        accent: "bg-accent text-accent-foreground hover:bg-accent/85",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "bg-card text-foreground hover:bg-highlight/50",
        ghost:
          "border-transparent bg-transparent shadow-none hover:bg-highlight/60 hover:border-border hover:shadow-none motion-safe:hover:translate-x-0 motion-safe:hover:translate-y-0",
      },
      size: {
        default: "h-11 px-5",
        sm: "h-9 px-4 text-xs",
        lg: "h-13 px-7 text-base",
        icon: "size-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
