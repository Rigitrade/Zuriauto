/**
 * What the customer's free text says, if anything.
 *
 * Payment requests ask renters to quote `<plate> W<week>` (scheduler.ts), so
 * those are the two things looked for. Which of our cars a plate means is the
 * fines matcher's job (`matchPlate`); this only finds the printed attempt, for
 * its one-wrong-character suggestion.
 */

/** "W3", "w 12", "Woche 3" — not inside a word, not the start of a longer number. */
export function weekOf(message: string): number | null {
  const match = /(?:^|[^A-Za-z])W(?:oche)?\s?(\d{1,2})(?!\d)/i.exec(message);
  const week = match ? Number(match[1]) : 0;
  return week >= 1 ? week : null;
}

/** The first ZH plate as the customer typed it, separators included. */
export function printedPlate(message: string): string | null {
  return /\bZH[\s.\-]*\d(?:[\s.\-]?\d){2,6}\b/i.exec(message)?.[0] ?? null;
}
