/**
 * Formatting shared by more than one admin section.
 *
 * `day` splits the ISO string rather than going through `Date`, so a contract
 * dated 2026-08-28 reads as 28.08.2026 in every timezone the office might be
 * in. Constructing a Date and reading its local parts would show the previous
 * day west of UTC, which on a rental start date is a real error rather than a
 * cosmetic one.
 */
export function day(iso: string): string {
  const [date] = iso.split("T");
  const [y, m, d] = date.split("-");
  return `${d}.${m}.${y}`;
}

/** Chip colours per car status. Paired with a word, never colour alone. */
export const STATUS_STYLE: Record<string, string> = {
  available: "bg-emerald-100 text-emerald-900",
  rented: "bg-sky-100 text-sky-900",
  maintenance: "bg-amber-100 text-amber-900",
  retired: "bg-slate-200 text-slate-700",
};
