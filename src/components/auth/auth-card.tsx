import type * as React from "react";
import { Brand } from "@/components/brand";

export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="relative isolate overflow-hidden">
      {/* Decorative shapes echoing the reference's soft background blobs. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="bg-lilac/25 absolute -top-24 -left-20 size-72 rounded-full" />
        <div className="bg-secondary/40 absolute top-1/3 -right-16 size-56 rounded-full" />
        <div className="bg-accent/25 absolute -bottom-16 left-1/4 size-40 rounded-full" />
        <div className="absolute top-10 right-[12%] hidden h-28 w-28 [background-image:radial-gradient(var(--foreground)_1.5px,transparent_1.5px)] [background-size:14px_14px] opacity-20 sm:block" />
      </div>
      <div className="container flex min-h-[calc(100svh-9rem)] items-center justify-center py-12 sm:py-16">
        <div className="w-full max-w-md">
          <div className="mb-8 flex justify-center">
            <Brand />
          </div>
          <div className="bg-card border-border shadow-hard-lg rounded-2xl border-2 p-6 sm:p-9">
            <h1 className="font-display text-3xl font-extrabold tracking-tight">
              {title}
            </h1>
            {description ? (
              <p className="text-muted-foreground mt-2 text-sm leading-6">
                {description}
              </p>
            ) : null}
            <div className="mt-7">{children}</div>
            {footer ? (
              <div className="text-muted-foreground border-hairline mt-7 border-t pt-5 text-center text-sm">
                {footer}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
