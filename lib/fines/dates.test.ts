import { describe, expect, it } from "vitest";
import { parseNumericDate, parseTime, parseWrittenDate } from "./dates";

describe("parseNumericDate", () => {
  it("reads the Swiss form", () => {
    expect(parseNumericDate("02.07.2026")).toBe("2026-07-02");
  });

  it("reads short days, months and years", () => {
    expect(parseNumericDate("2.7.26")).toBe("2026-07-02");
  });

  it("reads slashes", () => {
    expect(parseNumericDate("02/07/2026")).toBe("2026-07-02");
  });

  it("refuses a day the calendar does not have", () => {
    expect(parseNumericDate("31.02.2026")).toBeNull();
    expect(parseNumericDate("00.07.2026")).toBeNull();
    expect(parseNumericDate("12.13.2026")).toBeNull();
  });

  it("refuses what is not a date", () => {
    expect(parseNumericDate("303.1.a")).toBeNull();
    expect(parseNumericDate("forty")).toBeNull();
  });
});

describe("parseWrittenDate", () => {
  it("reads German, French and Italian month names", () => {
    expect(parseWrittenDate("Zürich, 4. September 2026")).toBe("2026-09-04");
    expect(parseWrittenDate("Lausanne, le 4 septembre 2026")).toBe("2026-09-04");
    expect(parseWrittenDate("Bellinzona, 4 settembre 2026")).toBe("2026-09-04");
  });

  it("reads accents and their absence", () => {
    expect(parseWrittenDate("1. März 2026")).toBe("2026-03-01");
    expect(parseWrittenDate("1. Maerz 2026")).toBe("2026-03-01");
    expect(parseWrittenDate("15 août 2026")).toBe("2026-08-15");
    expect(parseWrittenDate("15 aout 2026")).toBe("2026-08-15");
    expect(parseWrittenDate("3 février 2026")).toBe("2026-02-03");
    expect(parseWrittenDate("24 décembre 2026")).toBe("2026-12-24");
  });

  it("refuses an impossible day", () => {
    expect(parseWrittenDate("30. Februar 2026")).toBeNull();
  });
});

describe("parseTime", () => {
  it("reads the forms letters use", () => {
    expect(parseTime("10:00")).toBe("10:00");
    expect(parseTime("10.00 Uhr")).toBe("10:00");
    expect(parseTime("8h15")).toBe("08:15");
    expect(parseTime("ore 17:40")).toBe("17:40");
  });

  it("refuses an impossible time", () => {
    expect(parseTime("25:00")).toBeNull();
    expect(parseTime("10:61")).toBeNull();
  });
});
