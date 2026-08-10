/**
 * Typed date entry for the birth date field.
 *
 * `<input type="date">` forces the platform picker, which on a phone means
 * scrolling a calendar back four or five decades to reach a birth year. Typing
 * eight digits is faster and is what people expect of a date of birth, so the
 * field is a plain text input with the dots inserted as they type.
 *
 * Pure string functions, no DOM — the parsing rules can be exercised directly
 * rather than by driving the form.
 */

/**
 * Formats digits as `DD.MM.YYYY` while the user types.
 *
 * Non-digits are stripped and the separators re-inserted, which makes
 * backspace behave: deleting the last character of "28.01." leaves the digits
 * "2801", which formats back to "28.01" rather than trapping the cursor behind
 * a dot. It also means a pasted "28/01/1978" or "28-01-1978" is accepted.
 */
export function formatDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)]
    .filter(Boolean)
    .join(".");
}

/**
 * Converts `DD.MM.YYYY` to the `YYYY-MM-DD` the schema and PDF expect, or
 * null if it is not a real calendar date.
 *
 * The round-trip check rejects dates JavaScript would otherwise roll over:
 * `new Date(1978, 1, 31)` silently becomes 3 March, so "31.02.1978" would pass
 * a regex-only test and produce a birth date the customer never entered.
 */
export function parseTypedDate(value: string): string | null {
  const match = value.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) return null;

  const [, dd, mm, yyyy] = match;
  const day = Number(dd);
  const month = Number(mm);
  const year = Number(yyyy);

  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return `${yyyy}-${mm}-${dd}`;
}

/** `YYYY-MM-DD` back to `DD.MM.YYYY`, for prefilling the field. */
export function toTypedDate(iso: string): string {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : "";
}
