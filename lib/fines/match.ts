/**
 * From what a letter says to a car, a rental and a renter — or the one
 * reason the office has to look.
 *
 * The order of the checks is the order of the questions a person at the desk
 * would ask: is this a fine at all; is it one of our cars; did we read enough
 * of it; who had the car then; can we reach them.
 */

import type { PrismaClient } from "@/generated/prisma/client";
import { isPlaceholderEmail } from "@/lib/rental/placeholder";
import { matchPlate } from "./plates";
import { momentOf, responsibleAt } from "./possession";
import { loadIntervals } from "./repo/possessionLoad";
import type { Extraction, FieldStatus } from "./types";
import { requiredFieldsProblem } from "./validate";

export type ReviewReason =
  | "FIELDS_MISSING"
  | "FIELDS_DOUBTFUL"
  | "QR_DISAGREES"
  | "NOT_A_FINE"
  | "PLATE_NOT_IN_FLEET"
  | "PLATE_AMBIGUOUS"
  | "NO_RENTAL_AT_TIME"
  | "HANDOVER_BOUNDARY"
  | "OVERLAPPING_RENTALS"
  | "NO_CUSTOMER_EMAIL"
  | "PROBABLE_DUPLICATE";

export interface MatchResult {
  carId: string | null;
  rentalId: string | null;
  customerId: string | null;
  plateStatus: FieldStatus;
  violationAt: Date | null;
  violationTimeKnown: boolean;
  /** Rentals a person should choose between, when the rule could not. */
  candidates: string[];
  reviewReason: ReviewReason | null;
}

export async function matchFine(
  client: PrismaClient,
  organisationId: string,
  x: Extraction,
  ocrText: string
): Promise<MatchResult> {
  const moment = x.violationDate.value
    ? momentOf(x.violationDate.value, x.violationTime.value)
    : null;
  const base: MatchResult = {
    carId: null,
    rentalId: null,
    customerId: null,
    plateStatus: "MISSING",
    violationAt: moment ? (moment.kind === "instant" ? moment.at : moment.from) : null,
    violationTimeKnown: moment?.kind === "instant",
    candidates: [],
    reviewReason: null,
  };

  if (x.kind === "NOT_A_FINE") return { ...base, reviewReason: "NOT_A_FINE" };

  // Every car, retired ones included: the fine may predate the retirement.
  const fleet = await client.car.findMany({
    where: { organisationId },
    select: { id: true, plate: true },
  });
  const plate = matchPlate(ocrText, x.plateText.value, fleet);
  const withCar = { ...base, carId: plate.carId, plateStatus: plate.status };
  if (plate.reason) return { ...withCar, candidates: plate.candidates, reviewReason: plate.reason };

  const problem = requiredFieldsProblem(x, plate.status);
  if (problem) return { ...withCar, reviewReason: problem };
  if (!moment || !plate.carId) return { ...withCar, reviewReason: "FIELDS_DOUBTFUL" };

  const responsible = responsibleAt(await loadIntervals(client, plate.carId), moment);
  if (!responsible.ok) {
    return { ...withCar, candidates: responsible.candidates, reviewReason: responsible.reason };
  }

  const customer = await client.customer.findUniqueOrThrow({
    where: { id: responsible.customerId },
    select: { email: true },
  });
  const matched = {
    ...withCar,
    rentalId: responsible.rentalId,
    customerId: responsible.customerId,
    candidates: [responsible.rentalId],
  };
  if (!customer.email || isPlaceholderEmail(customer.email)) {
    return { ...matched, reviewReason: "NO_CUSTOMER_EMAIL" };
  }
  return matched;
}
