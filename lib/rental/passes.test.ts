import { describe, expect, it } from "vitest";
import {
  REMINDER_LOOKAHEAD_HOURS,
  endingSoonWindow,
  generateWeeklyCharges,
  hoursBetween,
  isDueForChargeOverdue,
  isDueForChargeReminder,
  isDueForChargeRequest,
  isRentalOverdue,
  isRentalEndingSoon,
  zurichDayString,
} from "./passes";

const at = (iso: string) => new Date(iso);

describe("zurichDayString", () => {
  it("reads the calendar day in Zurich, not in UTC", () => {
    // 23:30 UTC in August is 01:30 the next day in Zurich (CEST).
    expect(zurichDayString(at("2026-08-17T23:30:00Z"))).toBe("2026-08-18");
  });

  it("handles the winter offset too", () => {
    // 23:30 UTC in January is 00:30 the next day in Zurich (CET).
    expect(zurichDayString(at("2026-01-17T23:30:00Z"))).toBe("2026-01-18");
  });

  it("stays on the same day mid-afternoon", () => {
    expect(zurichDayString(at("2026-08-17T12:00:00Z"))).toBe("2026-08-17");
  });
});

describe("hoursBetween", () => {
  it("counts forward across a day boundary", () => {
    expect(
      hoursBetween(at("2026-08-17T00:00:00Z"), at("2026-08-18T12:00:00Z"))
    ).toBe(36);
  });

  it("goes negative when the second instant is earlier", () => {
    expect(
      hoursBetween(at("2026-08-18T00:00:00Z"), at("2026-08-17T00:00:00Z"))
    ).toBe(-24);
  });
});

describe("isRentalEndingSoon", () => {
  const now = at("2026-08-18T09:00:00Z");

  it("reminds a rental ending in 36 hours", () => {
    expect(isRentalEndingSoon({ endAt: at("2026-08-19T21:00:00Z") }, now)).toBe(
      true
    );
  });

  it("reminds a rental ending in 25 hours", () => {
    expect(isRentalEndingSoon({ endAt: at("2026-08-19T10:00:00Z") }, now)).toBe(
      true
    );
  });

  it("does not remind a rental ending in 90 hours", () => {
    expect(isRentalEndingSoon({ endAt: at("2026-08-22T03:00:00Z") }, now)).toBe(
      false
    );
  });

  it("does not remind a rental that has already ended", () => {
    // That is the overdue pass's job, not this one.
    expect(isRentalEndingSoon({ endAt: at("2026-08-17T09:00:00Z") }, now)).toBe(
      false
    );
  });

  it("catches a rental ending tomorrow morning, which a 24h window would miss", () => {
    // The reason the window is 48 hours wide: a 09:00 cron looking only 24
    // hours ahead never sees an 08:00 end the next day.
    const endsTomorrowMorning = at("2026-08-19T06:00:00Z");
    expect(hoursBetween(now, endsTomorrowMorning)).toBeLessThan(24);
    expect(isRentalEndingSoon({ endAt: endsTomorrowMorning }, now)).toBe(true);
  });

  it("includes the far boundary and excludes just past it", () => {
    const edge = new Date(
      now.getTime() + REMINDER_LOOKAHEAD_HOURS * 3_600_000
    );
    expect(isRentalEndingSoon({ endAt: edge }, now)).toBe(true);
    expect(
      isRentalEndingSoon({ endAt: new Date(edge.getTime() + 1000) }, now)
    ).toBe(false);
  });
});

describe("endingSoonWindow", () => {
  it("spans now to the lookahead", () => {
    const now = at("2026-08-18T09:00:00Z");
    const { from, to } = endingSoonWindow(now);
    expect(from.toISOString()).toBe("2026-08-18T09:00:00.000Z");
    expect(hoursBetween(from, to)).toBe(REMINDER_LOOKAHEAD_HOURS);
  });
});

describe("isRentalOverdue", () => {
  const now = at("2026-08-18T09:00:00Z");

  it("flags a rental whose end has passed", () => {
    expect(isRentalOverdue({ endAt: at("2026-08-17T09:00:00Z") }, now)).toBe(
      true
    );
  });

  it("does not flag one still running", () => {
    expect(isRentalOverdue({ endAt: at("2026-08-19T09:00:00Z") }, now)).toBe(
      false
    );
  });

  it("does not flag one ending exactly now", () => {
    expect(isRentalOverdue({ endAt: now }, now)).toBe(false);
  });
});

describe("isDueForChargeRequest", () => {
  const now = at("2026-08-18T09:00:00Z");

  it("requests a charge due today in Zurich terms", () => {
    expect(
      isDueForChargeRequest(
        { status: "SCHEDULED", dueDate: at("2026-08-18T00:00:00Z") },
        now
      )
    ).toBe(true);
  });

  it("requests a charge whose due date has passed", () => {
    expect(
      isDueForChargeRequest(
        { status: "SCHEDULED", dueDate: at("2026-08-11T00:00:00Z") },
        now
      )
    ).toBe(true);
  });

  it("does not request a charge due tomorrow", () => {
    expect(
      isDueForChargeRequest(
        { status: "SCHEDULED", dueDate: at("2026-08-19T00:00:00Z") },
        now
      )
    ).toBe(false);
  });

  it("ignores a charge that is not scheduled", () => {
    expect(
      isDueForChargeRequest(
        { status: "REQUESTED", dueDate: at("2026-08-11T00:00:00Z") },
        now
      )
    ).toBe(false);
  });
});

