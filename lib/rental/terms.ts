/**
 * The commercial terms of a rental.
 *
 * Two shapes on one table, as the roadmap sets out: WEEKLY reproduces what the
 * Uber and taxi drivers already have — N weeks at a fixed weekly amount —
 * while FIXED_TERM serves tourists with an explicit end and a single price.
 * Both carry `endAt`, so the Phase 3 reminder is one query rather than two code
 * paths that can drift.
 */

import { TZDate } from "@date-fns/tz";
import { addWeeks } from "date-fns";
import { z } from "zod";

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

// `strictObject`, not `object`: Zod strips unknown keys by default, which
// would have let a FIXED_TERM rental carrying a weeklyAmountCents through by
// silently discarding it. Making the impossible combination *unrepresentable*
// is the entire reason this is a union, so the extra key has to be an error
// rather than a thing quietly thrown away.
export const rentalTermsSchema = z
  .discriminatedUnion("type", [
    z.strictObject({
      type: z.literal("WEEKLY"),
      startAt: isoDateTime,
      // Two years is the ceiling. Longer than that is a lease, not a rental.
      totalWeeks: z.number().int("totalWeeks").min(1, "totalWeeks").max(104, "totalWeeks"),
      weeklyAmountCents: money,
      depositCents: money.default(0),
    }),
    z.strictObject({
      type: z.literal("FIXED_TERM"),
      startAt: isoDateTime,
      endAt: isoDateTime,
      totalAmountCents: money,
      depositCents: money.default(0),
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

/** The single accessor callers use, so neither shape leaks into their code. */
export function resolveEndAt(terms: RentalTerms): Date {
  const startAt = new Date(terms.startAt);
  return terms.type === "WEEKLY"
    ? deriveEndAt(startAt, terms.totalWeeks)
    : new Date(terms.endAt);
}
