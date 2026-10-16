import { describe, expect, it } from "vitest";
import {
  billingWeekdayOf,
  dailyTotalCents,
  deriveEndAt,
  rentalDays,
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

describe("rentalDays", () => {
  it("counts whole days", () => {
    expect(
      rentalDays(
        new Date("2026-03-02T09:00:00.000Z"),
        new Date("2026-03-05T09:00:00.000Z")
      )
    ).toBe(3);
  });

  it("counts a day begun as a day", () => {
    // One minute into the fourth day is four days, as a rental counts them.
    expect(
      rentalDays(
        new Date("2026-03-02T09:00:00.000Z"),
        new Date("2026-03-05T09:01:00.000Z")
      )
    ).toBe(4);
  });

  it("charges an afternoon as one day", () => {
    expect(
      rentalDays(
        new Date("2026-03-02T09:00:00.000Z"),
        new Date("2026-03-02T15:00:00.000Z")
      )
    ).toBe(1);
  });

  it("counts on the Zurich wall clock across the autumn DST change", () => {
    // Saturday 24 October 10:00 CEST to Monday 26 October 10:00 CET: two days
    // to the renter, 49 hours elapsed. Counting elapsed time would bill three.
    expect(
      rentalDays(
        new Date("2026-10-24T08:00:00.000Z"),
        new Date("2026-10-26T09:00:00.000Z")
      )
    ).toBe(2);
  });

  it("counts on the Zurich wall clock across the spring DST change", () => {
    // Saturday 28 March 10:00 CET to Monday 30 March 10:00 CEST: two days,
    // though only 47 hours elapse.
    expect(
      rentalDays(
        new Date("2026-03-28T09:00:00.000Z"),
        new Date("2026-03-30T08:00:00.000Z")
      )
    ).toBe(2);
  });
});

describe("dailyTotalCents", () => {
  it("is the days at the price per day", () => {
    expect(
      dailyTotalCents({
        startAt: "2026-03-02T09:00:00.000Z",
        endAt: "2026-03-05T12:00:00.000Z",
        dailyAmountCents: 8_000,
      })
    ).toBe(4 * 8_000);
  });
});

describe("rentalTermsSchema", () => {
  const weekly = {
    type: "WEEKLY",
    startAt: "2026-03-02T10:00:00.000Z",
    weeklyAmountCents: 45_000,
    depositCents: 50_000,
    paymentMethod: "twint",
  };

  const daily = {
    type: "FIXED_TERM",
    startAt: "2026-03-02T10:00:00.000Z",
    endAt: "2026-03-09T10:00:00.000Z",
    dailyAmountCents: 8_000,
    depositCents: 0,
    paymentMethod: "cash",
  };

  it("accepts a weekly rental", () => {
    expect(rentalTermsSchema.safeParse(weekly).success).toBe(true);
  });

  it("accepts a daily rental", () => {
    expect(rentalTermsSchema.safeParse(daily).success).toBe(true);
  });

  it("rejects a daily rental carrying a weekly amount", () => {
    // The whole point of the union: an impossible combination cannot validate.
    const impossible = { ...daily, weeklyAmountCents: 45_000 };
    expect(rentalTermsSchema.safeParse(impossible).success).toBe(false);
  });

  it("takes the number of weeks the office entered", () => {
    const parsed = rentalTermsSchema.parse({ ...weekly, totalWeeks: 4 });
    expect(parsed.type === "WEEKLY" && parsed.totalWeeks).toBe(4);
  });

  it("books one week when the office leaves the number of weeks empty", () => {
    // The owner's choice of 16.10.2026: optional, one week unless the renter
    // agrees to more. Each later week is an extension.
    const parsed = rentalTermsSchema.parse(weekly);
    expect(parsed.type === "WEEKLY" && parsed.totalWeeks).toBe(1);
  });

  it("rejects a number of weeks outside 1 to 104, and names the field", () => {
    for (const totalWeeks of [0, 105, 1.5]) {
      const result = rentalTermsSchema.safeParse({ ...weekly, totalWeeks });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("totalWeeks");
    }
  });

  it("rejects a daily rental priced as a total, as the fixed term was", () => {
    const { dailyAmountCents: _omitted, ...rest } = daily;
    const old = { ...rest, totalAmountCents: 60_000 };
    expect(rentalTermsSchema.safeParse(old).success).toBe(false);
  });

  it("requires a way to pay, and names the field when it is missing", () => {
    const { paymentMethod: _omitted, ...rest } = weekly;
    const parsed = rentalTermsSchema.safeParse(rest);
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]).toMatchObject({
      path: ["paymentMethod"],
      message: "paidBy",
    });
  });

  it("takes the four ways the lessor listed, and nothing else", () => {
    for (const method of ["cash", "twint", "card", "bank"]) {
      expect(
        rentalTermsSchema.safeParse({ ...weekly, paymentMethod: method }).success
      ).toBe(true);
    }
    expect(
      rentalTermsSchema.safeParse({ ...weekly, paymentMethod: "crypto" }).success
    ).toBe(false);
  });

  it("rejects a daily rental that ends before it starts", () => {
    const backwards = { ...daily, endAt: "2026-03-01T10:00:00.000Z" };
    expect(rentalTermsSchema.safeParse(backwards).success).toBe(false);
  });

  it("rejects a daily rental that ends exactly when it starts", () => {
    const zero = { ...daily, endAt: daily.startAt };
    expect(rentalTermsSchema.safeParse(zero).success).toBe(false);
  });

  it("rejects a negative amount", () => {
    expect(
      rentalTermsSchema.safeParse({ ...weekly, weeklyAmountCents: -1 }).success
    ).toBe(false);
    expect(
      rentalTermsSchema.safeParse({ ...daily, dailyAmountCents: -1 }).success
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

  it("ends a weekly rental after its weeks, and a daily one at its own end", () => {
    expect(resolveEndAt(rentalTermsSchema.parse(weekly))?.toISOString()).toBe(
      "2026-03-09T10:00:00.000Z"
    );
    expect(
      resolveEndAt(rentalTermsSchema.parse({ ...weekly, totalWeeks: 3 }))?.toISOString()
    ).toBe("2026-03-23T10:00:00.000Z");
    expect(resolveEndAt(rentalTermsSchema.parse(daily))?.toISOString()).toBe(
      "2026-03-09T10:00:00.000Z"
    );
  });
});
