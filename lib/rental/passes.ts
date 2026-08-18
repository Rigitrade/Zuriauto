/**
 * The predicates behind the daily scheduler.
 *
 * Ported from `backend/src/scheduler/passes.ts` in the earlier project, which
 * is the one part of that system whose tests were worth keeping. The shape is
 * the point: each pass decides with a pure function and then writes with a
 * conditional update whose WHERE repeats the same precondition. The predicate
 * may be true twice; the update can only succeed once, so a concurrent second
 * run is harmless.
 *
 * Nothing here touches the database or the clock — `now` is always passed in,
 * which is what makes the boundaries testable to the second.
 */

import { TZDate } from "@date-fns/tz";
import { addWeeks } from "date-fns";
import { ZURICH } from "./terms";

/**
 * How far ahead the reminder pass looks.
 *
 * Deliberately wider than the client's "24 hours before". A daily cron running
 * at 09:00 and looking only 24 hours ahead would never see a rental ending at
 * 08:00 the next morning — that end would fall in the gap between two runs.
 * Looking 48 hours ahead and deduping on the Zurich day of `endAt` means the
 * notice goes out between 24 and 48 hours before the end, always exactly once.
 *
 * The alternative is an hourly cron, which needs a paid Vercel plan. Flagged as
 * open question 1 in the design spec.
 */
export const REMINDER_LOOKAHEAD_HOURS = 48;

const ZURICH_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZURICH,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The calendar date of an instant as Zurich sees it, `YYYY-MM-DD`. */
export function zurichDayString(at: Date): string {
  return ZURICH_DAY.format(at);
}

export function hoursBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / 3_600_000;
}

/** The range the reminder pass queries, so the DB filter matches the guard. */
export function endingSoonWindow(now: Date): { from: Date; to: Date } {
  return {
    from: now,
    to: new Date(now.getTime() + REMINDER_LOOKAHEAD_HOURS * 3_600_000),
  };
}

/** Remind: the rental has not ended yet and ends inside the window. */
export function isRentalEndingSoon(
  rental: { endAt: Date },
  now: Date
): boolean {
  const ahead = hoursBetween(now, rental.endAt);
  return ahead > 0 && ahead <= REMINDER_LOOKAHEAD_HOURS;
}

/** Alert: the agreed return is in the past and the car is still out. */
export function isRentalOverdue(rental: { endAt: Date }, now: Date): boolean {
  return rental.endAt.getTime() < now.getTime();
}

export interface ChargeLike {
  status: string;
  dueDate?: Date;
  requestedAt?: Date | null;
  remindedAt?: Date | null;
}

/**
 * Request: still scheduled, and its due date has arrived in Zurich terms.
 *
 * Compared as day strings rather than instants because a charge due "on the
 * 18th" should go out on the 18th as the office experiences it, whatever the
 * stored time of day.
 */
export function isDueForChargeRequest(charge: ChargeLike, now: Date): boolean {
  return (
    charge.status === "SCHEDULED" &&
    charge.dueDate !== undefined &&
    zurichDayString(charge.dueDate) <= zurichDayString(now)
  );
}

/** Remind: link sent, unpaid, and the threshold has elapsed. */
export function isDueForChargeReminder(
  charge: ChargeLike,
  now: Date,
  remindAfterHours: number
): boolean {
  return (
    charge.status === "REQUESTED" &&
    charge.requestedAt != null &&
    hoursBetween(charge.requestedAt, now) >= remindAfterHours
  );
}

/** Alert the office: reminded, still unpaid, and the threshold has elapsed. */
export function isDueForChargeOverdue(
  charge: ChargeLike,
  now: Date,
  alertAfterHours: number
): boolean {
  return (
    charge.status === "REMINDED" &&
    charge.remindedAt != null &&
    hoursBetween(charge.remindedAt, now) >= alertAfterHours
  );
}

export interface WeeklyChargeInput {
  weekNumber: number;
  dueDate: Date;
  amountCents: number;
}

/**
 * The full weekly schedule, generated up front.
 *
 * Written when the rental is created so the pass walks rows rather than doing
 * date arithmetic at runtime — the old project's approach, and the reason its
 * scheduler could be reasoned about at all.
 *
 * `fromWeek` exists for extensions: adding two weeks to a four-week rental
 * produces weeks 5 and 6, whose due dates continue from the original start
 * rather than from today.
 *
 * Weeks are added through `TZDate` for the same reason `deriveEndAt` is: a
 * charge should fall due at the same local time every week, not drift by an
 * hour when the clocks change.
 */
export function generateWeeklyCharges(opts: {
  startAt: Date;
  fromWeek: number;
  weeks: number;
  amountCents: number;
}): WeeklyChargeInput[] {
  const { startAt, fromWeek, weeks, amountCents } = opts;

  if (!Number.isInteger(weeks) || weeks < 1) {
    throw new Error(`weeks must be a positive integer, got ${weeks}`);
  }
  if (!Number.isInteger(fromWeek) || fromWeek < 1) {
    throw new Error(`fromWeek must be a positive integer, got ${fromWeek}`);
  }
  if (!Number.isInteger(amountCents) || amountCents < 0) {
    throw new Error(`amountCents must be a non-negative integer`);
  }

  const zoned = new TZDate(startAt.getTime(), ZURICH);

  return Array.from({ length: weeks }, (_, i) => {
    const weekNumber = fromWeek + i;
    return {
      weekNumber,
      dueDate: new Date(addWeeks(zoned, weekNumber - 1).getTime()),
      amountCents,
    };
  });
}
