/**
 * How the pickup form is split into steps.
 *
 * Two steps since 06.10.2026, at the lessor's request — five was too many for
 * a handover at the desk. The split follows who holds the phone: the office
 * records the car and the rental, then hands over to the renter, who gives
 * their details and documents, reads the terms and signs.
 *
 * The form is built from sections; a step is a list of them. Moving a section
 * to another step is a change here, and the validation, the error routing and
 * the progress bar follow.
 */

export type PickupSection = "vehicle" | "terms" | "details" | "documents" | "sign";

export const PICKUP_STEPS: readonly (readonly PickupSection[])[] = [
  ["vehicle", "terms"],
  ["details", "documents", "sign"],
];

export const PICKUP_TOTAL_STEPS = PICKUP_STEPS.length;

export function sectionsOf(step: number): readonly PickupSection[] {
  return PICKUP_STEPS[step - 1] ?? [];
}

/**
 * The section that shows each field, by the key its error is filed under —
 * the schema's own field names, plus the form's names for errors it raises
 * itself (`amount`, `gtc`, the document slots).
 */
const SECTION_OF_FIELD: Record<string, PickupSection> = {
  vehicleId: "vehicle",
  mileageKm: "vehicle",
  fuelLevel: "vehicle",
  existingDamage: "vehicle",

  terms: "terms",
  type: "terms",
  amount: "terms",
  deposit: "terms",
  totalWeeks: "terms",
  startAt: "terms",
  endAt: "terms",

  mobile: "details",
  lastName: "details",
  firstName: "details",
  birthDate: "details",
  street: "details",
  postalCode: "details",
  city: "details",
  country: "details",
  email: "details",

  identityChecked: "documents",
  portrait: "documents",
  idFront: "documents",
  idBack: "documents",
  licenceFront: "documents",
  licenceBack: "documents",

  gtc: "sign",
  gtcAccepted: "sign",
  gtcVersion: "sign",
  gtcLanguage: "sign",
  acceptedAt: "sign",
  confirm: "sign",
  truthfulInfoConfirmedAt: "sign",
  deceptionNoticeConfirmedAt: "sign",
  signature: "sign",
  place: "sign",
};

/** The step showing `field`, or undefined for a key no section claims. */
export function stepOfField(field: string): number | undefined {
  const section = SECTION_OF_FIELD[field];
  if (!section) return undefined;
  return PICKUP_STEPS.findIndex((sections) => sections.includes(section)) + 1;
}
