import { describe, expect, it } from "vitest";
import { formatChf, parseChf } from "./money";

describe("parseChf", () => {
  it("reads a plain amount", () => {
    expect(parseChf("250")).toBe(25_000);
    expect(parseChf("250.50")).toBe(25_050);
  });

  it("accepts Swiss thousands apostrophes and stray spaces", () => {
    expect(parseChf("1'250.50")).toBe(125_050);
    expect(parseChf(" 1 250,50 ")).toBe(125_050);
  });

  it("accepts the typographic apostrophe a phone keyboard produces", () => {
    expect(parseChf("1’250.50")).toBe(125_050);
  });

  it("accepts a comma as the decimal separator", () => {
    expect(parseChf("99,90")).toBe(9_990);
  });

  it("pads a single decimal digit rather than truncating it", () => {
    // "10.5" is ten francs fifty, not ten francs five rappen.
    expect(parseChf("10.5")).toBe(1_050);
  });

  it("rejects more than two decimals, which cannot be a rappen amount", () => {
    expect(parseChf("10.505")).toBeNull();
  });

  it("rejects text, negatives and empty input", () => {
    expect(parseChf("")).toBeNull();
    expect(parseChf("abc")).toBeNull();
    expect(parseChf("-5")).toBeNull();
    expect(parseChf(".")).toBeNull();
  });

  it("accepts zero, because a deposit may be waived", () => {
    expect(parseChf("0")).toBe(0);
    expect(parseChf("0.00")).toBe(0);
  });
});

describe("formatChf", () => {
  it("always shows two decimals", () => {
    expect(formatChf(25_000)).toBe("250.00");
    expect(formatChf(9_990)).toBe("99.90");
    expect(formatChf(5)).toBe("0.05");
  });

  it("groups thousands with an apostrophe, as Switzerland writes them", () => {
    expect(formatChf(125_050)).toBe("1'250.50");
    expect(formatChf(100_000_000)).toBe("1'000'000.00");
  });

  it("round-trips through parseChf", () => {
    for (const cents of [0, 5, 999, 125_050, 100_000_000]) {
      expect(parseChf(formatChf(cents))).toBe(cents);
    }
  });
});
