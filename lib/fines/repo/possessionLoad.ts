/**
 * Possession intervals for one car, from the database.
 *
 * Every rental of the car in every status — `intervalOf` decides what each
 * one means — with the two contract signatures and the close event that mark
 * when the car actually changed hands.
 */

import type { PrismaClient } from "@/generated/prisma/client";
import { RETURN_CLOSE_EVENT } from "@/lib/rental/closeRental";
import { intervalOf, type Interval } from "../possession";

const CLOSE_EVENTS = [RETURN_CLOSE_EVENT, "rental.closed.manual"];

export async function loadIntervals(
  client: PrismaClient,
  carId: string
): Promise<Interval[]> {
  const rentals = await client.rental.findMany({
    where: { carId },
    orderBy: { startAt: "asc" },
    select: {
      id: true,
      customerId: true,
      status: true,
      createdBy: true,
      startAt: true,
      endAt: true,
      contracts: { select: { kind: true, signedAt: true } },
      events: {
        where: { type: { in: CLOSE_EVENTS } },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { createdAt: true },
      },
    },
  });

  return rentals
    .map((rental) =>
      intervalOf({
        rentalId: rental.id,
        customerId: rental.customerId,
        status: rental.status,
        createdBy: rental.createdBy,
        startAt: rental.startAt,
        endAt: rental.endAt,
        pickupSignedAt:
          rental.contracts.find((c) => c.kind === "PICKUP")?.signedAt ?? null,
        returnSignedAt:
          rental.contracts.find((c) => c.kind === "RETURN_ADDENDUM")?.signedAt ?? null,
        closedAt: rental.events[0]?.createdAt ?? null,
      })
    )
    .filter((interval): interval is Interval => interval !== null);
}
