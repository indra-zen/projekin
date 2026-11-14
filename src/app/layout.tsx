import type { Metadata } from "next";
import { Bricolage_Grotesque, Plus_Jakarta_Sans } from "next/font/google";
import "@/app/globals.css";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

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

export const metadata: Metadata = {
  title: {
    default: "Projekin — Talenta mahasiswa, hasil nyata",
    template: "%s — Projekin",
  },
  description:
    "Temukan talenta mahasiswa tepercaya untuk proyek Anda, atau ubah keahlian Anda menjadi penghasilan.",
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
