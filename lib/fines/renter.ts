/**
 * A fine follows its rental's renter while nobody has been told yet.
 *
 * A fine copies its renter from the rental when it is matched, so a rental
 * whose renter becomes known later — a car the office marked as out, returned
 * by somebody who then fills in the return form — left its fines on the old
 * placeholder, saying "no email for the renter" about a renter who had one.
 *
 * Only fines in NEEDS_REVIEW, and only while their one problem is the
 * missing address (or none): a fine already sent belongs to whoever received
 * it, and a fine waiting for another reason waits for that. Nothing is sent
 * from here — sending stays the office's act.
 */

import type { Prisma } from "@/generated/prisma/client";
import { isPlaceholderEmail } from "@/lib/rental/placeholder";
import { recordEvent } from "./events";

export async function refreshFineRenters(
  tx: Prisma.TransactionClient,
  rentalId: string,
  now: Date
): Promise<number> {
  const rental = await tx.rental.findUniqueOrThrow({
    where: { id: rentalId },
    select: { customerId: true, customer: { select: { email: true } } },
  });
  const fines = await tx.fine.findMany({
    where: {
      rentalId,
      status: "NEEDS_REVIEW",
      OR: [{ reviewReason: "NO_CUSTOMER_EMAIL" }, { reviewReason: null }],
    },
    select: { id: true, customerId: true, reviewReason: true },
  });
  // Stale in either way: pointing at another customer, or at the right row
  // whose placeholder address was just replaced by a real one. Filtered
  // here rather than in SQL, where NOT (customerId = x) drops a null.
  const reviewReason = isPlaceholderEmail(rental.customer.email) ? "NO_CUSTOMER_EMAIL" : null;
  const stale = fines.filter(
    (fine) => fine.customerId !== rental.customerId || fine.reviewReason !== reviewReason
  );
  for (const fine of stale) {
    await tx.fine.update({
      where: { id: fine.id },
      data: { customerId: rental.customerId, reviewReason },
    });
    await recordEvent(tx, fine.id, "system.renter-from-rental", {
      from: fine.customerId,
      to: rental.customerId,
    }, null, now);
  }
  return stale.length;
}
