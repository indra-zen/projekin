import type { Metadata } from "next";
import { Bricolage_Grotesque, Plus_Jakarta_Sans } from "next/font/google";
import "@/app/globals.css";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { env } from "@/lib/env";

const font = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
});

// Display face for headings (docs/DESIGN_SYSTEM.md §4). Self-hosted at build.
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
  // Optical size: letterforms tighten at large sizes, which keeps hero
  // headings from wrapping an extra line.
  axes: ["opsz"],
});

const siteTitle = "Projekin — Talenta mahasiswa, hasil nyata";
const siteDescription =
  "Temukan talenta mahasiswa tepercaya untuk proyek Anda, atau ubah keahlian Anda menjadi penghasilan.";

export const metadata: Metadata = {
  // Absolute URLs for the link-preview image. Without NEXT_PUBLIC_SITE_URL,
  // Next.js uses the Vercel production domain (or localhost in development).
  metadataBase: env.NEXT_PUBLIC_SITE_URL
    ? new URL(env.NEXT_PUBLIC_SITE_URL)
    : undefined,
  applicationName: "Projekin",
  title: {
    default: siteTitle,
    template: "%s — Projekin",
  },
  description: siteDescription,
  // Link previews (WhatsApp, Facebook, X, LinkedIn, Telegram). The picture is
  // app/opengraph-image.jpg (regenerate with scripts/og-image.mjs). No og:url:
  // pages inherit this block, and a fixed og:url would make every shared page
  // point at the home page.
  openGraph: {
    type: "website",
    siteName: "Projekin",
    locale: "id_ID",
    title: siteTitle,
    description: siteDescription,
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" className={`${font.variable} ${display.variable}`}>
      <body className="antialiased">
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
