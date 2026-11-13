"use client";

import {
  BadgeCheck,
  BriefcaseBusiness,
  LayoutDashboard,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items: { href: Route; label: string; icon: typeof LayoutDashboard }[] = [
  { href: "/dashboard", label: "Ringkasan", icon: LayoutDashboard },
  {
    href: "/dashboard/settings/profile",
    label: "Profil saya",
    icon: UserRound,
  },
  {
    href: "/dashboard/verification",
    label: "Verifikasi mahasiswa",
    icon: BadgeCheck,
  },
  {
    href: "/dashboard/freelancer",
    label: "Profil freelancer",
    icon: BriefcaseBusiness,
  },
];

export function DashboardNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const all = isAdmin
    ? [
        ...items,
        {
          href: "/admin/verifications" as Route,
          label: "Admin: verifikasi",
          icon: ShieldCheck,
        },
      ]
    : items;

  return (
    <nav
      aria-label="Navigasi dasbor"
      className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0"
    >
      <ul className="flex gap-2 md:flex-col md:gap-1">
        {all.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/dashboard"
              ? pathname === href
              : pathname.startsWith(href);
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                  active
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
