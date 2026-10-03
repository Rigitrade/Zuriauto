import { describe, expect, it } from "vitest";
import {
  HANDOVER_MARGIN_MS,
  intervalOf,
  momentOf,
  responsibleAt,
  type Interval,
  type RentalFacts,
} from "./possession";

const HOUR = 60 * 60 * 1000;
const at = (iso: string) => new Date(iso);

function facts(overrides: Partial<RentalFacts>): RentalFacts {
  return {
    rentalId: "r1",
    customerId: "c1",
    status: "COMPLETED",
    createdBy: "office",
    startAt: at("2026-06-01T08:00:00Z"),
    endAt: at("2026-07-27T08:00:00Z"),
    pickupSignedAt: at("2026-06-01T08:10:00Z"),
    returnSignedAt: at("2026-07-10T16:00:00Z"),
    closedAt: at("2026-07-10T16:00:00Z"),
    ...overrides,
  };
}

describe("intervalOf", () => {
  it("runs from the signed pickup to the actual return, not the booked end", () => {
    expect(intervalOf(facts({}))).toEqual({
      rentalId: "r1",
      customerId: "c1",
      from: at("2026-06-01T08:10:00Z"),
      to: at("2026-07-10T16:00:00Z"),
    });
  });

  it("ends at whichever came first, the return form or the close", () => {
    const interval = intervalOf(
      facts({ returnSignedAt: at("2026-07-10T15:00:00Z"), closedAt: at("2026-07-11T09:00:00Z") })
    );
    expect(interval?.to).toEqual(at("2026-07-10T15:00:00Z"));
  });

  it("stays open while the car is still out, even past its booked end", () => {
    const interval = intervalOf(
      facts({ status: "ACTIVE", returnSignedAt: null, closedAt: null })
    );
    expect(interval?.to).toBeNull();
  });

  it("starts at startAt for a rental with no pickup contract", () => {
    expect(intervalOf(facts({ pickupSignedAt: null }))?.from).toEqual(at("2026-06-01T08:00:00Z"));
  });

  it("uses an imported rental's recorded end when nothing better exists", () => {
    const interval = intervalOf(
      facts({ createdBy: "import:legacy-pdf", returnSignedAt: null, closedAt: null })
    );
    expect(interval?.to).toEqual(at("2026-07-27T08:00:00Z"));
  });

  it("knows nothing about a closed rental with no record of its end", () => {
    expect(intervalOf(facts({ returnSignedAt: null, closedAt: null }))).toBeNull();
  });

  it("ignores a cancelled rental — the car never left", () => {
    expect(intervalOf(facts({ status: "CANCELLED" }))).toBeNull();
  });
});

const ANNA: Interval = {
  rentalId: "anna",
  customerId: "c-anna",
  from: at("2026-06-01T08:00:00Z"),
  to: at("2026-07-10T16:00:00Z"),
};
const LUCA: Interval = {
  rentalId: "luca",
  customerId: "c-luca",
  from: at("2026-07-12T09:00:00Z"),
  to: null,
};

const instant = (iso: string) => ({ kind: "instant" as const, at: at(iso) });

describe("responsibleAt — a moment with a time", () => {
  it("names whoever had the car, well inside their rental", () => {
    expect(responsibleAt([ANNA, LUCA], instant("2026-07-02T08:00:00Z"))).toEqual({
      ok: true,
      rentalId: "anna",
      customerId: "c-anna",
    });
  });

  it("names a renter who kept the car past the booked end", () => {
    expect(responsibleAt([ANNA, LUCA], instant("2026-12-01T08:00:00Z"))).toMatchObject({
      ok: true,
      rentalId: "luca",
    });
  });

  it("names nobody between an early return and the next pickup", () => {
    expect(responsibleAt([ANNA, LUCA], instant("2026-07-11T12:00:00Z"))).toMatchObject({
      ok: false,
      reason: "NO_RENTAL_AT_TIME",
    });
  });

  it("hands a moment close to a handover to a person", () => {
    const justAfter = new Date(ANNA.from.getTime() + HANDOVER_MARGIN_MS - 60_000);
    expect(responsibleAt([ANNA], { kind: "instant", at: justAfter })).toMatchObject({
      ok: false,
      reason: "HANDOVER_BOUNDARY",
    });
    const justAfterReturn = new Date(ANNA.to!.getTime() + HOUR);
    expect(responsibleAt([ANNA], { kind: "instant", at: justAfterReturn })).toMatchObject({
      ok: false,
      reason: "HANDOVER_BOUNDARY",
    });
  });

  it("decides on its own exactly two hours from a handover", () => {
    const twoHours = new Date(ANNA.from.getTime() + HANDOVER_MARGIN_MS);
    expect(responsibleAt([ANNA], { kind: "instant", at: twoHours })).toMatchObject({
      ok: true,
      rentalId: "anna",
    });
  });

  it("refuses to choose between overlapping rentals", () => {
    const overlapping = { ...LUCA, from: at("2026-06-20T08:00:00Z") };
    expect(responsibleAt([ANNA, overlapping], instant("2026-07-02T08:00:00Z"))).toMatchObject({
      ok: false,
      reason: "OVERLAPPING_RENTALS",
      candidates: ["anna", "luca"],
    });
  });
});

describe("responsibleAt — a date without a time", () => {
  it("names the renter who had the car all day", () => {
    const day = momentOf("2026-07-02", null)!;
    expect(responsibleAt([ANNA, LUCA], day)).toMatchObject({ ok: true, rentalId: "anna" });
  });

  it("hands a day with a handover in it to a person", () => {
    const day = momentOf("2026-07-12", null)!;
    expect(responsibleAt([ANNA, LUCA], day)).toMatchObject({
      ok: false,
      reason: "HANDOVER_BOUNDARY",
    });
  });
});

describe("momentOf", () => {
  it("reads the letter's time as Zurich, not UTC", () => {
    // Half past midnight on 2 July in Zurich is still 1 July in UTC — read as
    // UTC, the fine would go to whoever had the car the evening before.
    expect(momentOf("2026-07-02", "00:30")).toEqual(instant("2026-07-01T22:30:00Z"));
    expect(momentOf("2026-01-15", "12:00")).toEqual(instant("2026-01-15T11:00:00Z"));
  });

  it("gives the repeated autumn hour one of its two instants", () => {
    const moment = momentOf("2026-10-25", "02:30");
    expect(moment?.kind).toBe("instant");
    const iso = moment?.kind === "instant" ? moment.at.toISOString() : "";
    expect(["2026-10-25T00:30:00.000Z", "2026-10-25T01:30:00.000Z"]).toContain(iso);
  });

  it("turns a bare date into the whole Zurich day", () => {
    expect(momentOf("2026-07-02", null)).toEqual({
      kind: "day",
      from: at("2026-07-01T22:00:00Z"),
      to: at("2026-07-02T22:00:00Z"),
    });
  });

  it("refuses nonsense", () => {
    expect(momentOf("2026-02-31", "10:00")).toBeNull();
  });
});
