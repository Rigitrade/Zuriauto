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

/**
 * Books a waiting payment to a rental: one week (or none) and a deposit share
 * (or none). One payment pays at most the deposit and one week — the ledger
 * spec, decision 3. Neither → a credit on the rental.
 */
export async function bookPayment(
  tx: Prisma.TransactionClient,
  input: {
    paymentId: string;
    rentalId: string;
    chargeId: string | null;
    depositCents: number;
    matchedBy: string;
    paidAt: Date;
    actor: Actor | null;
  }
): Promise<boolean> {
  // First, before anything is written: one deposit, however many bookings
  // race for it. The rental row is locked and what is still outstanding is
  // counted again inside this transaction, so a cash deposit recorded while
  // the cron books a TWINT one cannot both count.
  if (input.depositCents > 0) {
    // NO KEY UPDATE, not UPDATE: ingest has already created a payment pointing
    // at this rental, which holds KEY SHARE on it; FOR UPDATE would make two
    // overlapping runs deadlock while upgrading. This still lets one through.
    await tx.$queryRaw`SELECT id FROM "Rental" WHERE id = ${input.rentalId} FOR NO KEY UPDATE`;
    const rental = await tx.rental.findUnique({
      where: { id: input.rentalId },
      select: { depositCents: true, payments: { where: { status: "BOOKED" }, select: { depositCents: true } } },
    });
    const received = rental?.payments.reduce((sum, p) => sum + p.depositCents, 0) ?? 0;
    if (!rental || input.depositCents > rental.depositCents - received) return false;
  }

  let previousChargeStatus: string | null = null;
  if (input.chargeId) {
    const charge = await tx.charge.findUnique({ where: { id: input.chargeId }, select: { status: true, rentalId: true } });
    if (!charge || charge.rentalId !== input.rentalId) return false;
    if (!(OPEN_CHARGE as readonly string[]).includes(charge.status)) return false;
    const claimed = await tx.charge.updateMany({
      where: { id: input.chargeId, status: charge.status },
      data: { status: "PAID", paidAt: input.paidAt },
    });
    if (claimed.count === 0) return false;
    previousChargeStatus = charge.status;
  }

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
      depositCents: input.depositCents,
      matchedBy: input.matchedBy,
    },
  });
  if (took.count === 0) throw new PaymentNotWaiting();
  await recordPaymentEvent(
    tx,
    input.paymentId,
    input.chargeId || input.depositCents > 0 ? "payment.booked" : "payment.credited",
    {
      chargeId: input.chargeId,
      rentalId: input.rentalId,
      depositCents: input.depositCents,
      matchedBy: input.matchedBy,
      previousChargeStatus,
    },
    input.actor
  );
  return true;
}

/** A week and no deposit: what every caller before the ledger booked. */
export function bookCharge(
  tx: Prisma.TransactionClient,
  input: { paymentId: string; chargeId: string; rentalId: string; matchedBy: string; paidAt: Date; actor: Actor | null }
): Promise<boolean> {
  return bookPayment(tx, { ...input, depositCents: 0 });
}
