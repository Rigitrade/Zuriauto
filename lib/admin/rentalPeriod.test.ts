import { describe, expect, it } from "vitest";
import {
  IMPORT_AUTHOR,
  mayEditPeriod,
  rentalPeriodSchema,
  toZurichInput,
  zurichInstant,
} from "./rentalPeriod";

describe("zurichInstant", () => {
  it("reads a summer time as CEST, not as UTC", () => {
    // 12:00 in Zurich in August is 10:00Z. Reading it as UTC is the bug this
    // function exists to prevent, and it is invisible until somebody compares
    // a corrected return against the contract.
    expect(zurichInstant("2026-08-17T12:00")?.toISOString()).toBe(
      "2026-08-17T10:00:00.000Z"
    );
  });

  it("reads a winter time as CET", () => {
    expect(zurichInstant("2026-01-17T12:00")?.toISOString()).toBe(
      "2026-01-17T11:00:00.000Z"
    );
  });

  it("refuses a day that does not exist rather than rolling it forward", () => {
    expect(zurichInstant("2026-02-31T09:00")).toBeNull();
  });

  it("refuses anything that is not a wall-clock string", () => {
    expect(zurichInstant("2026-08-17")).toBeNull();
    expect(zurichInstant("2026-08-17T12:00:00.000Z")).toBeNull();
    expect(zurichInstant("")).toBeNull();
  });
});

describe("rentalPeriodSchema", () => {
  it("accepts a period that ends after it starts", () => {
    const parsed = rentalPeriodSchema.safeParse({
      startAt: "2026-08-17T09:13",
      endAt: "2026-08-24T17:00",
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts a period that ends exactly when it starts", () => {
    // What every imported rental currently holds. Refusing it would mean the
    // office could not correct the start without also inventing an end.
    const parsed = rentalPeriodSchema.safeParse({
      startAt: "2026-08-17T09:13",
      endAt: "2026-08-17T09:13",
    });
    expect(parsed.success).toBe(true);
  });

  it("refuses a period that ends before it starts", () => {
    const parsed = rentalPeriodSchema.safeParse({
      startAt: "2026-08-24T17:00",
      endAt: "2026-08-17T09:13",
    });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe("endBeforeStart");
  });

  it("refuses an instant, so the browser's zone cannot leak in", () => {
    const parsed = rentalPeriodSchema.safeParse({
      startAt: "2026-08-17T07:13:00.000Z",
      endAt: "2026-08-24T15:00:00.000Z",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("mayEditPeriod", () => {
  it("allows a rental whose contracts all came from the import", () => {
    expect(
      mayEditPeriod([{ createdBy: IMPORT_AUTHOR }, { createdBy: IMPORT_AUTHOR }])
    ).toBe(true);
  });

  it("refuses one signed at the desk", () => {
    expect(mayEditPeriod([{ createdBy: "office" }])).toBe(false);
  });

  it("refuses a mixed rental, where a real return closed an imported pickup", () => {
    // The signed addendum states its own moment. One document written by a
    // person outvotes any number written by a script.
    expect(
      mayEditPeriod([{ createdBy: IMPORT_AUTHOR }, { createdBy: "office" }])
    ).toBe(false);
  });

  it("refuses a rental with no contracts at all", () => {
    expect(mayEditPeriod([])).toBe(false);
  });
});

describe("toZurichInput", () => {
  it("renders an instant as the wall clock the office reads", () => {
    expect(toZurichInput("2026-08-17T10:00:00.000Z")).toBe("2026-08-17T12:00");
  });

  it("round-trips through zurichInstant", () => {
    const iso = "2026-09-13T15:29:00.000Z";
    expect(zurichInstant(toZurichInput(iso))?.toISOString()).toBe(iso);
  });

  it("is empty for something unparseable, rather than throwing in a form", () => {
    expect(toZurichInput("not a date")).toBe("");
  });
});
