"use client";

import { ErrorView } from "@/components/error-view";

export default function RootError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <div className="container flex min-h-[60svh] items-center justify-center py-16">
      <ErrorView error={error} retry={retry} />
    </div>
  );
}
