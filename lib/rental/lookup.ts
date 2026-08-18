/**
 * Who was driving this car at this moment.
 *
 * The office's most frequent question, and until now unanswerable without
 * reading a mailbox: a radar ticket arrives naming a plate and a timestamp,
 * and the fine has to be attributed within a deadline. Served by the
 * `[carId, startAt, endAt]` index, so it stays one query however many rentals
 * accumulate.
 */

import type { PrismaClient } from "@/generated/prisma/client";

export interface DriverRecord {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  contractNumber: string | null;
  rentalId: string;
}

export async function driverAt(
  client: PrismaClient,
  organisationId: string,
  plate: string,
  at: Date
): Promise<DriverRecord | null> {
  const rental = await client.rental.findFirst({
    where: {
      organisationId,
      car: { plate },
      // Half-open interval: the moment a rental ends belongs to the next one.
      // Two consecutive rentals of the same car share a boundary instant, and
      // attributing a fine to the wrong driver on a handover day is exactly
      // the mistake this query exists to prevent.
      startAt: { lte: at },
      endAt: { gt: at },
      status: { not: "CANCELLED" },
    },
    orderBy: { startAt: "desc" },
    select: {
      id: true,
      customer: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          street: true,
          postalCode: true,
          city: true,
          country: true,
        },
      },
      contracts: {
        where: { kind: "PICKUP" },
        select: { contractNumber: true },
        take: 1,
      },
    },
  });

  if (!rental) return null;

  return {
    ...rental.customer,
    contractNumber: rental.contracts[0]?.contractNumber ?? null,
    rentalId: rental.id,
  };
}
