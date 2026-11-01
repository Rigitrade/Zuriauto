/**
 * How the return form is split into steps.
 *
 * Two steps since 01.11.2026, at the lessor's request — the same cut the
 * pickup form got on 06.10.2026, so the two flows still feel like one
 * product. The split is the car, then the money: what was handed back and in
 * what state, then how the rental was settled, who is returning it and their
 * signature. The payment answers sit on the page that is signed.
 *
 * The form is built from sections; a step is a list of them. Moving a section
 * to another step is a change here, and the validation, the error routing and
 * the progress bar follow.
 */

export type ReturnSection = "vehicle" | "condition" | "payment" | "renter";

export const RETURN_STEPS: readonly (readonly ReturnSection[])[] = [
  ["vehicle", "condition"],
  ["payment", "renter"],
];

export const RETURN_TOTAL_STEPS = RETURN_STEPS.length;

export function returnSectionsOf(step: number): readonly ReturnSection[] {
  return RETURN_STEPS[step - 1] ?? [];
}

/**
 * The section that shows each field, by the key its error is filed under —
 * the schema's own field names, plus `signature`, which the form checks
 * itself.
 */
const SECTION_OF_FIELD: Record<string, ReturnSection> = {
  vehicleId: "vehicle",
  mileageKm: "vehicle",
  mileagePickupKm: "vehicle",
  fuelLevel: "vehicle",

  papersInside: "condition",
  keyReturned: "condition",
  boltRemoved: "condition",
  cleanliness: "condition",
  damages: "condition",

  tickets: "payment",
  ticketsNote: "payment",
  fullyPaid: "payment",
  paymentMethods: "payment",
  paidAmountChf: "payment",
  paidOn: "payment",
  hasDuePayment: "payment",
  dueAmountChf: "payment",
  dueDate: "payment",
  dueMethod: "payment",
  depositBack: "payment",

  lastName: "renter",
  firstName: "renter",
  email: "renter",
  place: "renter",
  signature: "renter",
};

/** The step showing `field`, or undefined for a key no section claims. */
export function returnStepOfField(field: string): number | undefined {
  const section = SECTION_OF_FIELD[field];
  if (!section) return undefined;
  return RETURN_STEPS.findIndex((sections) => sections.includes(section)) + 1;
}
