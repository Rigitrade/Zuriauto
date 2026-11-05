/**
 * A handover's odometer reading, written onto the car (owner, 05.11.2026).
 *
 * The pickup and return forms both record the kilometres, and the oil-service
 * reminder needs the car's current reading. Without this the office would
 * have to copy every handover's figure into the service dialog by hand.
 *
 * Only ever forward: a conditional update whose WHERE says the stored reading
 * is lower (or missing). A return form typed with a digit short, or a late
 * submission of an older handover, cannot wind the odometer back. A figure
 * that went the other way, too high, is corrected in the service dialog.
 */

import type { Prisma } from "@/generated/prisma/client";

export async function recordOdometer(
  tx: Prisma.TransactionClient,
  car: Prisma.CarWhereInput,
  km: number,
  at: Date
): Promise<void> {
  if (!Number.isInteger(km) || km < 0) return;
  await tx.car.updateMany({
    where: {
      AND: [
        car,
        { OR: [{ currentMileageKm: null }, { currentMileageKm: { lte: km } }] },
      ],
    },
    data: { currentMileageKm: km, mileageReadAt: at },
  });
}
