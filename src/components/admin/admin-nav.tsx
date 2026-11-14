"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links: { href: Route; label: string }[] = [
  { href: "/admin", label: "Ringkasan" },
  { href: "/admin/verifications", label: "Verifikasi" },
  { href: "/admin/disputes" as Route, label: "Sengketa" },
  { href: "/admin/refunds" as Route, label: "Pengembalian dana" },
  { href: "/admin/payouts" as Route, label: "Pencairan" },
  { href: "/admin/moderation" as Route, label: "Moderasi" },
  { href: "/admin/universities" as Route, label: "Kampus" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navigasi admin"
      className="bg-card border-border shadow-hard-sm rounded-2xl border-2"
    >
      <ul className="flex flex-wrap gap-2 p-2">
        {links.map(({ href, label }) => {
          const active =
            href === "/admin" ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 items-center rounded-xl border-2 px-3.5 text-sm font-bold whitespace-nowrap transition-colors",
                  active
                    ? "bg-highlight border-border shadow-hard-sm"
                    : "hover:bg-highlight/60 hover:border-border border-transparent",
                )}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
