/**
 * Marking a car as out when no contract says so.
 *
 * Some vehicles left the yard before the system existed, or on paper, and the
 * office cannot record their return: the return form lists cars whose status
 * is `rented`, and `persistReturn` then looks for an open rental to hang the
 * protocol off. A car with neither is invisible to the first and, if it were
 * made visible, would fail the second — the renter would sign a return
 * protocol, receive a PDF, and nothing would be written down.
 *
 * So this creates a real rental, deliberately thin: an `ACTIVE` row with no
 * contract, a placeholder renter, and no money. Exactly the shape the legacy
 * import already produces for a return protocol whose pickup was never
 * supplied, which is the same problem arriving from the other direction.
 *
 * Pure and client-safe. The route enforces it; the form uses the same rules so
 * the office is told about a bad date before it presses anything.
 */

import { z } from "zod";
import { dayEnd, dayStart } from "@/lib/admin/carHistory";

/** Stamped on the rental, so these are distinguishable from a real handover
 *  forever — a rental with no contract is otherwise just a gap. */
export const MARKED_OUT_BY = "office:marked-out";

const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "notADay")
  .refine((value) => dayStart(value) !== null, "notADay");

export const markOutSchema = z.object({
  /**
   * Optional, because the honest answer is often that nobody wrote it down.
   *
   * A name typed here is a label on the rental, not an identification: there
   * is no birth date, no address and no signature behind it. It is stored so
   * the fleet screen can say "Muddaser" rather than "not recorded", which is
   * the difference between a row somebody can act on and one they cannot.
   */
  renterName: z.string().trim().max(120).optional(),
  startAt: day,
  endAt: day,
});

export type MarkOutInput = z.infer<typeof markOutSchema>;

export type MarkOutPeriod =
  | { ok: true; startAt: Date; endAt: Date }
  | { ok: false; reason: "notADay" | "endBeforeStart" | "endInPast" };

/**
 * The two days as instants, or why they will not do.
 *
 * `dayStart` for the out date and `dayEnd` for the return, both in Zurich. The
 * asymmetry is the point: a car due back "on the 25th" is not overdue at one
 * minute past midnight on the 25th, it is overdue when the 25th is over. Using
 * `dayStart` for both would have the scheduler chasing renters a day early.
 *
 * **A return date already past is refused.** `runDailyPasses` mails every
 * ACTIVE rental whose `endAt` has gone by, so a car marked out with last
 * week's date would send its renter an overdue notice the next morning — for a
 * rental the office had only just written down, in order to close it. Refusing
 * costs the office one corrected keystroke; allowing it costs a letter to a
 * customer that cannot be recalled.
 */
export function markOutPeriod(
  input: MarkOutInput,
  today: Date
): MarkOutPeriod {
  const startAt = dayStart(input.startAt);
  const endAt = dayEnd(input.endAt);
  if (!startAt || !endAt) return { ok: false, reason: "notADay" };

  if (endAt.getTime() < startAt.getTime()) {
    return { ok: false, reason: "endBeforeStart" };
  }

  // Against the end of today, not this instant: a car marked out at 16:00 and
  // due back "today" is not late, and refusing that would be indistinguishable
  // from a bug to whoever is holding the keys.
  if (endAt.getTime() < today.getTime()) {
    return { ok: false, reason: "endInPast" };
  }

  return { ok: true, startAt, endAt };
}

/**
 * The typed name split into the two columns a customer row has.
 *
 * Everything goes in `lastName`, and `firstName` stays empty. Guessing which
 * word is the family name is how five of the imported contracts ended up with
 * theirs reversed — see docs/LEGACY-IMPORT.md — and here there is not even a
 * signature line to check it against. One field, printed as typed.
 */
export function splitRenterName(renterName: string | undefined): {
  firstName: string;
  lastName: string;
} {
  return { firstName: "", lastName: (renterName ?? "").trim() };
}
