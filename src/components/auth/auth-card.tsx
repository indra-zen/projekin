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
    <div className="container flex min-h-[calc(100vh-9rem)] items-center justify-center py-12 sm:py-16">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Brand />
        </div>
        <div className="bg-card rounded-3xl border p-6 shadow-sm sm:p-9">
          <h1 className="text-2xl font-bold">{title}</h1>
          {description ? (
            <p className="text-muted-foreground mt-2 text-sm">{description}</p>
          ) : null}
          <div className="mt-7">{children}</div>
          {footer ? (
            <div className="text-muted-foreground mt-7 text-center text-sm">
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
