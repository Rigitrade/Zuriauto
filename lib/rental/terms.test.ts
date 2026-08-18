import { describe, expect, it } from "vitest";
import {
  billingWeekdayOf,
  deriveEndAt,
  rentalTermsSchema,
  resolveEndAt,
} from "./terms";

describe("deriveEndAt", () => {
  it("adds whole weeks", () => {
    const start = new Date("2026-03-02T10:00:00.000Z");
    expect(deriveEndAt(start, 2).toISOString()).toBe("2026-03-16T10:00:00.000Z");
  });

  it("crosses a month boundary", () => {
    const start = new Date("2026-01-28T09:30:00.000Z");
    expect(deriveEndAt(start, 1).toISOString()).toBe("2026-02-04T09:30:00.000Z");
  });

  it("crosses a year boundary", () => {
    const start = new Date("2026-12-24T14:00:00.000Z");
    expect(deriveEndAt(start, 2).toISOString()).toBe("2027-01-07T14:00:00.000Z");
  });

  it("keeps the Zurich wall-clock time across the spring DST change", () => {
    // Zurich moves to CEST on 29 March 2026. A car handed over at 10:00 local
    // on the 22nd is due back at 10:00 local on 5 April — which is 08:00 UTC,
    // not the 09:00 UTC that naive millisecond addition would produce.
    const start = new Date("2026-03-22T09:00:00.000Z"); // 10:00 CET
    expect(deriveEndAt(start, 2).toISOString()).toBe("2026-04-05T08:00:00.000Z");
  });

  it("keeps the Zurich wall-clock time across the autumn DST change", () => {
    // Zurich returns to CET on 25 October 2026.
    const start = new Date("2026-10-18T08:00:00.000Z"); // 10:00 CEST
    expect(deriveEndAt(start, 2).toISOString()).toBe("2026-11-01T09:00:00.000Z");
  });
});

describe("billingWeekdayOf", () => {
  it("reads the weekday in Zurich, not in UTC", () => {
    // 23:30 UTC on a Sunday is already Monday in Zurich.
    const lateSunday = new Date("2026-03-01T23:30:00.000Z");
    expect(billingWeekdayOf(lateSunday)).toBe(1);
  });
});

describe("rentalTermsSchema", () => {
  const weekly = {
    type: "WEEKLY",
    startAt: "2026-03-02T10:00:00.000Z",
    totalWeeks: 4,
    weeklyAmountCents: 45_000,
    depositCents: 50_000,
  };

  const fixed = {
    type: "FIXED_TERM",
    startAt: "2026-03-02T10:00:00.000Z",
    endAt: "2026-03-09T10:00:00.000Z",
    totalAmountCents: 60_000,
    depositCents: 0,
  };

  it("accepts a weekly rental", () => {
    expect(rentalTermsSchema.safeParse(weekly).success).toBe(true);
  });

  it("accepts a fixed-term rental", () => {
    expect(rentalTermsSchema.safeParse(fixed).success).toBe(true);
  });

  it("rejects a fixed-term rental carrying a weekly amount", () => {
    // The whole point of the union: an impossible combination cannot validate.
    const impossible = { ...fixed, weeklyAmountCents: 45_000 };
    expect(rentalTermsSchema.safeParse(impossible).success).toBe(false);
  });

  it("rejects a weekly rental with no duration", () => {
    const { totalWeeks: _omitted, ...rest } = weekly;
    expect(rentalTermsSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects a fixed-term rental that ends before it starts", () => {
    const backwards = { ...fixed, endAt: "2026-03-01T10:00:00.000Z" };
    expect(rentalTermsSchema.safeParse(backwards).success).toBe(false);
  });

  it("rejects a fixed-term rental that ends exactly when it starts", () => {
    const zero = { ...fixed, endAt: fixed.startAt };
    expect(rentalTermsSchema.safeParse(zero).success).toBe(false);
  });

  it("rejects zero weeks and more than two years", () => {
    expect(rentalTermsSchema.safeParse({ ...weekly, totalWeeks: 0 }).success).toBe(
      false
    );
    expect(
      rentalTermsSchema.safeParse({ ...weekly, totalWeeks: 105 }).success
    ).toBe(false);
  });

  it("rejects a negative amount", () => {
    expect(
      rentalTermsSchema.safeParse({ ...weekly, weeklyAmountCents: -1 }).success
    ).toBe(false);
  });

  it("rejects an unparseable start", () => {
    expect(
      rentalTermsSchema.safeParse({ ...weekly, startAt: "not a date" }).success
    ).toBe(false);
  });

  it("defaults the deposit to zero", () => {
    const { depositCents: _omitted, ...rest } = weekly;
    const parsed = rentalTermsSchema.parse(rest);
    expect(parsed.depositCents).toBe(0);
  });

  it("resolves endAt for both shapes", () => {
    // 10:00 UTC on 2 March is 11:00 in Zurich. Four weeks later is 30 March,
    // the day after the clocks go forward, so 11:00 local is 09:00 UTC — not
    // the 10:00 UTC that adding 28 × 86 400 000 ms would give.
    expect(resolveEndAt(rentalTermsSchema.parse(weekly)).toISOString()).toBe(
      "2026-03-30T09:00:00.000Z"
    );
    expect(resolveEndAt(rentalTermsSchema.parse(fixed)).toISOString()).toBe(
      "2026-03-09T10:00:00.000Z"
    );
  });
});
