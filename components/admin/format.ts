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

/** An instant as the office reads it: Zurich date and time. Unlike `day`,
 *  this one is a moment, so it does go through Date — in Zurich's zone. */
export function zurichTime(iso: string): string {
  return new Date(iso).toLocaleString("de-CH", {
    timeZone: "Europe/Zurich",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