describe("isDueForChargeReminder", () => {
  const requestedAt = at("2026-08-15T09:00:00Z");

  it("reminds once the threshold has elapsed", () => {
    expect(
      isDueForChargeReminder(
        { status: "REQUESTED", requestedAt },
        at("2026-08-18T09:00:00Z"),
        72
      )
    ).toBe(true);
  });

  it("does not remind one second early", () => {
    expect(
      isDueForChargeReminder(
        { status: "REQUESTED", requestedAt },
        at("2026-08-18T08:59:59Z"),
        72
      )
    ).toBe(false);
  });

  it("does not remind a charge with no requestedAt", () => {
    expect(
      isDueForChargeReminder(
        { status: "REQUESTED", requestedAt: null },
        at("2026-09-01T09:00:00Z"),
        72
      )
    ).toBe(false);
  });

  it("ignores a charge in another status", () => {
    expect(
      isDueForChargeReminder(
        { status: "PAID", requestedAt },
        at("2026-09-01T09:00:00Z"),
        72
      )
    ).toBe(false);
  });
});

describe("isDueForChargeOverdue", () => {
  const remindedAt = at("2026-08-15T09:00:00Z");

  it("alerts once the threshold has elapsed", () => {
    expect(
      isDueForChargeOverdue(
        { status: "REMINDED", remindedAt },
        at("2026-08-17T09:00:00Z"),
        48
      )
    ).toBe(true);
  });

  it("does not alert early", () => {
    expect(
      isDueForChargeOverdue(
        { status: "REMINDED", remindedAt },
        at("2026-08-16T09:00:00Z"),
        48
      )
    ).toBe(false);
  });

  it("ignores a charge that was never reminded", () => {
    expect(
      isDueForChargeOverdue(
        { status: "REMINDED", remindedAt: null },
        at("2026-09-01T09:00:00Z"),
        48
      )
    ).toBe(false);
  });
});

describe("generateWeeklyCharges", () => {
  it("produces one charge per week, seven days apart", () => {
    const charges = generateWeeklyCharges({
      startAt: at("2026-08-18T08:00:00Z"),
      fromWeek: 1,
      weeks: 3,
      amountCents: 45_000,
    });
    expect(charges).toHaveLength(3);
    expect(charges.map((c) => c.weekNumber)).toEqual([1, 2, 3]);
    expect(charges[0].dueDate.toISOString()).toBe("2026-08-18T08:00:00.000Z");
    expect(charges[2].dueDate.toISOString()).toBe("2026-09-01T08:00:00.000Z");
  });

  it("keeps the Zurich time of day across a DST change", () => {
    // The same rule as deriveEndAt: a charge should fall due at the same local
    // time every week, not drift by an hour at the end of October.
    const charges = generateWeeklyCharges({
      startAt: at("2026-10-18T08:00:00Z"), // 10:00 CEST
      fromWeek: 1,
      weeks: 3,
      amountCents: 45_000,
    });
    // Week 3 is 1 November, after the clocks go back: 10:00 CET is 09:00 UTC.
    expect(charges[2].dueDate.toISOString()).toBe("2026-11-01T09:00:00.000Z");
  });

  it("crosses a month boundary", () => {
    const charges = generateWeeklyCharges({
      startAt: at("2026-01-28T09:00:00Z"),
      fromWeek: 1,
      weeks: 2,
      amountCents: 10_000,
    });
    expect(charges[1].dueDate.toISOString()).toBe("2026-02-04T09:00:00.000Z");
  });

  it("continues the sequence for an extension", () => {
    // An extension adds weeks 5 and 6 to a four-week rental, and their due
    // dates continue from the original start rather than from today.
    const charges = generateWeeklyCharges({
      startAt: at("2026-08-18T08:00:00Z"),
      fromWeek: 5,
      weeks: 2,
      amountCents: 45_000,
    });
    expect(charges.map((c) => c.weekNumber)).toEqual([5, 6]);
    expect(charges[0].dueDate.toISOString()).toBe("2026-09-15T08:00:00.000Z");
  });

  it("refuses nonsense", () => {
    const base = {
      startAt: at("2026-08-18T08:00:00Z"),
      fromWeek: 1,
      amountCents: 45_000,
    };
    expect(() => generateWeeklyCharges({ ...base, weeks: 0 })).toThrow();
    expect(() => generateWeeklyCharges({ ...base, weeks: 1.5 })).toThrow();
    expect(() =>
      generateWeeklyCharges({ ...base, weeks: 1, amountCents: -1 })
    ).toThrow();
  });
});
