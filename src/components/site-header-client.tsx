"use client";

import { LayoutDashboard, LogOut, Menu, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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

const chip =
  "inline-flex items-center gap-2 rounded-xl border-2 px-3 py-1.5 text-sm font-bold whitespace-nowrap transition-colors";
const chipIdle = "border-transparent hover:border-border hover:bg-highlight/60";
const chipActive = "border-border bg-highlight shadow-hard-sm";

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
  const pathname = usePathname();
  const close = () => setOpen(false);
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="bg-card border-border border-b-2">
      <div className="container flex h-18 items-center justify-between gap-4">
        <Brand />
        <nav
          className="hidden items-center gap-2 md:flex"
          aria-label="Navigasi utama"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href) ? "page" : undefined}
              className={cn(chip, isActive(link.href) ? chipActive : chipIdle)}
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
                  <Link href="/admin">
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
          variant="outline"
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
        <div className="border-border bg-background border-t-2 md:hidden">
          <nav
            className="container flex flex-col gap-2 py-4"
            aria-label="Navigasi seluler"
          >
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={close}
                aria-current={isActive(link.href) ? "page" : undefined}
                className={cn(
                  chip,
                  "py-2.5",
                  isActive(link.href) ? chipActive : "bg-card border-border",
                )}
              >
                {link.label}
              </Link>
            ))}
            <div className="border-hairline mt-2 flex flex-col gap-2 border-t pt-4">
              {viewer ? (
                <>
                  <Link
                    href="/dashboard"
                    onClick={close}
                    className={cn(chip, "bg-card border-border py-2.5")}
                  >
                    <LayoutDashboard className="size-4" /> Dasbor
                  </Link>
                  {viewer.isAdmin ? (
                    <Link
                      href="/admin"
                      onClick={close}
                      className={cn(chip, "bg-card border-border py-2.5")}
                    >
                      <ShieldCheck className="size-4" /> Admin
                    </Link>
                  ) : null}
                  <LogoutButton />
                </>
              ) : (
                <div className="flex gap-3">
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
        </div>
      )}
    </header>
  );
}
