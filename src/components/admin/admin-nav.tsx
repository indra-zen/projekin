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
    <nav aria-label="Navigasi admin" className="-mx-4 overflow-x-auto px-4">
      <ul className="flex gap-2">
        {links.map(({ href, label }) => {
          const active =
            href === "/admin" ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 items-center rounded-full border px-4 text-sm font-medium whitespace-nowrap",
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "hover:bg-muted",
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
