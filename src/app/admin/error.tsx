"use client";

import { ErrorView } from "@/components/error-view";

/** Errors in an admin page keep the admin navigation (ARCHITECTURE §11.1). */
export default function AdminError({
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
        homeHref="/admin"
        homeLabel="Ke ringkasan admin"
      />
    </div>
  );
}
