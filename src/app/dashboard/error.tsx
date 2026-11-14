"use client";

import { ErrorView } from "@/components/error-view";

/** Errors in a dashboard page keep the dashboard navigation (ARCHITECTURE §11.1). */
export default function DashboardError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <div className="py-8">
      <ErrorView
        error={error}
        retry={retry}
        homeHref="/dashboard"
        homeLabel="Ke dasbor"
      />
    </div>
  );
}
