/**
 * Whether the return form asks if the car was taken off the renter's Bolt app.
 *
 * The owner's rule of 18.10.2026: every car out when the question arrived is
 * asked, whatever its rental; from then on only a weekly rental, which is the
 * business rental (`RentalType.WEEKLY`) — a daily one is for tourism, and a
 * tourist has no Bolt account to take the car off.
 *
 * Read by the return lookup, which tells the form whether to show the
 * question, from the same two facts persistReturn finds on the rental. The
 * server does not refuse a return without the answer: the return is emailed
 * before it is written, and refusing then would leave a signed protocol with
 * nothing recorded behind it.
 *
 * Pure and client-safe.
 */

import type { RentalType } from "@/generated/prisma/enums";

/**
 * Rentals recorded before this moment are asked whatever their type: the cars
 * out on 18.10.2026. 06:00 in Zurich, before that morning's first handover.
 */
export const BOLT_ASKED_OF_ALL_BEFORE = new Date("2026-10-18T04:00:00.000Z");

export function asksBolt(rental: { type: RentalType; createdAt: Date }): boolean {
  return (
    rental.type === "WEEKLY" ||
    rental.createdAt.getTime() < BOLT_ASKED_OF_ALL_BEFORE.getTime()
  );
}
