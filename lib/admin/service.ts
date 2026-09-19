/**
 * How close a car's next service is, for the fleet screen.
 *
 * The twin of mfk.ts, and deliberately shaped the same way — a `*Standing`
 * function returning one of four words — because the two sit in adjacent
 * columns of the same table and an office reading them should not have to
 * learn two vocabularies.
 *
 * Where they differ is what they measure. An inspection falls due on a day;
 * a service falls due at a distance. Deriving a date from an assumed monthly
 * mileage would be wrong in both directions at once: a car that spent a month
 * on the forecourt would be called in early, and a taxi doing 4'000 km a month
 * would sail past its interval. So this counts kilometres, and the office
 * enters the figure off the garage's sticker rather than the system inventing
 * an interval that would quietly disagree with the windscreen.
 *
 * Pure, and client-side: the overview endpoint sends plain integers and this
 * runs in the browser, so the table can re-render on an edit without a round
 * trip.
 */

/**
 * How far ahead of the due reading the screen starts warning.
 *
 * A thousand kilometres is roughly a fortnight for a car in daily service —
 * long enough to get a garage slot, short enough that the warning still means
 * something when it appears. Exported so a test states the boundary rather
 * than restating the number.
 */
export const SERVICE_NOTICE_KM = 1_000;

export type ServiceStanding =
  /** Not enough recorded to say anything — so nothing is said. */
  | "none"
  /** Comfortably ahead. */
  | "ok"
  /** Inside the notice window. Time to book the garage. */
  | "due"
  /** The due reading has been passed. */
  | "overdue";

export interface ServiceFigures {
  currentMileageKm?: number | null;
  serviceDueKm?: number | null;
}

/**
 * Whole kilometres only, and finite.
 *
 * A guard rather than a trust: these arrive as JSON from an endpoint, and a
 * `null` that has become the string `"null"` somewhere along the way must read
 * as "nothing recorded" rather than sorting as a number.
 */
function reading(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Kilometres left before the service is due, or null when it cannot be said.
 *
 * Negative once the reading has been passed — the caller decides whether to
 * print "in 800 km" or "800 km overdue", and neither should have to know which
 * subtraction produced the number.
 */
export function kmUntilService(car: ServiceFigures): number | null {
  const current = reading(car.currentMileageKm);
  const due = reading(car.serviceDueKm);
  if (current === null || due === null) return null;
  return due - current;
}

export function serviceStanding(car: ServiceFigures): ServiceStanding {
  const remaining = kmUntilService(car);
  // One missing figure is not half an answer. A due reading with no current
  // one says nothing about whether the car needs a service today, and a
  // screen that guessed would be trusted exactly once.
  if (remaining === null) return "none";

  if (remaining <= 0) return "overdue";
  if (remaining <= SERVICE_NOTICE_KM) return "due";
  return "ok";
}

/**
 * `100'000` — how Switzerland groups a number.
 *
 * The apostrophe is replaced explicitly for the reason contractPdf.ts gives:
 * `de-CH` produces U+2019 RIGHT SINGLE QUOTATION MARK, which is correct
 * typography and wrong for a figure the office copies into a garage's form.
 */
export function formatKm(km: number): string {
  return km.toLocaleString("de-CH").replace(/’/g, "'");
}
