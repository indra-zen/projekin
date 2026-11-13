"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";

const links = [
  { href: "/services", label: "Browse services" },
  { href: "/jobs", label: "Find jobs" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="border-border/70 bg-background/90 border-b backdrop-blur-md">
      <div className="container flex h-18 items-center justify-between">
        <Brand />
        <nav
          className="hidden items-center gap-8 md:flex"
          aria-label="Main navigation"
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
        <div className="hidden items-center gap-3 md:flex">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/login">Log in</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/register">Get started</Link>
          </Button>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setOpen(!open)}
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X /> : <Menu />}
        </Button>
      </div>
      {open && (
        <nav
          className="border-border/70 container flex flex-col gap-2 border-t py-4 md:hidden"
          aria-label="Mobile navigation"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="hover:bg-muted rounded-lg px-3 py-2 text-sm font-medium"
            >
              {link.label}
            </Link>
          ))}
          <div className="border-border/70 mt-2 flex gap-2 border-t pt-4">
            <Button variant="outline" className="flex-1" asChild>
              <Link href="/login">Log in</Link>
            </Button>
            <Button className="flex-1" asChild>
              <Link href="/register">Get started</Link>
            </Button>
          </div>
        </nav>
      )}
    </header>
  );
}
