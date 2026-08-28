import { describe, expect, it } from "vitest";
import { attentionItems, type AttentionSource } from "./attention";

/**
 * The promise this function makes is negative: when it returns nothing, there
 * is nothing to do. A console that says "nothing waiting" while a car sits
 * blocked is worse than the screen it replaces, because that one never claimed
 * to be complete. So the empty cases are tested as hard as the full ones.
 */

const NOW = new Date("2026-08-28T09:00:00.000Z");

function rental(over: Partial<AttentionSource["rentals"][number]> = {}) {
  return {
    id: "r1",
    carPlate: "ZH 401 859",
    carModel: "Toyota Prius Hybrid",
    customerName: "M. Keller",
    startAt: "2026-08-21T08:00:00.000Z",
    endAt: "2026-09-10T08:00:00.000Z",
    contractNumber: "ZA-20260821-0001",
    returnSubmittedAt: null,
    returnContractNumber: null,
    ...over,
  };
}

function source(over: Partial<AttentionSource> = {}): AttentionSource {
  return { rentals: [], unsentContracts: [], ...over };
}

describe("attentionItems", () => {
  it("is empty when nothing needs anybody", () => {
    expect(attentionItems(source({ rentals: [rental()] }), NOW)).toEqual([]);
  });

  it("reports a submitted return, because its car is blocked", () => {
    const items = attentionItems(
      source({ rentals: [rental({ returnSubmittedAt: "2026-08-27T17:40:00.000Z" })] }),
      NOW
    );
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("return");
    expect(items[0].rentalId).toBe("r1");
  });

  it("reports a rental ending inside 24 hours", () => {
    const items = attentionItems(
      source({ rentals: [rental({ endAt: "2026-08-28T18:00:00.000Z" })] }),
      NOW
    );
    expect(items.map((i) => i.kind)).toEqual(["ending"]);
  });

  it("leaves a rental ending in three days alone", () => {
    const items = attentionItems(
      source({ rentals: [rental({ endAt: "2026-08-31T18:00:00.000Z" })] }),
      NOW
    );
    expect(items).toEqual([]);
  });

  it("counts a rental that has already run over as ending", () => {
    // Overdue is more urgent than due, never less. Reporting only the future
    // would drop a car that should already be back.
    const items = attentionItems(
      source({ rentals: [rental({ endAt: "2026-08-26T18:00:00.000Z" })] }),
      NOW
    );
    expect(items.map((i) => i.kind)).toEqual(["ending"]);
  });

  it("does not chase the end date of a rental already returned", () => {
    // Both conditions are true of this rental. Reporting it twice would make
    // one job look like two, and the return is the one with an action.
    const items = attentionItems(
      source({
        rentals: [
          rental({
            endAt: "2026-08-28T18:00:00.000Z",
            returnSubmittedAt: "2026-08-27T17:40:00.000Z",
          }),
        ],
      }),
      NOW
    );
    expect(items.map((i) => i.kind)).toEqual(["return"]);
  });

  it("reports a contract whose mail never left", () => {
    const items = attentionItems(
      source({
        unsentContracts: [
          {
            id: "c1",
            contractNumber: "ZA-20260828-0004",
            customerName: "R. Fischer",
            signedAt: "2026-08-28T07:10:00.000Z",
          },
        ],
      }),
      NOW
    );
    expect(items.map((i) => i.kind)).toEqual(["mail"]);
    expect(items[0].contractNumber).toBe("ZA-20260828-0004");
  });

  it("puts blocked cars first, then endings, then mail", () => {
    const items = attentionItems(
      source({
        rentals: [
          rental({ id: "ending", endAt: "2026-08-28T18:00:00.000Z" }),
          rental({ id: "returned", returnSubmittedAt: "2026-08-27T17:40:00.000Z" }),
        ],
        unsentContracts: [
          {
            id: "c1",
            contractNumber: "ZA-20260828-0004",
            customerName: "R. Fischer",
            signedAt: "2026-08-28T07:10:00.000Z",
          },
        ],
      }),
      NOW
    );
    expect(items.map((i) => i.kind)).toEqual(["return", "ending", "mail"]);
  });

  it("survives an overview that predates unsentContracts", () => {
    // An older deployment answers without the field. The band should lose one
    // row, not throw and take the whole Overview with it.
    const items = attentionItems(
      { rentals: [rental({ returnSubmittedAt: "2026-08-27T17:40:00.000Z" })] },
      NOW
    );
    expect(items.map((i) => i.kind)).toEqual(["return"]);
  });
});
