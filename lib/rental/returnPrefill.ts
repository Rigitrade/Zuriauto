/**
 * What the return form can fill in once a car is chosen.
 *
 * The owner's decision of 2026-10-02: the renter should not have to type what
 * the office already holds. Until then the form deliberately knew nothing —
 * decision 6 of docs/superpowers/specs/2026-08-28-return-persistence-design.md
 * — because the form is public and the car list it offers is too.
 *
 * The cost is accepted, not overlooked: anyone who opens /return can read the
 * name and email of whoever is driving each rented car. The route that serves
 * this is rate-limited, which slows a script down and does not stop one person
 * clicking through the list. Encrypting the response would not change that —
 * the browser has to read it to fill the form.
 *
 * So the answer is as narrow as the form allows: the three fields the renter
 * step asks for and the pickup mileage. No phone, no address, no birth date,
 * no ids.
 */

import type { PrismaClient } from "@/generated/prisma/client";
import { OPEN_STATUSES } from "./persistReturn";

export interface ReturnPrefill {
  firstName: string;
  lastName: string;
  email: string;
  /** From the pickup contract. Null when the rental has none on file. */
  pickupMileageKm: number | null;
}

/**
 * The renter of the car's open rental, or null when nothing is out on it.
 *
 * Open means a return could still be recorded: the same statuses
 * `persistReturn` writes from, and no return addendum yet. A rental already
 * returned answers null rather than its renter, so the form never fills in a
 * name only for the submit to refuse it.
 */
export async function findReturnPrefill(
  client: PrismaClient,
  organisationId: string,
  vehicleSlug: string
): Promise<ReturnPrefill | null> {
  const rental = await client.rental.findFirst({
    where: {
      car: { organisationId, slug: vehicleSlug },
      status: { in: [...OPEN_STATUSES] },
      contracts: { none: { kind: "RETURN_ADDENDUM" } },
    },
    // Newest first, as persistReturn chooses.
    orderBy: { startAt: "desc" },
    select: {
      customer: { select: { firstName: true, lastName: true, email: true } },
      contracts: {
        where: { kind: "PICKUP" },
        orderBy: { signedAt: "asc" },
        take: 1,
        select: { mileageKm: true },
      },
    },
  });
  if (!rental) return null;

  return {
    firstName: rental.customer.firstName,
    lastName: rental.customer.lastName,
    email: rental.customer.email,
    pickupMileageKm: rental.contracts[0]?.mileageKm ?? null,
  };
}
