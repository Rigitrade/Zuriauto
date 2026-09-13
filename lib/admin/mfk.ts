/**
 * How close a car's annual inspection is, for the fleet screen.
 *
 * Shares its notice period with the scheduler's `isMfkDueSoon` rather than
 * hard-coding a second one: the screen and the email have to agree about what
 * "due" means, or the office gets a warning about a car the fleet page still
 * shows as fine, and stops believing either.
 *
 * Client-side, so it works from the `YYYY-MM-DD` string the overview endpoint
 * returns rather than from a Date — which is deliberate. A date column sent as
 * an ISO instant and re-parsed in a browser is exactly how a day slips by one.
 */

import { MFK_NOTICE_DAYS } from "@/lib/rental/passes";
import { ZURICH } from "@/lib/rental/terms";

const ZURICH_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZURICH,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export type MfkStanding =
  /** No date recorded, so nothing is claimed about this car. */
  | "none"
  /** Comfortably ahead. */
  | "ok"
  /** Inside the notice period — the email has gone, or goes today. */
  | "due"
  /** The inspection day is past. */
  | "expired";

export function mfkStanding(
  mfkDate: string | null | undefined,
  now: Date
): MfkStanding {
  if (!mfkDate || !DAY.test(mfkDate)) return "none";

  // Both sides as calendar days, never as instants: "two days before" is a
  // question about the calendar the office reads.
  const today = Date.parse(`${ZURICH_DAY.format(now)}T00:00:00Z`);
  const due = Date.parse(`${mfkDate}T00:00:00Z`);
  if (Number.isNaN(due)) return "none";

  const days = Math.round((due - today) / 86_400_000);

  if (days < 0) return "expired";
  if (days <= MFK_NOTICE_DAYS) return "due";
  return "ok";
}
