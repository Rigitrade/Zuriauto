/**
 * Odometer readings, as typed into the pickup and return forms.
 *
 * One limit for the forms and the schemas. They used to disagree — the forms
 * took any seven digits, the schemas stopped at two million — so a reading in
 * between passed the form's step and was refused only at submit.
 */

/** A car reading over two million km is a typo, not a vehicle. */
export const MILEAGE_MAX_KM = 2_000_000;

/**
 * Reads what someone typed into a mileage field.
 *
 * Tolerant about thousands separators, like `parseChf`: spaces, dots and both
 * the straight and the typographic apostrophe iOS substitutes. Returns null
 * for anything that is not a whole number of kilometres up to the limit.
 */
export function parseMileageKm(input: string): number | null {
  const cleaned = input.replace(/[\s'’.]/g, "");
  if (!/^\d+$/.test(cleaned)) return null;

  const km = Number(cleaned);
  return km <= MILEAGE_MAX_KM ? km : null;
}

/**
 * Kilometres driven during a rental: the reading at return minus the reading
 * at handover (owner, 01.11.2026 — shown on the return form and its report).
 *
 * Null when either reading is missing, or when the return reading is the
 * lower one. That is a typo in one of the two, and the form says so on the
 * return field; showing a negative distance as well would only repeat it less
 * clearly.
 */
export function drivenKm(
  returnKm: number | null | undefined,
  pickupKm: number | null | undefined
): number | null {
  if (returnKm == null || pickupKm == null) return null;
  return returnKm >= pickupKm ? returnKm - pickupKm : null;
}
