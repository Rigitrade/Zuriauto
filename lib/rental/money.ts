/**
 * CHF amounts as integer cents.
 *
 * Money never exists as a float in this codebase. A rental of 250.10 a week
 * over 52 weeks accumulates a visible error in binary floating point, and the
 * amount printed on a signed contract has to be the amount charged.
 */

/**
 * Reads what someone typed into a francs field.
 *
 * Tolerant about separators, because a Swiss keyboard, a phone keypad and a
 * paste from a spreadsheet all produce different ones — including the
 * typographic apostrophe iOS substitutes for a straight one. Strict about the
 * number of decimals: three of them means the input was not an amount.
 *
 * Returns null rather than throwing. The caller is a form, and a form wants a
 * validation message, not an exception.
 */
export function parseChf(input: string): number | null {
  const cleaned = input.replace(/[\s'’]/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;

  const [whole, fraction = ""] = cleaned.split(".");
  const rappen = fraction.padEnd(2, "0");
  const cents = Number(whole) * 100 + Number(rappen);

  return Number.isSafeInteger(cents) ? cents : null;
}

/** How an amount is written on screen and on the contract. */
export function formatChf(cents: number): string {
  const whole = Math.trunc(cents / 100);
  const rappen = String(Math.abs(cents % 100)).padStart(2, "0");
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  return `${grouped}.${rappen}`;
}
