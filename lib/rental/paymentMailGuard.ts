/**
 * The rules that decide whether a payment email may go to a renter at all.
 *
 * Written after 05.11.2026, when the first daily run in weeks asked 23
 * renters — some of whom had returned their car long before — for weeks
 * that were paid in cash or never owed. The cut-off date (REMINDERS_START)
 * and the payments cut-over stopped that backlog; these rules stop the next
 * one, whatever causes it:
 *
 * 1. Office only, never the renter, when
 *    - the car is back (the rental is no longer ACTIVE): somebody who
 *      returned the car is called by the office, not chased by a robot;
 *    - the week fell due more than RENTER_PAYMENT_MAX_AGE_DAYS ago: an old
 *      week reaching the renter only now means something was missed, and
 *      the office knows better than the system whether it was paid;
 *    - the renter has no real email address on file.
 * 2. The safety stop: when one run would send more payment emails than
 *    PAYMENT_MAIL_CAP, it sends none, and the office gets one list instead.
 *    The office releases it on the payments page ("Jetzt senden").
 *
 * Pure, so the passes, the payments page and the cron's dry run all decide
 * the same way.
 */

import { isPlaceholderEmail } from "./placeholder";
import { zurichDayString } from "./passes";

function envNumber(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/** Older than this, a week is the office's to chase, not the system's. */
export function renterPaymentMaxAgeDays(): number {
  return envNumber("RENTER_PAYMENT_MAX_AGE_DAYS", 14);
}

/** More payment emails than this in one run means something is wrong. */
export function paymentMailCap(): number {
  return envNumber("PAYMENT_MAIL_CAP", 10);
}

export type OfficeOnlyReason = "returned" | "stale" | "noEmail";

/** Whole Zurich calendar days from `from` to `to`. */
export function zurichDaysBetween(from: Date, to: Date): number {
  const day = (at: Date) => {
    const [y, m, d] = zurichDayString(at).split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((day(to) - day(from)) / 86_400_000);
}

/**
 * Why this week's payment email must go to the office instead of the renter,
 * or null when the renter may be written to.
 */
export function officeOnlyReason(
  charge: { dueDate: Date },
  rental: { status: string; customer: { email: string | null } },
  now: Date
): OfficeOnlyReason | null {
  if (rental.status !== "ACTIVE") return "returned";
  if (zurichDaysBetween(charge.dueDate, now) > renterPaymentMaxAgeDays()) return "stale";
  if (isPlaceholderEmail(rental.customer.email)) return "noEmail";
  return null;
}

/** The office's words for each reason, in the alert and on the page. */
export const OFFICE_ONLY_TEXT: Record<OfficeOnlyReason, string> = {
  returned: "Das Fahrzeug ist bereits zurück — Mieter wird nicht automatisch angeschrieben.",
  stale: "Die Woche ist älter als die Frist für automatische E-Mails — bitte selbst prüfen, ob schon bezahlt.",
  noEmail: "Keine E-Mail-Adresse des Mieters erfasst.",
};

/** True when this many payment emails in one run must be held back. */
export function exceedsCap(count: number): boolean {
  return count > paymentMailCap();
}
