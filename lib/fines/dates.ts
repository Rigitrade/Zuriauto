/**
 * Dates and times as fine letters print them, in three languages.
 *
 * Everything returns the plain calendar form — `YYYY-MM-DD`, `HH:mm` — and
 * never an instant. A letter's date is a Zurich wall-clock reading; turning it
 * into an instant is possession.ts's job, through `zurichInstant`, which knows
 * about summer time. Doing it here would be the UTC bug the history screen
 * already fixed once.
 *
 * Each parser finds the first match anywhere in the string it is given, so a
 * caller can hand it a whole labelled line.
 */

function isRealDay(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  // Day 0 of the next month is the last day of this one.
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= last;
}

function iso(year: number, month: number, day: number): string | null {
  if (!isRealDay(year, month, day)) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function fullYear(text: string): number {
  const year = Number(text);
  // Two digits are this century: a fine is never from the 1900s.
  return text.length === 2 ? 2000 + year : year;
}

/** `02.07.2026`, `2.7.26`, `02/07/2026`. */
export const NUMERIC_DATE =
  /(?<![\d.])(\d{1,2})[./](\d{1,2})[./](\d{4}|\d{2})(?![\d.]*\d)/;

export function parseNumericDate(text: string): string | null {
  const match = NUMERIC_DATE.exec(text);
  if (!match) return null;
  return iso(fullYear(match[3]), Number(match[2]), Number(match[1]));
}

/**
 * Month names, accents optional: OCR drops them as often as it keeps them,
 * and `ä`, `û`, `é` are exactly the glyphs a faint scan loses.
 */
const MONTHS: [RegExp, number][] = [
  [/^(januar|janvier|gennaio)$/, 1],
  [/^(februar|fevrier|février|febbraio)$/, 2],
  [/^(marz|märz|maerz|mars|marzo)$/, 3],
  [/^(april|avril|aprile)$/, 4],
  [/^(mai|maggio)$/, 5],
  [/^(juni|juin|giugno)$/, 6],
  [/^(juli|juillet|luglio)$/, 7],
  [/^(august|aout|août|agosto)$/, 8],
  [/^(september|septembre|settembre)$/, 9],
  [/^(oktober|octobre|ottobre)$/, 10],
  [/^(november|novembre)$/, 11],
  [/^(dezember|decembre|décembre|dicembre)$/, 12],
];

const WRITTEN_DATE = /(?<!\d)(\d{1,2})\.?\s+([A-Za-zÀ-ÿ]+)\s+(\d{4})(?!\d)/g;

/** `4. September 2026`, `le 4 septembre 2026`, `4 settembre 2026`. */
export function parseWrittenDate(text: string): string | null {
  for (const match of text.matchAll(WRITTEN_DATE)) {
    const name = match[2].toLowerCase();
    const month = MONTHS.find(([pattern]) => pattern.test(name))?.[1];
    if (month) return iso(Number(match[3]), month, Number(match[1]));
  }
  return null;
}

/** `10:00`, `10.00 Uhr`, `8h15`. */
export const TIME = /(?<![\d.:])(\d{1,2})\s?[:.h]\s?(\d{2})(?![\d.:]*\d)/;

export function parseTime(text: string): string | null {
  const match = TIME.exec(text);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
