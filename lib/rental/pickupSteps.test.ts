import { describe, expect, it } from "vitest";
import { contractDetailsSchema } from "./schema";
import {
  PICKUP_STEPS,
  PICKUP_TOTAL_STEPS,
  sectionsOf,
  stepOfField,
} from "./pickupSteps";

/**
 * Two steps: the office's part (car and rental) and the renter's part (who
 * they are, their documents, the terms and the signature). A field the server
 * rejects must send the form back to the step that shows it — otherwise the
 * error is raised on a page where it cannot be seen or fixed.
 */
describe("pickup steps", () => {
  it("has two steps: car and rental, then renter and signature", () => {
    expect(PICKUP_TOTAL_STEPS).toBe(2);
    expect(sectionsOf(1)).toEqual(["vehicle", "terms"]);
    expect(sectionsOf(2)).toEqual(["details", "documents", "sign"]);
  });

  it("places every section on exactly one step", () => {
    const all = PICKUP_STEPS.flat();
    expect(new Set(all).size).toBe(all.length);
  });

  it.each([
    "vehicleId",
    "mileageKm",
    "fuelLevel",
    "existingDamage",
    "terms",
    "amount",
    "deposit",
    "totalWeeks",
    "startAt",
    "endAt",
  ])("sends %s back to step 1", (field) => {
    expect(stepOfField(field)).toBe(1);
  });

  it.each([
    "lastName",
    "birthDate",
    "country",
    "email",
    "mobile",
    "identityChecked",
    "portrait",
    "licenceBack",
    "gtc",
    "confirm",
    "truthfulInfoConfirmedAt",
    "deceptionNoticeConfirmedAt",
    "signature",
    "place",
  ])("sends %s back to step 2", (field) => {
    expect(stepOfField(field)).toBe(2);
  });

  it("knows the step of every field the contract schema can reject", () => {
    for (const field of Object.keys(contractDetailsSchema.shape)) {
      expect(stepOfField(field), field).not.toBeUndefined();
    }
  });
});
