import { describe, expect, it } from "vitest";
import { returnDetailsSchema } from "./returnSchema";
import {
  RETURN_STEPS,
  RETURN_TOTAL_STEPS,
  returnSectionsOf,
  returnStepOfField,
} from "./returnSteps";

/**
 * Two steps: the car (what was handed back and in what state), then the money
 * and the signature. A field the server rejects must send the form back to the
 * step that shows it — otherwise the error is raised on a page where it cannot
 * be seen or fixed.
 */
describe("return steps", () => {
  it("has two steps: car and condition, then payment and signature", () => {
    expect(RETURN_TOTAL_STEPS).toBe(2);
    expect(returnSectionsOf(1)).toEqual(["vehicle", "condition"]);
    expect(returnSectionsOf(2)).toEqual(["payment", "renter"]);
  });

  it("places every section on exactly one step", () => {
    const all = RETURN_STEPS.flat();
    expect(new Set(all).size).toBe(all.length);
  });

  it.each([
    "vehicleId",
    "mileageKm",
    "mileagePickupKm",
    "fuelLevel",
    "papersInside",
    "keyReturned",
    "boltRemoved",
    "cleanliness",
    "damages",
  ])("sends %s back to step 1", (field) => {
    expect(returnStepOfField(field)).toBe(1);
  });

  it.each([
    "tickets",
    "fullyPaid",
    "paymentMethods",
    "paidOn",
    "hasDuePayment",
    "dueDate",
    "dueMethod",
    "depositBack",
    "lastName",
    "email",
    "place",
    "signature",
  ])("sends %s back to step 2", (field) => {
    expect(returnStepOfField(field)).toBe(2);
  });

  it("knows the step of every field the return schema can reject", () => {
    for (const field of Object.keys(returnDetailsSchema.shape)) {
      expect(returnStepOfField(field), field).not.toBeUndefined();
    }
  });
});
