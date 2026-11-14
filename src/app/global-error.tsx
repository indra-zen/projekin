"use client";

import "@/app/globals.css";
import { Brand } from "@/components/brand";
import { ErrorView } from "@/components/error-view";

/**
 * Last-resort boundary for errors in the root layout itself (for example the
 * site header failing to read the session). It replaces the whole document,
 * so it brings its own <html>, <body> and stylesheet.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <html lang="id">
      <body className="antialiased">
        <title>Terjadi kesalahan — Projekin</title>
        <main className="container flex min-h-svh flex-col items-center justify-center gap-8 py-16">
          <Brand />
          <ErrorView error={error} retry={retry} />
        </main>
      </body>
    </html>
  );
}
