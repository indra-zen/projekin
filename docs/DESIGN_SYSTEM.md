# Projekin — Design System (Neo-Brutalism)

| | |
|---|---|
| Status | Approved by the product owner (2026-11-14); implementation in progress on `feature/neo-brutal-ui` |
| Version | 1.0 (2026-11-14) |
| Related | [ARCHITECTURE.md §3](ARCHITECTURE.md#3-technology-stack), [IMPLEMENTATION_PLAN.md §0](IMPLEMENTATION_PLAN.md#0-implementation-status), [PRD.md NFR-06](PRD.md) |
| References | [`design-references/`](design-references/) — `reference-2.png` is the **primary** inspiration; `reference-1.png` and `reference-3.png` are secondary |

This document is the single source of truth for Projekin's visual language. Both agents (Claude Code and GitHub Copilot) follow it. Change it here first when a design decision changes, then record the change in the [decision log](IMPLEMENTATION_PLAN.md#64-decision-log).

---

## 1. Principles

1. **Playful, outlined, tactile.** Lavender backgrounds, off-white surfaces, 2 px ink outlines, hard (unblurred) shadows, rounded corners.
2. **Restyle, don't rebuild.** Only presentation changes. Component APIs (props, variant names, `data-slot`s), routes, Server Actions, validation, Supabase access, auth and payment logic stay exactly as they are. New variants and components are additive.
3. **Tokens over literals.** Pages use semantic tokens (`bg-card`, `text-primary`, `shadow-hard`), never raw palette classes (`bg-amber-50`) or hex values.
4. **Primitives carry the style.** The look lives in `src/components/ui/*` and a few shared components. Pages should need few or no style overrides.
5. **Accessible by default.** WCAG 2.1 AA (PRD NFR-06): every text/background pair in §2 is measured; focus is always visible; motion respects `prefers-reduced-motion`.
6. **No new dependencies.** Everything is built with Tailwind v4 `@theme` tokens, CSS, and `next/font`.
7. **Light only.** There is no dark mode. Pages set `color-scheme: light`, and `globals.css` redefines the `dark` variant as `.dark` (a class nothing sets), because Tailwind v4's default `dark:` follows the OS setting and would have tinted inputs through `dark:bg-input/30`. The remaining `dark:` classes are inert.

---

## 2. Colour tokens

Defined as CSS variables on `:root` in [`src/app/globals.css`](../src/app/globals.css) and exposed to Tailwind through `@theme inline` (`--color-*`). The shadcn variable names are kept so existing classes keep working.

| Token | Value | Tailwind | Use | Contrast (WCAG) |
|---|---|---|---|---|
| `--background` | `#F1ECF8` | `bg-background` | Page background (lavender) | ink 15.9 |
| `--card` | `#FFFEFA` | `bg-card` | Cards, inputs, header, panels | ink 18.3 |
| `--foreground` | `#17130F` | `text-foreground` | Body text ("ink") | — |
| `--border` | `#17130F` | `border-border` | Outlines of cards, buttons, inputs, badges | — |
| `--input` | `#17130F` | `border-input` | Form control outlines | — |
| `--hairline` *(new)* | `rgb(23 19 15 / 0.14)` | `border-hairline`, `divide-hairline` | Dividers **inside** a component (list rows, table rows, section rules) | decorative |
| `--primary` | `#7B4FB8` | `bg-primary`, `text-primary` | Primary buttons, links, focus outline, active accents | white 5.75; as text: 5.70 on surface, 4.95 on background |
| `--primary-foreground` | `#FFFFFF` | | Text on primary | — |
| `--lilac` *(new)* | `#9165C7` | `bg-lilac` | The brand purple for **large fills only**: mobile nav rail, hero/CTA bands, icon tiles | white 4.29 → **only** bold text ≥ 18.66 px (or icons, which need 3:1) |
| `--secondary` | `#FFB86B` | `bg-secondary` | Orange buttons, icon buttons, warm accents | ink 10.8 |
| `--secondary-foreground` | `#17130F` | | Text on secondary | — |
| `--accent` | `#F56B9A` | `bg-accent` | Pink highlights, ledges, stickers | ink 6.56 — **never white text** (2.82) |
| `--accent-foreground` | `#17130F` | | Text on accent | — |
| `--highlight` *(new)* | `#FFE27A` | `bg-highlight` | Active nav tile, eyebrow stickers, tab underline marker, warning tone | ink 14.4 |
| `--success` *(new)* | `#C9F2C7` | `bg-success` | Positive status fill, success alerts | ink 15.0 |
| `--muted` | `#E9E1F4` | `bg-muted` | Quiet fills, skeletons, neutral status | ink 14.6; muted-foreground 5.55 |
| `--muted-foreground` | `#5E5569` | `text-muted-foreground` | Secondary text | 6.07 on background, 6.98 on surface |
| `--destructive` | `#C4253F` | `text-destructive`, `bg-destructive` | Errors, destructive actions | 5.65 on surface; white 5.70 |
| `--destructive-foreground` | `#FFFFFF` | | Text on destructive | — |
| `--danger-soft` *(new)* | `#FFD6E2` | `bg-danger-soft` | Negative status fill, error alert background. Text on it is **ink**; `destructive` only for icons and borders | ink 14.1; destructive 4.34 (fails AA for text) |
| `--ring` | `#7B4FB8` | `outline-ring` | Focus outline | — |

**Rules**

- Ink text on every pastel (`secondary`, `accent`, `highlight`, `success`, `muted`, `danger-soft`).
- White text only on `primary` and `destructive`, and on `lilac` only at bold ≥ 18.66 px.
- The global `* { border-color: var(--border) }` rule makes any bare `border`/`divide-*` an **ink** line. Use `border-hairline` / `divide-hairline` for internal dividers.

### 2.1 Status tones

`StatusBadge` and `VerificationBadge` map `toneFor()` ([`src/lib/labels.ts`](../src/lib/labels.ts)) to tokens. The mapping logic itself does not change.

| Tone | Fill | Text | Examples |
|---|---|---|---|
| positive | `success` | ink | open, accepted, paid, completed, verified |
| warning | `highlight` | ink | awaiting_payment, delivered, pending, submitted |
| negative | `danger-soft` | ink | rejected, cancelled, disputed, failed, expired |
| neutral | `muted` | ink | unverified, closed, other |

All status badges keep a 2 px ink outline, so the state is never conveyed by colour alone (the label text carries it).

---

## 3. Shape, depth and motion

Registered in `@theme` so Tailwind generates the utilities.

### 3.1 Borders and radii

| Element | Border | Radius |
|---|---|---|
| Cards, panels, auth card, sticky asides | `border-2` ink | `rounded-2xl` (16 px) |
| Buttons, inputs, selects, textareas, alerts, icon tiles | `border-2` ink | `rounded-xl` (12 px) |
| Badges, filter chips, stickers, avatars | `border-2` ink | `rounded-full` |
| Internal dividers | 1 px `hairline` | — |

### 3.2 Shadows

| Token / utility | Value | Used on |
|---|---|---|
| `shadow-hard-sm` | `2px 2px 0 0 var(--foreground)` | Chips, small buttons, focused inputs, active nav tile |
| `shadow-hard` | `4px 4px 0 0 var(--foreground)` | Buttons, inputs at rest (outline variant), floating panels |
| `shadow-hard-lg` | `6px 6px 0 0 var(--foreground)` | Auth card, hero panel, sticky price aside |
| `shadow-ledge` | `0 5px 0 0 var(--ledge), 0 7px 0 0 var(--foreground)` | **Cards** — the reference-2 "ledge": a coloured strip under the card with an ink baseline |

- `--ledge` defaults to `var(--highlight)`. Change it per card with an arbitrary property, e.g. `className="[--ledge:var(--accent)]"`, so `Card`'s API does not change. Rotate ledge colours in grids (highlight → success → lilac → secondary → accent).
- Cards use the ledge; buttons and inputs use the diagonal hard shadow (product-owner decision, 2026-11-14).
- The exact ledge offsets are checked visually in Phase 1 and may be tuned there (§8).

### 3.3 Interaction states

| State | Treatment |
|---|---|
| Hover (buttons) | Slight lift: `-translate-x-px -translate-y-px` and the shadow grows by 1 px |
| Active / pressed | `translate-x-[2px] translate-y-[2px]` and the shadow shrinks to `shadow-hard-sm` (or none) |
| Hover (link cards) | Ledge grows (`--ledge` strip 5 → 7 px) or the card lifts 2 px |
| Focus-visible | `outline-2 outline-offset-2 outline-ring` on every interactive element (buttons, links, inputs, chips, nav items) |
| Disabled | `opacity-50`, no shadow, no transform, `cursor-not-allowed` |
| Invalid (`aria-invalid`) | `border-destructive` + `bg-danger-soft/40` (the field's text stays ink; the error message below uses `text-destructive` on the surface, 5.65) |

All transforms and transitions are wrapped in `motion-safe:`. A global `@media (prefers-reduced-motion: reduce)` guard removes transitions.

---

## 4. Typography

| Role | Font | Size / weight | Tailwind |
|---|---|---|---|
| Display (hero) | Bricolage Grotesque | `text-5xl sm:text-6xl`, 800, tracking −0.03em, leading 1.05 | `font-display` |
| Page title (h1) | Bricolage Grotesque | `text-3xl md:text-4xl`, 800 | `font-display` |
| Section title (h2) | Bricolage Grotesque | `text-2xl`, 700 | `font-display` |
| Card title (h3) | Plus Jakarta Sans | `text-lg`, 700 | `font-sans` |
| Stat numbers | Bricolage Grotesque | `text-3xl`, 800, `tabular-nums` | `font-display` |
| Brand wordmark | Bricolage Grotesque | `text-xl`, 800 | `font-display` |
| Body | Plus Jakarta Sans | 16 px, 400–500, leading 1.6 | `font-sans` (default) |
| Meta / helper | Plus Jakarta Sans | `text-sm` / `text-xs` | |
| Labels, buttons | Plus Jakarta Sans | `text-sm`, 700 | |
| Eyebrow | Plus Jakarta Sans | 12 px, 800, uppercase, tracking 0.12em, as a sticker chip | `eyebrow` utility |

- Both fonts are loaded with `next/font/google` in [`src/app/layout.tsx`](../src/app/layout.tsx), and their variable classes sit on `<html>` (not `<body>`): Tailwind reads `--font-sans` on `<html>`, so variables defined on `<body>` never resolved and the app silently rendered the system font (self-hosted at build time, no runtime request to Google, no CSP impact). Bricolage Grotesque: `subsets: ["latin"]`, variable weight, `display: "swap"`, exposed as `--font-bricolage` → `--font-display`. Plus Jakarta Sans keeps `--font-plus-jakarta` → `--font-sans`.
- Indonesian copy uses basic Latin, so the `latin` subset covers it.

### 4.1 `cn()` and custom tokens

`tailwind-merge` does not know the custom tokens. With the default config it **drops** a custom font size when combined with a text colour (`cn("text-display text-primary")` → `"text-primary"`) and does not merge `shadow-hard` with `shadow-sm`. Phase 1 switches [`src/lib/utils.ts`](../src/lib/utils.ts) to `extendTailwindMerge`, registering the custom shadow, colour and font-size tokens. `cn()` keeps the same signature.

---

## 5. Custom utilities (globals.css)

| Utility | Purpose |
|---|---|
| `eyebrow` | Uppercase sticker label: `bg-highlight`, `border-2` ink, `rounded-full`, `px-3 py-1`, 12 px / 800 / tracking 0.12em |
| `sticker` | Generic small outlined chip (same shape as `eyebrow`, no forced uppercase); colour set by a `bg-*` class |
| `marker` | Highlighter underline for a word or active tab: a `highlight` band behind the lower ~40 % of the text (reference 2's tab underline) |

Base layer additions: `body` background and text, `::selection` (primary on white), `color-scheme: light`, native checkbox/radio styling (`appearance-none`, 2 px ink box, primary fill when checked, visible focus), and the reduced-motion guard.

---

## 6. Components

APIs are preserved. "New" means added alongside, not replacing.

| Component | File | Treatment |
|---|---|---|
| Button | [`ui/button.tsx`](../src/components/ui/button.tsx) | `border-2` ink, `rounded-xl`, `font-bold`. `default` = primary + `shadow-hard`; `secondary` = orange + `shadow-hard`; `outline` = surface + `shadow-hard`; `ghost` = no border/shadow, `hover:bg-highlight/60`. **New variants:** `accent` (pink, ink text), `destructive`. Sizes unchanged (`h-11` default). Press and hover states per §3.3 |
| Card | [`ui/card.tsx`](../src/components/ui/card.tsx) | `bg-card`, `border-2` ink, `rounded-2xl` by default, `shadow-ledge`. Sub-components unchanged |
| Input / Textarea | [`ui/input.tsx`](../src/components/ui/input.tsx), [`ui/textarea.tsx`](../src/components/ui/textarea.tsx) | `h-11` (input), `border-2` ink, `rounded-xl`, `bg-card`; `shadow-hard-sm` at rest, `shadow-hard` plus the global outline on focus; invalid per §3.3 |
| NativeSelect **(new)** | [`ui/native-select.tsx`](../src/components/ui/native-select.tsx) | Native `<select>` matching Input, with a CSS chevron. Replaces the 7 copied select class strings. Stays native because forms must work without client JS (ARCHITECTURE §3) |
| Label | [`ui/label.tsx`](../src/components/ui/label.tsx) | `font-bold` |
| Badge | [`ui/badge.tsx`](../src/components/ui/badge.tsx) | `border-2` ink, `rounded-full`, `font-bold`; variants map to tokens |
| Alert | [`ui/alert.tsx`](../src/components/ui/alert.tsx) | `border-2` ink, `rounded-xl`; default = surface; destructive = `danger-soft` fill with ink text, `destructive` icon and border |
| Avatar | [`ui/avatar.tsx`](../src/components/ui/avatar.tsx) | 2 px ink ring; fallback `bg-highlight` (or `lilac` with white bold initials at ≥ 18.66 px) |
| Separator | [`ui/separator.tsx`](../src/components/ui/separator.tsx) | 2 px ink (decorative) |
| Field / FormAlert / SubmitButton | [`forms/form-primitives.tsx`](../src/components/forms/form-primitives.tsx) | `FormAlert` success = `success` fill; error = destructive Alert. `SubmitButton`'s `variant` union widened to the new Button variants |
| StatusBadge / VerificationBadge | [`jobs/status-badge.tsx`](../src/components/jobs/status-badge.tsx), [`verification/verification-badge.tsx`](../src/components/verification/verification-badge.tsx) | Tones per §2.1; no raw `amber-*`/`red-*` |
| RatingSummary / ReviewList | [`reviews/review-display.tsx`](../src/components/reviews/review-display.tsx) | Stars in ink outline with `highlight` fill (no `amber-*`) |
| EmptyState **(new, Phase 5)** | `components/empty-state.tsx` | Title, body, optional action; outlined dashed card on `muted`. Replaces 10 duplicated blocks |
| Brand | [`brand.tsx`](../src/components/brand.tsx) | "P" tile: primary, `border-2`, `shadow-hard-sm`; wordmark in `font-display` |

---

## 7. Layout patterns

| Pattern | Spec |
|---|---|
| Site header | `bg-card`, `border-b-2` ink, no blur. Nav links are chips; the active route gets `bg-highlight` + `border-2` |
| Site footer | `border-t-2` ink on a lilac-tinted band |
| Dashboard nav (desktop) | Outlined surface card; active item = `bg-highlight` tile, `border-2`, `shadow-hard-sm` |
| Dashboard nav (below 1024 px) | Horizontal **primary-purple rail** with a yellow active tile (reference 2's bar); it scrolls sideways and centres the current page. Primary, not lilac, because small white text on lilac fails AA (4.29). The sidebar appears at `lg` (1024 px): at 768 px a 232 px sidebar left only 432 px for content |
| Admin nav / filter chips | Toolbar card holding `border-2` chips that wrap onto several rows (never a hidden scroll); active = `bg-highlight` + `shadow-hard-sm` |
| Page header | `eyebrow` sticker + `font-display` h1 (`text-3xl md:text-4xl`) + `text-muted-foreground` lead |
| Listing card | `Card` with ledge; cover image inside a `border-b-2` frame; price in `font-display` |
| Lists inside cards | `divide-y divide-hairline` |
| Empty state | `EmptyState` |
| Auth pages | Lavender page, centred `bg-card` panel with `border-2` and `shadow-hard-lg` |

`overflow-hidden` and `overflow-x-auto` clip hard shadows and ledges. Give such containers enough inner padding (≥ 8 px bottom/right), or move the overflow to an inner element.

---

## 8. Implementation roadmap

Each phase is one commit on `feature/neo-brutal-ui`. After every phase run `npm run lint`, `npx next typegen && npm run typecheck`, `npm test`, `npm run build` and `npm run format:check`. Then check screenshots at 360 px and desktop (cached Chrome via `playwright-core` against `next start`).

| # | Phase | Scope | Status |
|---|---|---|---|
| 0 | Preparation | Branch, design references committed, this document, ARCHITECTURE/IMPLEMENTATION_PLAN pointers | Done (2026-11-14) |
| 1 | Foundation | `globals.css` tokens, `@theme` shadows/fonts, base layer, utilities (§5), Bricolage in `layout.tsx`, `extendTailwindMerge` in `utils.ts`. Ledge offsets checked visually and kept (5 px strip + 2 px ink baseline) | Done (2026-11-14) |
| – | Border-cascade audit | Bare `border`/`divide-*` in pages are now 1 px **ink** lines (global default). Internal dividers (`divide-y`, `border-t`/`-b`, about 26 uses) move to `hairline` while each page is restyled (phases 3–6) | Deferred to pages |
| 2 | Primitives | All `ui/*`, new `NativeSelect`, form primitives, StatusBadge, VerificationBadge, review stars, UserAvatar. `EmptyState` moved to Phase 5 where its 10 call sites are replaced | Done (2026-11-14) |
| 3 | Shell | Brand, site header, footer, dashboard and admin navs, AuthCard, LegalPage | Done (2026-11-14) |
| 4 | Public pages | Landing, `/services`, `/jobs`, `/u/[username]` (done 2026-11-14). `/services/[id]`, `/services/[id]/order` and `/jobs/[id]` are detail pages, not yet restyled | Done for the four listed pages |
| 5 | Dashboard | Overview, orders list and detail, jobs, proposals, services, portfolio, earnings, verification, settings, freelancer; replace copied select styles | — |
| 6 | Admin | All `/admin` pages and admin forms | — |
| 7 | QA and handoff | Keyboard/focus pass, contrast check, reduced motion, 360 px sweep, docs, completion report | — |

### 8.1 Guardrails

- Do not touch `src/server/**`, `src/lib/{supabase,validation,capabilities}`, `src/proxy.ts`, `supabase/**`, or any action, RPC, auth or payment code.
- Do not change copy (Bahasa Indonesia, NFR-11), routes, form field names, or `aria-*`/role semantics. The component tests query by role and text.
- The Midtrans Snap popup is a third-party iframe and cannot be styled. Only `PaymentPanel`'s own buttons change.
- Phase 10's full CSP: the CSS select chevron (data-URI SVG) needs `img-src data:`. Fonts are self-hosted and need no extra source.

### 8.2 Known inconsistencies being fixed

`Card` radius overridden at about 50 call sites; about 40 hand-built card `div`s with differing padding and hover effects; mismatched control heights (input `h-9`, selects `h-10`, button `h-11`); the select style copied 7 times; raw `amber-*`/`red-*` colours in 10 files; 10 duplicated empty states; the page header hand-written in 15 pages with four different h1 sizes; three different chip styles; duplicate `BriefcaseBusiness` icons in the dashboard nav; no active link state in the site header.

### 8.3 Implementation notes (Phases 1–2)

- `h1` and `h2` use `font-display` globally (base layer), so unrestyled pages already pick up Bricolage. It is wider than the old font; the landing hero now wraps to three lines. Fix per page.
- No Dialog, Dropdown Menu, Tabs, Tooltip, Checkbox or Radio Group components exist in the app, so none were added. Native checkboxes and radios are styled in the base layer; add the shadcn components only when a feature needs them.
- Pages that still pass old overrides (`border-primary/30`, `border-amber-200 bg-amber-50/60` on a few Cards, hand-built `rounded-2xl border` blocks, the 7 copied select class strings) keep working but look unfinished until their phase.
- Existing search fields on `/services` and `/jobs` use `outline-none` with no focus style (a keyboard-accessibility gap that predates this work); fix in Phase 4.

### 8.4 Implementation notes (Phase 3)

- Bricolage is loaded with the `opsz` axis, so display letterforms tighten at large sizes. The landing hero h1 went from three lines to two at 1280 px.
- Footer: brand and tagline, a "Jelajahi" column, an "Informasi" column (Terms, Privacy), and a bottom bar with the copyright and a "Mode uji · Midtrans Sandbox" sticker. The tagline, the third "Jelajahi" link and the sticker are new copy.
- Auth pages share `AuthCard`: decorative blobs and a dot grid sit behind a `shadow-hard-lg` card.
- Legal pages: readable card with hairline-divided sections, body text in full ink and a 68-character measure.
- Dashboard nav icons are now distinct (Store for services, Images for portfolio).

### 8.5 Implementation notes (Phase 4)

- New shared pieces: [`page-header.tsx`](../src/components/page-header.tsx) (lilac band with eyebrow, title, lead and an optional children slot for a search form), [`empty-state.tsx`](../src/components/empty-state.tsx) (moved forward from Phase 5), [`pagination.tsx`](../src/components/pagination.tsx), [`listing-skeleton.tsx`](../src/components/listing-skeleton.tsx) with `loading.tsx` for `/services` and `/jobs`, and `ledgeAt()` in [`src/lib/ledge.ts`](../src/lib/ledge.ts) for rotating ledge colours.
- Listing cards: a category sticker, a price in the display font, delivery as a chip. Job cards: a mint budget tile and an orange deadline tile so money and time are never confused with category.
- The landing page shows only real data (categories from the database). No sample listings or invented statistics.
- The landing hero h1 breaks into three balanced lines at 1280 px (`text-balance`, marker on the last line); two lines at 768 px.
- `ReviewList` items are now outlined cards (`bg-card`, `border-2`), which also restyles reviews on the order and service pages.
- `UserAvatar` gained an optional `fallbackClassName` for large initials.
