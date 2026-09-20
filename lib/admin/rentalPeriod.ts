/**
 * Correcting the dates on a rental that was reconstructed from paper.
 *
 * Mr Ahmed's thirteen pre-backend PDFs record a handover and nothing about the
 * term — no start date, no agreed return, no rate. The import therefore wrote
 * `endAt = startAt` on every rental it could not close, which is honest and
 * useless: the fleet history shows nine cars that went out and came back in
 * the same instant. The office knows roughly when most of them came back. This
 * is how that knowledge gets in.
 *
 * Pure and client-safe, so the same rules run in the browser and on the
 * server. The route is the one that enforces them.
 *
 * **The guard is the important part of this file.** A signed contract states
 * a period, and that period is evidence; letting the dashboard rewrite it
 * would turn every contract into something a later edit could contradict. So
 * only a rental whose paperwork was written by the importer may be touched —
 * see `mayEditPeriod`.
 */

import { z } from "zod";
import { TZDate } from "@date-fns/tz";
import { ZURICH } from "@/lib/rental/terms";

/** What `import-legacy-contracts.ts` stamps on every row it writes. */
export const IMPORT_AUTHOR = "import:legacy-pdf";

/** `YYYY-MM-DDTHH:mm`, which is what `<input type="datetime-local">` produces. */
const WALL_CLOCK = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/**
 * A Zurich wall-clock string as an instant.
 *
 * The browser sends what the office typed, not an instant it derived, for the
 * reason `dayStart` gives next door: a date turned into a `Date` in the
 * browser is a date in the *browser's* zone, and one laptop set to UTC is
 * enough to move every corrected return an hour — across midnight, a day.
 * The zone is named here, once, on the server.
 */
export function zurichInstant(value: string): Date | null {
  const match = WALL_CLOCK.exec(value);
  if (!match) return null;

  const [, year, month, date, hours, minutes] = match;
  const at = new TZDate(
    Number(year),
    Number(month) - 1,
    Number(date),
    Number(hours),
    Number(minutes),
    0,
    0,
    ZURICH
  );
  if (Number.isNaN(at.getTime())) return null;

  // 2026-02-31 is a date the constructor rolls forward into March rather than
  // refusing. A correction silently moved to another month is worse than one
  // that will not save.
  if (at.getMonth() !== Number(month) - 1 || at.getDate() !== Number(date)) {
    return null;
  }

  return new Date(at.getTime());
}

const wallClock = z
  .string()
  .regex(WALL_CLOCK, "notADateTime")
  .refine((value) => zurichInstant(value) !== null, "notADateTime");

/**
 * Both ends, always, even to change one.
 *
 * A partial update would have to decide what an absent `endAt` means against
 * a new `startAt` — leave it, or move it — and both answers are wrong half
 * the time. The form has both boxes filled in already, so sending both costs
 * nothing.
 */
export const rentalPeriodSchema = z
  .object({ startAt: wallClock, endAt: wallClock })
  .refine(
    (value) => {
      const from = zurichInstant(value.startAt);
      const to = zurichInstant(value.endAt);
      return from !== null && to !== null && to.getTime() >= from.getTime();
    },
    { message: "endBeforeStart", path: ["endAt"] }
  );

export type RentalPeriodInput = z.infer<typeof rentalPeriodSchema>;

/**
 * May this rental's dates be corrected?
 *
 * Only when every contract on it came from the import. One contract signed at
 * the desk is enough to refuse: that document states its own period, printed
 * and signed, and a dashboard that could disagree with it would make the
 * contract the weaker of the two records.
 *
 * A rental with no contracts at all is also refused. That is not a
 * reconstructed rental, it is an incomplete one, and it wants somebody to look
 * at why rather than a date picker.
 */
export function mayEditPeriod(
  contracts: readonly { createdBy: string }[]
): boolean {
  if (contracts.length === 0) return false;
  return contracts.every((contract) => contract.createdBy === IMPORT_AUTHOR);
}

/**
 * An instant as the `datetime-local` value for a Zurich desk.
 *
 * `sv-SE` because its formatting is already `YYYY-MM-DD HH:mm:ss`; the swap to
 * a `T` is the whole conversion. Building it from the parts of a local `Date`
 * would put the browser's zone back into a value this module exists to keep
 * out of it.
 */
export function toZurichInput(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: ZURICH,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(at)
    .replace(" ", "T");
}
