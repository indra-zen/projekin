"use client";

import {
  BadgeCheck,
  BriefcaseBusiness,
  ClipboardList,
  FileText,
  Images,
  LayoutDashboard,
  Megaphone,
  ShieldCheck,
  Store,
  UserRound,
  Wallet,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
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
  {
    href: "/dashboard/services" as Route,
    label: "Layanan saya",
    icon: Store,
  },
  {
    href: "/dashboard/portfolio" as Route,
    label: "Portofolio",
    icon: Images,
  },
  { href: "/dashboard/jobs", label: "Lowongan saya", icon: Megaphone },
  { href: "/dashboard/proposals", label: "Proposal saya", icon: FileText },
  { href: "/dashboard/orders", label: "Pesanan", icon: ClipboardList },
  {
    href: "/dashboard/earnings" as Route,
    label: "Pendapatan",
    icon: Wallet,
  },
];

export function DashboardNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const all = isAdmin
    ? [
        ...items,
        {
          href: "/admin" as Route,
          label: "Admin",
          icon: ShieldCheck,
        },
      ]
    : items;

  // On mobile the rail scrolls sideways; keep the current page in view.
  useEffect(() => {
    const rail = navRef.current?.querySelector("ul");
    const current = rail?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!rail || !current) return;
    rail.scrollLeft = Math.max(
      0,
      current.offsetLeft - (rail.clientWidth - current.offsetWidth) / 2,
    );
  }, [pathname]);

  return (
    <nav
      ref={navRef}
      aria-label="Navigasi dasbor"
      className="bg-primary border-border shadow-hard lg:bg-card rounded-2xl border-2 lg:p-2"
    >
      <ul className="flex gap-1.5 overflow-x-auto p-2 lg:flex-col lg:gap-1 lg:overflow-visible lg:p-0">
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
                  "flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm font-bold whitespace-nowrap transition-colors",
                  active
                    ? "bg-highlight border-border text-foreground shadow-hard-sm"
                    : "text-primary-foreground hover:bg-primary-foreground/15 lg:text-foreground lg:hover:bg-highlight/60 lg:hover:border-border border-transparent",
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
