import { describe, expect, it } from "vitest";
import { contractDetailsSchema } from "./schema";

/**
 * The confirmations are a claim about what the renter did before signing, so
 * the server refuses a contract without them — the same rule as the GTC box,
 * and for the same reason: a crafted request must not skip what the form asks.
 */

const valid = {
  vehicleId: "prius-zh513925",
  mileageKm: 120_000,
  fuelLevel: "3/4",
  existingDamage: "",
  terms: {
    type: "WEEKLY",
    startAt: "2026-10-06T08:00:00.000Z",
    totalWeeks: 4,
    weeklyAmountCents: 45_000,
    depositCents: 50_000,
  },
  lastName: "Meier",
  firstName: "Anna",
  birthDate: "1990-04-12",
  street: "Bahnhofstrasse 1",
  postalCode: "8001",
  city: "Zürich",
  country: "Switzerland",
  mobile: "+41791234567",
  email: "anna@example.ch",
  gtcAccepted: true,
  gtcVersion: "06.10.2026",
  gtcLanguage: "de",
  acceptedAt: "2026-10-06T08:00:00.000Z",
  truthfulInfoConfirmedAt: "2026-10-06T08:00:10.000Z",
  deceptionNoticeConfirmedAt: "2026-10-06T08:00:20.000Z",
  place: "Zürich",
};

describe("contractDetailsSchema confirmations", () => {
  it("accepts a contract with both confirmations", () => {
    expect(contractDetailsSchema.safeParse(valid).success).toBe(true);
  });

  it.each(["truthfulInfoConfirmedAt", "deceptionNoticeConfirmedAt"])(
    "refuses a contract without %s",
    (key) => {
      const { [key]: _omitted, ...without } = valid as Record<string, unknown>;
      const result = contractDetailsSchema.safeParse(without);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]).toMatchObject({
        path: [key],
        message: "confirm",
      });
    }
  );

  it("refuses a confirmation that is not a time", () => {
    const result = contractDetailsSchema.safeParse({
      ...valid,
      truthfulInfoConfirmedAt: "yes",
    });
    expect(result.success).toBe(false);
  });
});
