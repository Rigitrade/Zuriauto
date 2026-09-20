import { describe, expect, it } from "vitest";
import { markOutPeriod, markOutSchema, splitRenterName } from "./markOut";
import {
  isPlaceholderEmail,
  placeholderEmail,
} from "@/lib/rental/placeholder";

const parse = (input: { renterName?: string; startAt: string; endAt: string }) =>
  markOutSchema.parse(input);

describe("markOutSchema", () => {
  it("takes a car out with no renter named", () => {
    const parsed = markOutSchema.safeParse({
      startAt: "2026-09-20",
      endAt: "2026-09-27",
    });
    expect(parsed.success).toBe(true);
  });

  it("refuses anything that is not a day", () => {
    expect(
      markOutSchema.safeParse({ startAt: "2026-09-20T10:00", endAt: "2026-09-27" })
        .success
    ).toBe(false);
    expect(
      markOutSchema.safeParse({ startAt: "2026-02-31", endAt: "2026-09-27" }).success
    ).toBe(false);
  });
});

describe("markOutPeriod", () => {
  // 20.09.2026, mid-afternoon in Zurich.
  const today = new Date("2026-09-20T14:00:00.000Z");

  it("runs the return date to the end of its day, not the start", () => {
    // A car due back on the 27th is not overdue at 00:01 on the 27th. Using
    // dayStart for both ends would have the scheduler chasing a day early.
    const period = markOutPeriod(
      parse({ startAt: "2026-09-20", endAt: "2026-09-27" }),
      today
    );
    expect(period.ok).toBe(true);
    if (!period.ok) return;
    expect(period.startAt.toISOString()).toBe("2026-09-19T22:00:00.000Z");
    expect(period.endAt.toISOString()).toBe("2026-09-27T21:59:59.999Z");
  });

  it("accepts a car due back today", () => {
    const period = markOutPeriod(
      parse({ startAt: "2026-09-20", endAt: "2026-09-20" }),
      today
    );
    expect(period.ok).toBe(true);
  });

  it("refuses a return date already past", () => {
    // The whole reason this function exists: an ACTIVE rental whose endAt has
    // gone by is mailed an overdue notice by the daily pass, so marking a car
    // out with last week's date would chase a renter the office had only just
    // written down.
    const period = markOutPeriod(
      parse({ startAt: "2026-09-01", endAt: "2026-09-10" }),
      today
    );
    expect(period).toEqual({ ok: false, reason: "endInPast" });
  });

  it("refuses a return before the car went out", () => {
    const period = markOutPeriod(
      parse({ startAt: "2026-09-27", endAt: "2026-09-21" }),
      today
    );
    expect(period).toEqual({ ok: false, reason: "endBeforeStart" });
  });

  it("allows a start in the past, which is the normal case", () => {
    // The car left last week; that is why nobody could record its return.
    const period = markOutPeriod(
      parse({ startAt: "2026-09-10", endAt: "2026-09-25" }),
      today
    );
    expect(period.ok).toBe(true);
  });
});

describe("splitRenterName", () => {
  it("puts the whole name in lastName and guesses nothing", () => {
    expect(splitRenterName("Muddaser Khan")).toEqual({
      firstName: "",
      lastName: "Muddaser Khan",
    });
  });

  it("copes with nothing typed", () => {
    expect(splitRenterName(undefined)).toEqual({ firstName: "", lastName: "" });
  });
});

describe("placeholder addresses", () => {
  it("cannot be delivered anywhere", () => {
    expect(placeholderEmail("abc")).toBe("renter-abc@unrecorded.invalid");
  });

  it("is recognised so the customer copy is skipped", () => {
    expect(isPlaceholderEmail(placeholderEmail("abc"))).toBe(true);
    expect(isPlaceholderEmail("RENTER-ABC@UNRECORDED.INVALID")).toBe(true);
  });

  it("treats a missing address as a placeholder too", () => {
    expect(isPlaceholderEmail(null)).toBe(true);
    expect(isPlaceholderEmail("")).toBe(true);
  });

  it("leaves a real address alone", () => {
    expect(isPlaceholderEmail("someone@example.com")).toBe(false);
  });
});
