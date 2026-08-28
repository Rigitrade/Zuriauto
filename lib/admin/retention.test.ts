import { describe, expect, it } from "vitest";
import {
  PERSON_RETENTION_YEARS,
  RECORD_RETENTION_YEARS,
  retentionCutoff,
  isDueForDeletion,
} from "./retention";

/**
 * The clock, tested without a database.
 *
 * `docs/DATA-RETENTION.md` is the authority and its periods were agreed by the
 * owner on 2026-08-22: five years for everything about the person, ten for the
 * contract PDF and the records, the ten-year floor overriding where they meet.
 *
 * These tests exist mostly to pin the boundary. A sweep that deletes a day
 * early destroys evidence the office is obliged to hold; a sweep that deletes
 * a day late is a smaller problem but still a promise broken in a privacy
 * notice. Both are one comparison operator away from each other.
 */

const NOW = new Date("2026-08-29T10:00:00.000Z");

describe("retentionCutoff", () => {
  it("puts the person cutoff five years back", () => {
    expect(retentionCutoff(NOW, PERSON_RETENTION_YEARS).toISOString()).toBe(
      "2021-08-29T10:00:00.000Z"
    );
  });

  it("puts the record cutoff ten years back", () => {
    expect(retentionCutoff(NOW, RECORD_RETENTION_YEARS).toISOString()).toBe(
      "2016-08-29T10:00:00.000Z"
    );
  });

  it("handles a leap day without inventing the 29th of February", () => {
    // 2024-02-29 minus five years is 2019-02-29, which does not exist.
    // JavaScript rolls it to 1 March; what matters is that it does not throw
    // and does not land in January.
    const cutoff = retentionCutoff(new Date("2024-02-29T00:00:00.000Z"), 5);
    expect(cutoff.getUTCFullYear()).toBe(2019);
    expect(cutoff.getUTCMonth()).toBe(2); // March
  });
});

describe("isDueForDeletion", () => {
  const cutoff = retentionCutoff(NOW, PERSON_RETENTION_YEARS);

  it("keeps an asset whose rental ended inside the window", () => {
    expect(
      isDueForDeletion({ rentalEndAt: new Date("2023-01-01"), deletedAt: null }, cutoff)
    ).toBe(false);
  });

  it("deletes an asset whose rental ended before the cutoff", () => {
    expect(
      isDueForDeletion({ rentalEndAt: new Date("2019-01-01"), deletedAt: null }, cutoff)
    ).toBe(true);
  });

  it("keeps an asset on the cutoff itself", () => {
    // Five years to the day is still inside five years. Deleting here would
    // be a day early, which is the direction that destroys evidence.
    expect(isDueForDeletion({ rentalEndAt: cutoff, deletedAt: null }, cutoff)).toBe(
      false
    );
  });

  it("never re-deletes something already deleted", () => {
    expect(
      isDueForDeletion(
        { rentalEndAt: new Date("2019-01-01"), deletedAt: new Date("2024-01-01") },
        cutoff
      )
    ).toBe(false);
  });

  it("keeps an asset whose rental has no end date", () => {
    // A rental still running has no clock to be past. Treating null as "long
    // ago" would delete the documents of a car that is out right now.
    expect(isDueForDeletion({ rentalEndAt: null, deletedAt: null }, cutoff)).toBe(
      false
    );
  });
});
