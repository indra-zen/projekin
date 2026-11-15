import type { Metadata } from "next";

/**
 * Link-preview defaults shared by the root layout and pages with their own
 * preview. A page's `openGraph`/`twitter` replaces the layout's instead of
 * merging with it, so those pages spread these back in.
 */
export const SITE_NAME = "Projekin";
export const SITE_TITLE = "Projekin — Talenta mahasiswa, hasil nyata";
export const SITE_DESCRIPTION =
  "Temukan talenta mahasiswa tepercaya untuk proyek Anda, atau ubah keahlian Anda menjadi penghasilan.";

/** app/opengraph-image.jpg (regenerate with scripts/og-image.mjs). */
export const SITE_PREVIEW_IMAGE = {
  url: "/opengraph-image.jpg",
  width: 1200,
  height: 630,
  type: "image/jpeg",
  alt: "Beranda Projekin: Proyek hebat dimulai dari orang yang tepat. Marketplace jasa mahasiswa terverifikasi.",
};

export const BASE_OPEN_GRAPH = {
  siteName: SITE_NAME,
  locale: "id_ID",
} satisfies Metadata["openGraph"];

/** Collapses whitespace and cuts at a word boundary, ending with "…". */
export function excerpt(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:–—-]+$/, "")}…`;
}
