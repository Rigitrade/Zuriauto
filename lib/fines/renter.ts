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
 * it, and a fine waiting for another reason waits for that.
 *
 * Nothing is sent inside the transaction that changes the renter: the ids of
 * the fines that became sendable are handed back, and sendFinesFromReturn
 * sends them once the return is saved — the owner's decision of 13.10.2026,
 * the same automatic send a letter uploaded after the return would get.
 */

import type { Prisma } from "@/generated/prisma/client";
import { isPlaceholderEmail } from "@/lib/rental/placeholder";
import { recordEvent } from "./events";
import { deliverNewFine } from "./nominate";
import type { NotifyDeps } from "./notify";

export async function refreshFineRenters(
  tx: Prisma.TransactionClient,
  rentalId: string,
  now: Date
): Promise<string[]> {
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
  return reviewReason === null ? stale.map((fine) => fine.id) : [];
}

/**
 * Each fine a return made sendable, delivered as an upload delivers it —
 * named to the police, or sent to the renter (deliverNewFine). One that fails is logged and stays in review
 * for the office; it never fails the return, which is already saved.
 */
export async function sendFinesFromReturn(deps: NotifyDeps, fineIds: string[]): Promise<void> {
  for (const fineId of fineIds) {
    try {
      await deliverNewFine(deps, fineId);
    } catch (error) {
      console.error(`[fines] notice after return failed for ${fineId}:`, error);
    }
  }
}
