import { describe, expect, it } from "vitest";
import { mfkStanding } from "./mfk";

/** 07:00 Zurich on the 12th of July. */
const now = new Date("2026-07-12T05:00:00.000Z");

describe("mfkStanding", () => {
  it("says nothing about a car with no date recorded", () => {
    expect(mfkStanding(null, now)).toBe("none");
    expect(mfkStanding("", now)).toBe("none");
  });

  it("is quiet while the inspection is comfortably ahead", () => {
    expect(mfkStanding("2026-08-01", now)).toBe("ok");
    expect(mfkStanding("2026-07-15", now)).toBe("ok");
  });

  it("warns from two days out — the same notice the email uses", () => {
    // The screen and the mail must agree about what "due" means, or the office
    // gets a warning about a car the fleet page still shows as fine.
    expect(mfkStanding("2026-07-14", now)).toBe("due");
    expect(mfkStanding("2026-07-13", now)).toBe("due");
    expect(mfkStanding("2026-07-12", now)).toBe("due");
  });

  it("calls it overdue only once the day itself has passed", () => {
    expect(mfkStanding("2026-07-11", now)).toBe("expired");
  });

  it("reads the day in Zurich, not wherever the browser is", () => {
    // 23:30 UTC on the 11th is already the 12th in Zurich, so an inspection on
    // the 14th is two days out and due.
    expect(mfkStanding("2026-07-14", new Date("2026-07-11T23:30:00.000Z"))).toBe(
      "due"
    );
  });

  it("refuses to guess at a malformed date", () => {
    expect(mfkStanding("14.07.2026", now)).toBe("none");
  });
});
