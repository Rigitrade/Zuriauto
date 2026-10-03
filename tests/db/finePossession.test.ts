import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { loadIntervals } from "@/lib/fines/repo/possessionLoad";
import { closeAt, seedOrganisation, seedRental } from "./fineHelpers";

/**
 * Possession intervals from what a rental actually left behind: the pickup
 * contract's signature and the close event — not the booked dates.
 */
describe("loadIntervals", () => {
  it("runs from the pickup signature to the close, ignoring the booked end", async () => {
    const org = await seedOrganisation();
    const signedAt = new Date("2026-06-01T08:10:00Z");
    const rental = await seedRental(org.id, { signedAt });
    // Eight weeks booked; back after six.
    const closedAt = new Date("2026-07-10T16:00:00Z");
    await closeAt(org.id, rental, closedAt);

    expect(await loadIntervals(prisma, rental.carId)).toEqual([
      { rentalId: rental.id, customerId: rental.customerId, from: signedAt, to: closedAt },
    ]);
  });

  it("leaves a rental that is still out open-ended", async () => {
    const org = await seedOrganisation();
    const rental = await seedRental(org.id, { signedAt: new Date("2026-09-01T09:00:00Z") });

    const [interval] = await loadIntervals(prisma, rental.carId);
    expect(interval.to).toBeNull();
  });

  it("returns every rental of the car, oldest first, and none of another car", async () => {
    const org = await seedOrganisation();
    const first = await seedRental(org.id, { signedAt: new Date("2026-05-01T08:00:00Z") });
    await closeAt(org.id, first, new Date("2026-05-20T08:00:00Z"));
    const second = await seedRental(org.id, {
      signedAt: new Date("2026-06-01T08:00:00Z"),
      details: { email: "luca@example.ch", firstName: "Luca", lastName: "Brunner" },
    });
    await seedRental(org.id, {
      signedAt: new Date("2026-06-02T08:00:00Z"),
      details: { vehicleId: "octavia-zh886530", email: "other@example.ch" },
    });

    const intervals = await loadIntervals(prisma, first.carId);
    expect(intervals.map((i) => i.rentalId)).toEqual([first.id, second.id]);
  });
});
