import { describe, expect, it } from "vitest";
import {
  dayEnd,
  dayStart,
  matchesCar,
  parseWindow,
  windowLabel,
} from "./carHistory";

/** Builds the query the route actually receives. */
function query(search: string): URLSearchParams {
  return new URLSearchParams(search);
}

describe("parseWindow", () => {
  it("reads no window at all as the whole history", () => {
    const result = parseWindow(query(""));
    expect(result.ok).toBe(true);
    expect(result.ok && result.window).toBeNull();
  });

  it("reads a from and a to as the window between them", () => {
    const result = parseWindow(
      query("from=2026-07-01T00:00:00.000Z&to=2026-07-31T00:00:00.000Z")
    );
    expect(result.ok).toBe(true);
    expect(result.ok && result.window).toEqual({
      from: new Date("2026-07-01T00:00:00.000Z"),
      to: new Date("2026-07-31T00:00:00.000Z"),
    });
  });

  it("reads a lone from as that single instant", () => {
    // The ticket case: one moment, not a range. Leaving `to` open would
    // return every rental since, and the office would read the first row as
    // the answer.
    const result = parseWindow(query("from=2026-07-12T14:30:00.000Z"));
    expect(result.ok && result.window).toEqual({
      from: new Date("2026-07-12T14:30:00.000Z"),
      to: new Date("2026-07-12T14:30:00.000Z"),
    });
  });

  it("reads a lone to as that single instant", () => {
    const result = parseWindow(query("to=2026-07-12T14:30:00.000Z"));
    expect(result.ok && result.window).toEqual({
      from: new Date("2026-07-12T14:30:00.000Z"),
      to: new Date("2026-07-12T14:30:00.000Z"),
    });
  });

  it("refuses a date it cannot parse", () => {
    expect(parseWindow(query("from=the-twelfth")).ok).toBe(false);
    expect(parseWindow(query("to=")).ok).toBe(false);
  });

  it("refuses a window that ends before it starts", () => {
    // Almost always two dates typed the wrong way round. Answering it would
    // mean reporting that nobody had the car, which is indistinguishable on
    // screen from a genuine gap.
    const result = parseWindow(
      query("from=2026-07-31T00:00:00.000Z&to=2026-07-01T00:00:00.000Z")
    );
    expect(result.ok).toBe(false);
  });

  it("accepts a window that starts and ends at the same instant", () => {
    const result = parseWindow(
      query("from=2026-07-12T00:00:00.000Z&to=2026-07-12T00:00:00.000Z")
    );
    expect(result.ok).toBe(true);
  });
});

describe("dayStart and dayEnd", () => {
  it("starts a summer day at midnight in Zurich, not in UTC", () => {
    // `new Date("2026-07-12")` is UTC midnight, which is 02:00 in Zurich — so
    // a fine issued at 00:30 that night would fall outside the day the office
    // searched for.
    expect(dayStart("2026-07-12")?.toISOString()).toBe("2026-07-11T22:00:00.000Z");
  });

  it("ends a summer day at the last millisecond in Zurich", () => {
    expect(dayEnd("2026-07-12")?.toISOString()).toBe("2026-07-12T21:59:59.999Z");
  });

  it("follows Zurich off summer time in winter", () => {
    // CET rather than CEST: one hour, and the whole point of asking the zone
    // rather than hard-coding an offset.
    expect(dayStart("2026-01-12")?.toISOString()).toBe("2026-01-11T23:00:00.000Z");
  });

  it("refuses something that is not a day", () => {
    expect(dayStart("")).toBeNull();
    expect(dayStart("12.07.2026")).toBeNull();
    expect(dayEnd("2026-13-45")).toBeNull();
  });
});

describe("matchesCar", () => {
  const vito = { model: "Mercedes Vito 119", plate: "ZH 589 864" };

  it("matches a plate typed without its spaces", () => {
    // How a plate is read off a ticket and typed at speed.
    expect(matchesCar(vito, "zh589864")).toBe(true);
  });

  it("matches part of a plate", () => {
    expect(matchesCar(vito, "589")).toBe(true);
  });

  it("matches the model, whatever the case", () => {
    expect(matchesCar(vito, "vito")).toBe(true);
    expect(matchesCar(vito, "MERCEDES")).toBe(true);
  });

  it("does not match an unrelated search", () => {
    expect(matchesCar(vito, "octavia")).toBe(false);
    expect(matchesCar(vito, "ZH 111")).toBe(false);
  });

  it("treats an empty search as matching everything", () => {
    // The screen shows the whole fleet before anybody types.
    expect(matchesCar(vito, "")).toBe(true);
    expect(matchesCar(vito, "   ")).toBe(true);
  });
});

describe("windowLabel", () => {
  it("names the whole history when no day was given", () => {
    expect(windowLabel("", "")).toBeNull();
  });

  it("names a single day once, not as a range onto itself", () => {
    expect(windowLabel("2026-07-12", "")).toBe("12.07.2026");
    expect(windowLabel("", "2026-07-12")).toBe("12.07.2026");
    expect(windowLabel("2026-07-12", "2026-07-12")).toBe("12.07.2026");
  });

  it("names a range by its two ends", () => {
    expect(windowLabel("2026-07-01", "2026-07-31")).toBe("01.07.2026 – 31.07.2026");
  });

  it("names the day the office typed, not the UTC instant it becomes", () => {
    // The bug this function exists to prevent: midnight on the 12th in Zurich
    // is 22:00 on the 11th in UTC, so formatting the instant sent to the
    // server would head the screen "11.07.2026" for a search of the 12th.
    expect(windowLabel("2026-07-12", "2026-07-12")).not.toContain("11.07");
  });
});
