import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyKeyValid } from "./applyKey";

const original = process.env.APPLY_SECRET;

beforeEach(() => {
  process.env.APPLY_SECRET = "correct-horse-battery-staple";
});

afterEach(() => {
  if (original === undefined) delete process.env.APPLY_SECRET;
  else process.env.APPLY_SECRET = original;
});

describe("applyKeyValid", () => {
  it("accepts the configured secret", () => {
    expect(applyKeyValid("correct-horse-battery-staple")).toBe(true);
  });

  it("rejects a wrong secret of the same length", () => {
    expect(applyKeyValid("correct-horse-battery-staplX")).toBe(false);
  });

  it("rejects a missing secret", () => {
    expect(applyKeyValid(null)).toBe(false);
    expect(applyKeyValid("")).toBe(false);
  });

  it("rejects a prefix of the secret", () => {
    expect(applyKeyValid("correct-horse")).toBe(false);
  });

  it("refuses everything when the server has no secret configured", () => {
    // Fail closed. An unset secret must not mean an open write endpoint.
    delete process.env.APPLY_SECRET;
    expect(applyKeyValid("anything")).toBe(false);
    expect(applyKeyValid("")).toBe(false);
  });
});
