/**
 * Rentals for the fines tests, made the way production makes them.
 *
 * Through `persistPickup` and `closeRental` rather than inserted rows, so the
 * possession intervals the matcher reads are built from the same contract
 * signatures and close events a real rental leaves behind.
 */

import { prisma } from "@/lib/db";
import { closeRental } from "@/lib/rental/closeRental";
import { persistPickup, type PickupUpload } from "@/lib/rental/persistPickup";
import type { ContractDetails } from "@/lib/rental/schema";
import { createMemoryStore } from "@/lib/storage";
import { ensureOrganisation, seedFleet } from "@/prisma/seed";

export const UPLOADS: PickupUpload[] = [
  { kind: "PORTRAIT", body: new Uint8Array([1]), contentType: "image/jpeg" },
  { kind: "ID_FRONT", body: new Uint8Array([2]), contentType: "image/jpeg" },
  { kind: "ID_BACK", body: new Uint8Array([3]), contentType: "image/jpeg" },
  { kind: "LICENCE_FRONT", body: new Uint8Array([4]), contentType: "image/jpeg" },
  { kind: "LICENCE_BACK", body: new Uint8Array([5]), contentType: "image/jpeg" },
  { kind: "SIGNATURE", body: new Uint8Array([6]), contentType: "image/png" },
];

export function pickupDetails(overrides: Partial<ContractDetails> = {}): ContractDetails {
  return {
    vehicleId: "prius-zh513925",
    mileageKm: 120_000,
    fuelLevel: "3/4",
    existingDamage: "",
    terms: {
      type: "WEEKLY",
      startAt: "2026-06-01T08:00:00.000Z",
      totalWeeks: 8,
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
    mobile: "079 123 45 67",
    email: "anna@example.ch",
    gtcAccepted: true,
    gtcVersion: "2026-07-31",
    gtcLanguage: "de",
    acceptedAt: "2026-06-01T08:00:00.000Z",
    place: "Zurich",
    ...overrides,
  };
}

export async function seedOrganisation() {
  const org = await ensureOrganisation(prisma);
  await seedFleet(prisma, org.id);
  return org;
}

/** A pickup signed at `signedAt`; returns the rental and its car. */
export async function seedRental(
  organisationId: string,
  options: { signedAt: Date; details?: Partial<ContractDetails> }
) {
  const details = pickupDetails({
    terms: {
      type: "WEEKLY",
      startAt: options.signedAt.toISOString(),
      totalWeeks: 8,
      weeklyAmountCents: 45_000,
      depositCents: 50_000,
    },
    ...options.details,
  });
  await persistPickup({
    organisationId,
    details,
    vehicleSlug: details.vehicleId,
    uploads: UPLOADS,
    pdf: { body: new Uint8Array([7]) },
    store: createMemoryStore(),
    now: options.signedAt,
  });
  const rental = await prisma.rental.findFirstOrThrow({
    where: { car: { slug: details.vehicleId }, status: "ACTIVE" },
    orderBy: { startAt: "desc" },
    select: { id: true, carId: true, customerId: true },
  });
  return rental;
}

/** Closes a rental by the office's button at `closedAt`. */
export async function closeAt(
  organisationId: string,
  rental: { id: string; carId: string },
  closedAt: Date
) {
  await prisma.$transaction((tx) =>
    closeRental(tx, {
      organisationId,
      rentalId: rental.id,
      carId: rental.carId,
      fromStatuses: ["ACTIVE", "EXTENSION_REQUESTED", "RETURN_SUBMITTED"],
      settlement: null,
      event: { type: "rental.closed.manual", payload: {} },
      now: closedAt,
    })
  );
}
