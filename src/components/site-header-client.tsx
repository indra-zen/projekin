"use client";

import { LayoutDashboard, LogOut, Menu, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/server/actions/auth";

const links = [
  { href: "/services", label: "Cari jasa" },
  { href: "/jobs", label: "Cari pekerjaan" },
] as const;

export type HeaderViewer = {
  displayName: string;
  avatar: React.ReactNode;
  isAdmin: boolean;
} | null;

function LogoutButton({ className }: { className?: string }) {
  return (
    <form action={logoutAction} className={className}>
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        className="w-full justify-start md:w-auto"
      >
        <LogOut className="mr-2 size-4" /> Keluar
      </Button>
    </form>
  );
}

export function SiteHeaderClient({ viewer }: { viewer: HeaderViewer }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <header className="border-border/70 bg-background/90 border-b backdrop-blur-md">
      <div className="container flex h-18 items-center justify-between gap-4">
        <Brand />
        <nav
          className="hidden items-center gap-8 md:flex"
          aria-label="Navigasi utama"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          {viewer ? (
            <>
              {viewer.isAdmin ? (
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/admin/verifications">
                    <ShieldCheck className="mr-2 size-4" /> Admin
                  </Link>
                </Button>
              ) : null}
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard" className="gap-2">
                  {viewer.avatar}
                  <span className="max-w-40 truncate">
                    {viewer.displayName}
                  </span>
                </Link>
              </Button>
              <LogoutButton />
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">Masuk</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/register">Daftar</Link>
              </Button>
            </>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setOpen(!open)}
          aria-label={open ? "Tutup menu" : "Buka menu"}
          aria-expanded={open}
        >
          {open ? <X /> : <Menu />}
        </Button>
      </div>
      {open && (
        <nav
          className="border-border/70 container flex flex-col gap-2 border-t py-4 md:hidden"
          aria-label="Navigasi seluler"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={close}
              className="hover:bg-muted rounded-lg px-3 py-2 text-sm font-medium"
            >
              {link.label}
            </Link>
          ))}
          <div className="border-border/70 mt-2 flex flex-col gap-2 border-t pt-4">
            {viewer ? (
              <>
                <Link
                  href="/dashboard"
                  onClick={close}
                  className="hover:bg-muted flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
                >
                  <LayoutDashboard className="size-4" /> Dasbor
                </Link>
                {viewer.isAdmin ? (
                  <Link
                    href="/admin/verifications"
                    onClick={close}
                    className="hover:bg-muted flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
                  >
                    <ShieldCheck className="size-4" /> Admin
                  </Link>
                ) : null}
                <LogoutButton />
              </>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" asChild>
                  <Link href="/login" onClick={close}>
                    Masuk
                  </Link>
                </Button>
                <Button className="flex-1" asChild>
                  <Link href="/register" onClick={close}>
                    Daftar
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
