import { describe, expect, it } from "vitest";
import { asksBolt, BOLT_ASKED_OF_ALL_BEFORE } from "./bolt";

/**
 * The owner's rule of 18.10.2026: every car out that day is asked about the
 * Bolt app at its return; after that, only weekly (business) rentals.
 */
describe("asksBolt", () => {
  const before = new Date(BOLT_ASKED_OF_ALL_BEFORE.getTime() - 60_000);
  const after = new Date(BOLT_ASKED_OF_ALL_BEFORE.getTime() + 60_000);

  it("asks a weekly rental, whenever it was recorded", () => {
    expect(asksBolt({ type: "WEEKLY", createdAt: before })).toBe(true);
    expect(asksBolt({ type: "WEEKLY", createdAt: after })).toBe(true);
  });

  it("asks a daily rental that was out when the question arrived", () => {
    expect(asksBolt({ type: "FIXED_TERM", createdAt: before })).toBe(true);
  });

  it("does not ask a daily rental recorded after", () => {
    expect(asksBolt({ type: "FIXED_TERM", createdAt: after })).toBe(false);
  });
});
