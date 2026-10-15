/**
 * The one place a payment makes a charge PAID.
 *
 * Conditional on the status it read, so two runs — or the office and a run —
 * cannot both pay the same week: the second update finds nothing to change
 * and reports false. The previous status goes into the event, which is what
 * lets "undo" put the charge back exactly as it was.
 */

import type { Prisma } from "@/generated/prisma/client";
import type { Actor } from "@/lib/fines/events";
import { recordPaymentEvent } from "./events";
import { OPEN_CHARGE } from "./twint/decide";

/**
 * The payment was no longer waiting when this transaction reached it —
 * another booking, an ignore or an undo got there first. Thrown so the
 * transaction rolls back whatever it already did (a charge it claimed).
 */
export class PaymentNotWaiting extends Error {
  constructor() {
    super("payment is no longer waiting");
  }
}

export async function bookCharge(
  tx: Prisma.TransactionClient,
  input: { paymentId: string; chargeId: string; rentalId: string; matchedBy: string; paidAt: Date; actor: Actor | null }
): Promise<boolean> {
  const charge = await tx.charge.findUnique({
    where: { id: input.chargeId },
    select: { status: true, rentalId: true },
  });
  if (!charge || charge.rentalId !== input.rentalId) return false;
  if (!(OPEN_CHARGE as readonly string[]).includes(charge.status)) return false;

  const claimed = await tx.charge.updateMany({
    where: { id: input.chargeId, status: charge.status },
    data: { status: "PAID", paidAt: input.paidAt },
  });
  if (claimed.count === 0) return false;

  // Conditional, like the charge above: of two bookings of one payment that
  // both claimed a charge, the second finds the payment already BOOKED here
  // and throws, and its transaction gives its charge back.
  const took = await tx.payment.updateMany({
    where: { id: input.paymentId, status: "NEEDS_REVIEW" },
    data: {
      status: "BOOKED",
      reviewReason: null,
      rentalId: input.rentalId,
      chargeId: input.chargeId,
      matchedBy: input.matchedBy,
    },
  });
  if (took.count === 0) throw new PaymentNotWaiting();
  await recordPaymentEvent(
    tx,
    input.paymentId,
    "payment.booked",
    { chargeId: input.chargeId, rentalId: input.rentalId, matchedBy: input.matchedBy, previousChargeStatus: charge.status },
    input.actor
  );
  return true;
}
