/**
 * The office's fines list from before the system (paper rentals), taken over
 * by the migration 20261113210000_legacy_fines_list_history: a renter per
 * driver, a rental per driver and car (first to last fine day), and each fine
 * closed on it with `legacySource` and the driver as the list named them.
 */

import type { PrismaClient } from "@/generated/prisma/client";

/** Legacy fines of a car near a moment: who the old list says was driving. */
export async function legacyDriversNear(
  client: PrismaClient,
  carId: string,
  at: Date,
  windowMs: number
) {
  const rows = await client.fine.findMany({
    where: {
      carId,
      legacySource: { not: null },
      violationAt: { gte: new Date(at.getTime() - windowMs), lte: new Date(at.getTime() + windowMs) },
    },
    select: { id: true, violationAt: true, violationTimeKnown: true, legacyDriverName: true, offenceTextDe: true, location: true },
  });
  const distance = (row: (typeof rows)[number]) => Math.abs(row.violationAt!.getTime() - at.getTime());
  return rows.sort((a, b) => distance(a) - distance(b));
}
