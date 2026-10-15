/**
 * The commercial terms of a rental.
 *
 * Two shapes on one table. WEEKLY is what the Uber and taxi drivers have: a
 * fixed weekly amount, running until the car comes back — since 16.10.2026,
 * at the lessor's request, with no number of weeks agreed up front, so it has
 * no end while it runs. FIXED_TERM serves tourists with an explicit end, and
 * since the same date is priced per day; the form calls it "Täglich".
 *
 * Both say how the renter pays, which the office chooses at the handover.
 */

import { TZDate } from "@date-fns/tz";
import { addWeeks } from "date-fns";
import { z } from "zod";
import { PAYMENT_METHODS } from "./returnSchema";

/**
 * Every rental date is reasoned about in Zurich.
 *
 * Vercel's functions run in UTC. A car handed over at 10:00 and rented for two
 * weeks over the March changeover must still be due back at 10:00, and
 * millisecond arithmetic would quietly make it 11:00.
 */
export const ZURICH = "Europe/Zurich";

const isoDateTime = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), "startAt");

/** One franc short of a million, in cents. Anything above is a typo. */
const MAX_AMOUNT_CENTS = 100_000_000;

const money = z.number().int("amount").min(0, "amount").max(MAX_AMOUNT_CENTS, "amount");

// The return form's four, so "how the renter pays" has one vocabulary from
// the pickup to the return. One of them, not a list: the lessor asked for the
// way the rental is paid, not every way it might be.
const paymentMethod = z.enum(PAYMENT_METHODS, { message: "paidBy" });

// `strictObject`, not `object`: Zod strips unknown keys by default, which
// would have let a FIXED_TERM rental carrying a weeklyAmountCents through by
// silently discarding it. Making the impossible combination *unrepresentable*
// is the entire reason this is a union, so the extra key has to be an error
// rather than a thing quietly thrown away. The same goes for a weekly rental
// still carrying the `totalWeeks` the form no longer asks for.
export const rentalTermsSchema = z
  .discriminatedUnion("type", [
    z.strictObject({
      type: z.literal("WEEKLY"),
      startAt: isoDateTime,
      weeklyAmountCents: money,
      depositCents: money.default(0),
      paymentMethod,
    }),
    z.strictObject({
      type: z.literal("FIXED_TERM"),
      startAt: isoDateTime,
      endAt: isoDateTime,
      dailyAmountCents: money,
      depositCents: money.default(0),
      paymentMethod,
    }),
  ])
  .refine(
    (terms) =>
      terms.type !== "FIXED_TERM" ||
      Date.parse(terms.endAt) > Date.parse(terms.startAt),
    { message: "endBeforeStart", path: ["endAt"] }
  );

export type RentalTerms = z.infer<typeof rentalTermsSchema>;

/**
 * `startAt` plus whole weeks, in Zurich wall-clock terms.
 *
 * `TZDate` makes date-fns do its arithmetic in the named zone, so adding two
 * weeks across a DST boundary moves the calendar date and leaves the time of
 * day alone — which is what "two more weeks" means to the person holding the
 * keys.
 */
export function deriveEndAt(startAt: Date, totalWeeks: number): Date {
  const zoned = new TZDate(startAt.getTime(), ZURICH);
  return new Date(addWeeks(zoned, totalWeeks).getTime());
}

/** The weekday billing falls on, 0 = Sunday, read in Zurich. */
export function billingWeekdayOf(startAt: Date): number {
  return new TZDate(startAt.getTime(), ZURICH).getDay();
}

/**
 * The single accessor callers use, so neither shape leaks into their code.
 * Null for a weekly rental, which runs until the car comes back.
 */
export function resolveEndAt(terms: RentalTerms): Date | null {
  return terms.type === "WEEKLY" ? null : new Date(terms.endAt);
}

/** Zurich wall-clock time of an instant, on a clock that never changes. */
function wallClockMs(at: Date): number {
  const zoned = new TZDate(at.getTime(), ZURICH);
  return Date.UTC(
    zoned.getFullYear(),
    zoned.getMonth(),
    zoned.getDate(),
    zoned.getHours(),
    zoned.getMinutes(),
    zoned.getSeconds(),
    zoned.getMilliseconds()
  );
}

/**
 * The days a daily rental is charged for: every 24 hours begun, at least one.
 *
 * Counted on the Zurich wall clock. In elapsed time, Saturday 10:00 to Monday
 * 10:00 across the October changeover is 49 hours, which would bill three days
 * for what the renter and the office both call two.
 */
export function rentalDays(startAt: Date, endAt: Date): number {
  const ms = wallClockMs(endAt) - wallClockMs(startAt);
  return Math.max(1, Math.ceil(ms / 86_400_000));
}

/** What a daily rental comes to: its days at the price per day. */
export function dailyTotalCents(terms: {
  startAt: string;
  endAt: string;
  dailyAmountCents: number;
}): number {
  return (
    rentalDays(new Date(terms.startAt), new Date(terms.endAt)) *
    terms.dailyAmountCents
  );
}
