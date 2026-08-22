import { describe, expect, it } from "vitest";
import { normalisePhone } from "./phone";

describe("normalisePhone", () => {
  it("reads the four ways an office types one Swiss mobile", () => {
    // The point of the function: these are one customer, not four.
    for (const written of [
      "079 123 45 67",
      "+41 79 123 45 67",
      "0041791234567",
      "+41791234567",
    ]) {
      expect(normalisePhone(written)).toBe("+41791234567");
    }
  });

  it("strips the punctuation people write numbers with", () => {
    expect(normalisePhone("079/123.45.67")).toBe("+41791234567");
    expect(normalisePhone(" (079) 123-45-67 ")).toBe("+41791234567");
  });

  it("keeps a foreign number on its own country code", () => {
    expect(normalisePhone("+49 151 23456789")).toBe("+4915123456789");
    expect(normalisePhone("0049 151 23456789")).toBe("+4915123456789");
  });

  it("refuses a bare number rather than guessing a country", () => {
    // 791234567 is probably Swiss without the trunk zero, and 41791234567 is
    // probably +41 without the plus — but guessing wrong builds a key that
    // matches the wrong person, and the cost of refusing is that the staff
    // member types the details.
    expect(normalisePhone("791234567")).toBeNull();
    expect(normalisePhone("41791234567")).toBeNull();
  });

  it("returns null for anything that cannot be a number", () => {
    expect(normalisePhone("")).toBeNull();
    expect(normalisePhone("   ")).toBeNull();
    expect(normalisePhone("ask at the desk")).toBeNull();
    expect(normalisePhone("+")).toBeNull();
  });

  it("rejects lengths outside E.164 rather than storing a typo as a key", () => {
    expect(normalisePhone("+41 79")).toBeNull();
    expect(normalisePhone("+4179123456789012")).toBeNull();
  });
});
