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

type PreviewImage = {
  url: string;
  alt: string;
  width?: number;
  height?: number;
  type?: string;
};

/**
 * Title, description and link preview for a page with its own content
 * (service, job, profile). `square` is for a portrait-like picture such as an
 * avatar: platforms then show a small thumbnail beside the text instead of a
 * wide banner. `profileUsername` marks the page as an Open Graph profile.
 */
export function pagePreview({
  title,
  description,
  image = SITE_PREVIEW_IMAGE,
  square = false,
  profileUsername,
}: {
  title: string;
  description: string;
  image?: PreviewImage;
  square?: boolean;
  profileUsername?: string;
}): Metadata {
  const shared = { ...BASE_OPEN_GRAPH, title, description, images: [image] };
  return {
    title,
    description,
    openGraph: profileUsername
      ? { ...shared, type: "profile", username: profileUsername }
      : { ...shared, type: "website" },
    twitter: {
      card: square ? "summary" : "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

/**
 * "fact · fact · fact. Text. More text…" in at most 200 characters: the key
 * facts first (what fits in the shortest previews), then free text.
 */
export function previewDescription(
  facts: (string | null | undefined | false)[],
  ...texts: (string | null | undefined)[]
): string {
  const parts = [facts.filter(Boolean).join(" · "), ...texts]
    .map((part) => (part ?? "").replace(/\s+/g, " ").replace(/[\s.]+$/, ""))
    .filter(Boolean);
  return excerpt(parts.join(". "), 200);
}

/** Collapses whitespace and cuts at a word boundary, ending with "…". */
export function excerpt(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:–—-]+$/, "")}…`;
}
