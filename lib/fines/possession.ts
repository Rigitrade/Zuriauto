/**
 * Who actually had the car at a moment.
 *
 * Not who was booked. The history screen and `driverAt` both test the planned
 * `startAt`/`endAt`, which is wrong twice over for a fine: a car returned a
 * fortnight early stays "with" its renter until the planned end, and a car
 * kept past its end falls outside every rental. A fine follows the car, so
 * this follows what happened to the car:
 *
 *   from  the pickup contract's signature (else the rental's start)
 *   to    the return form's signature or the close, whichever came first;
 *         nothing yet while the car is still out
 *
 * See the spec, "Finding the responsible person".
 */

import { zurichInstant } from "@/lib/admin/rentalPeriod";

/**
 * A contract is signed when its form is submitted, not to the minute the keys
 * change hands — the office may hand over and then type, and a renter may
 * fill in the return from the car park. Within this of a handover, a person
 * decides.
 */
export const HANDOVER_MARGIN_MS = 2 * 60 * 60 * 1000;

export interface RentalFacts {
  rentalId: string;
  customerId: string;
  status: string;
  createdBy: string;
  startAt: Date;
  endAt: Date;
  pickupSignedAt: Date | null;
  returnSignedAt: Date | null;
  closedAt: Date | null;
}

export interface Interval {
  rentalId: string;
  customerId: string;
  from: Date;
  /** Null while the car is still out. */
  to: Date | null;
}

const OPEN = new Set(["ACTIVE", "EXTENSION_REQUESTED"]);

/**
 * The span a rental actually had the car, or null when it never left
 * (cancelled) or its end cannot be known (closed with no record of when).
 * An unknowable end makes the rental invisible to matching, which sends any
 * fine that might be its to the office — the right place for it.
 */
export function intervalOf(r: RentalFacts): Interval | null {
  if (r.status === "CANCELLED") return null;
  const from = r.pickupSignedAt ?? r.startAt;
  const base = { rentalId: r.rentalId, customerId: r.customerId, from };

  const ends = [r.returnSignedAt, r.closedAt].filter((d): d is Date => d !== null);
  if (ends.length > 0) {
    return { ...base, to: new Date(Math.min(...ends.map((d) => d.getTime()))) };
  }
  if (OPEN.has(r.status)) return { ...base, to: null };
  if (r.createdBy.startsWith("import:") && r.endAt > r.startAt) {
    return { ...base, to: r.endAt };
  }
  return null;
}

export type Moment =
  | { kind: "instant"; at: Date }
  /** A whole Zurich day, for a letter that gives a date and no time. */
  | { kind: "day"; from: Date; to: Date };

function nextDay(isoDate: string): string {
  const next = new Date(`${isoDate}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

/** A letter's date and time — Zurich wall clock — as a moment. */
export function momentOf(date: string, time: string | null): Moment | null {
  if (time) {
    const instant = zurichInstant(`${date}T${time}`);
    return instant ? { kind: "instant", at: instant } : null;
  }
  const from = zurichInstant(`${date}T00:00`);
  const to = zurichInstant(`${nextDay(date)}T00:00`);
  return from && to ? { kind: "day", from, to } : null;
}

export type Responsible =
  | { ok: true; rentalId: string; customerId: string }
  | {
      ok: false;
      reason: "NO_RENTAL_AT_TIME" | "HANDOVER_BOUNDARY" | "OVERLAPPING_RENTALS";
      candidates: string[];
    };

function contains(interval: Interval, at: Date): boolean {
  return interval.from <= at && (interval.to === null || at < interval.to);
}

function nearHandover(interval: Interval, at: Date): boolean {
  const edges = [interval.from, interval.to].filter((d): d is Date => d !== null);
  return edges.some((edge) => Math.abs(at.getTime() - edge.getTime()) < HANDOVER_MARGIN_MS);
}

export function responsibleAt(intervals: Interval[], moment: Moment): Responsible {
  if (moment.kind === "instant") {
    const holding = intervals.filter((i) => contains(i, moment.at));
    if (holding.length > 1) {
      return { ok: false, reason: "OVERLAPPING_RENTALS", candidates: holding.map((i) => i.rentalId) };
    }
    const near = intervals.filter((i) => nearHandover(i, moment.at));
    if (near.length > 0) {
      const candidates = [...new Set([...holding, ...near].map((i) => i.rentalId))];
      return { ok: false, reason: "HANDOVER_BOUNDARY", candidates };
    }
    if (holding.length === 1) {
      return { ok: true, rentalId: holding[0].rentalId, customerId: holding[0].customerId };
    }
    return { ok: false, reason: "NO_RENTAL_AT_TIME", candidates: [] };
  }

  const touching = intervals.filter(
    (i) => i.from < moment.to && (i.to === null || i.to > moment.from)
  );
  const wholeDay = touching.filter(
    (i) => i.from <= moment.from && (i.to === null || i.to >= moment.to)
  );
  if (wholeDay.length > 1) {
    return { ok: false, reason: "OVERLAPPING_RENTALS", candidates: wholeDay.map((i) => i.rentalId) };
  }
  if (touching.length === 1 && wholeDay.length === 1) {
    return { ok: true, rentalId: wholeDay[0].rentalId, customerId: wholeDay[0].customerId };
  }
  if (touching.length > 0) {
    return { ok: false, reason: "HANDOVER_BOUNDARY", candidates: touching.map((i) => i.rentalId) };
  }
  return { ok: false, reason: "NO_RENTAL_AT_TIME", candidates: [] };
}
