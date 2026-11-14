"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/** The id Next.js attaches to server errors, matching the server log line. */
function digestOf(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "digest" in error) {
    const digest = (error as { digest?: unknown }).digest;
    return typeof digest === "string" ? digest : undefined;
  }
  return undefined;
}

/**
 * Shared body of the `error.tsx` boundaries (ARCHITECTURE §11.1). Server
 * errors reach the client with a generic message and a digest only, so
 * nothing sensitive is shown; the digest lets an admin find the log line.
 */
export function ErrorView({
  error,
  retry,
  homeHref = "/",
  homeLabel = "Ke beranda",
}: {
  error: unknown;
  retry: () => void;
  homeHref?: Route;
  homeLabel?: string;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const digest = digestOf(error);

  return (
    <div
      role="alert"
      className="bg-card border-border shadow-ledge mx-auto w-full max-w-xl rounded-2xl border-2 p-6 text-center [--ledge:var(--accent)] sm:p-10"
    >
      <span className="bg-accent border-border shadow-hard-sm mx-auto flex size-14 items-center justify-center rounded-xl border-2">
        <AlertTriangle className="size-7" aria-hidden />
      </span>
      <span className="eyebrow mt-6">Terjadi kesalahan</span>
      <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-balance sm:text-3xl">
        Maaf, halaman ini gagal dimuat.
      </h1>
      <p className="text-muted-foreground mt-3 leading-7">
        Coba lagi sebentar lagi. Jika masalah berlanjut, hubungi admin Projekin
        dan sebutkan kode di bawah.
      </p>
      {digest ? (
        <p className="sticker bg-muted mt-4 font-mono">Kode: {digest}</p>
      ) : null}
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <Button type="button" onClick={() => retry()}>
          <RotateCcw className="mr-2 size-4" aria-hidden /> Coba lagi
        </Button>
        <Button variant="outline" asChild>
          <Link href={homeHref}>{homeLabel}</Link>
        </Button>
      </div>
    </div>
  );
}
