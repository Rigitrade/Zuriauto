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

/**
 * A rental's end as a day, or `running` for a weekly rental still out, which
 * has no end until the car comes back.
 */
export function until(iso: string | null, running: string): string {
  return iso ? day(iso) : running;
}
