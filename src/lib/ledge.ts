// Rotating ledge colours for grids and lists of cards (docs/DESIGN_SYSTEM.md
// §3.2). Full class strings so Tailwind can see them.
const ledges = [
  "[--ledge:var(--highlight)]",
  "[--ledge:var(--success)]",
  "[--ledge:var(--lilac)]",
  "[--ledge:var(--secondary)]",
  "[--ledge:var(--accent)]",
] as const;

export function ledgeAt(index: number): string {
  return ledges[index % ledges.length]!;
}
