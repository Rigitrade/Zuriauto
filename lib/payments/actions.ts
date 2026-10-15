/**
 * What the office can do to a payment.
 *
 *   book    a waiting payment to a rental — and to one of its open weeks, or
 *           to none, as a credit (deposit, damage, anything not a week)
 *   ignore  a waiting payment that is not ours to book; a reason is required
 *   undo    a booking (the charge goes back to its previous status) or an
 *           ignore; the payment waits again
 *
 * Every action writes a PaymentEvent naming who did it.
 */

import { z } from "zod";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { Actor } from "@/lib/fines/events";
import { bookCharge, PaymentNotWaiting } from "./book";
import { recordPaymentEvent } from "./events";
import { OPEN_CHARGE } from "./twint/decide";

export const paymentActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("book"), rentalId: z.string().min(1), chargeId: z.string().min(1).nullable() }),
  z.object({ action: z.literal("ignore"), note: z.string().trim().min(1).max(500) }),
  z.object({ action: z.literal("undo") }),
]);

export type PaymentAction = z.infer<typeof paymentActionSchema>;
export type PaymentActionResult = { ok: true } | { ok: false; code: "bad-request" | "conflict" | "not-found" };

const OK = { ok: true } as const;
const CONFLICT = { ok: false, code: "conflict" } as const;
const NOT_FOUND = { ok: false, code: "not-found" } as const;

/** Runs one action's transaction; a payment taken by a concurrent action is a conflict. */
async function inTransaction(
  client: PrismaClient,
  work: (tx: Prisma.TransactionClient) => Promise<boolean>
): Promise<PaymentActionResult> {
  try {
    return (await client.$transaction(work)) ? OK : CONFLICT;
  } catch (error) {
    if (error instanceof PaymentNotWaiting) return CONFLICT;
    throw error;
  }
}

/** Moves the payment only if it is still in the status this action read. */
async function claim(
  tx: Prisma.TransactionClient,
  paymentId: string,
  from: "NEEDS_REVIEW" | "BOOKED" | "IGNORED",
  data: Prisma.PaymentUncheckedUpdateManyInput
): Promise<void> {
  const took = await tx.payment.updateMany({ where: { id: paymentId, status: from }, data });
  if (took.count === 0) throw new PaymentNotWaiting();
}

export async function applyPaymentAction(
  client: PrismaClient,
  paymentId: string,
  action: PaymentAction,
  actor: Actor
): Promise<PaymentActionResult> {
  const payment = await client.payment.findUnique({
    where: { id: paymentId },
    select: { id: true, organisationId: true, status: true, chargeId: true, paidAt: true },
  });
  if (!payment) return NOT_FOUND;

  if (action.action === "book") {
    if (payment.status !== "NEEDS_REVIEW") return CONFLICT;
    const rental = await client.rental.findFirst({
      where: { id: action.rentalId, organisationId: payment.organisationId },
      select: { id: true },
    });
    if (!rental) return NOT_FOUND;

    if (action.chargeId) {
      const chargeId = action.chargeId;
      return inTransaction(client, (tx) =>
        bookCharge(tx, { paymentId, chargeId, rentalId: rental.id, matchedBy: "office", paidAt: payment.paidAt, actor })
      );
    }
    return inTransaction(client, async (tx) => {
      await claim(tx, paymentId, "NEEDS_REVIEW", {
        status: "BOOKED",
        reviewReason: null,
        rentalId: rental.id,
        chargeId: null,
        matchedBy: "office",
      });
      await recordPaymentEvent(tx, paymentId, "payment.credited", { rentalId: rental.id }, actor);
      return true;
    });
  }

  if (action.action === "ignore") {
    if (payment.status !== "NEEDS_REVIEW") return CONFLICT;
    return inTransaction(client, async (tx) => {
      await claim(tx, paymentId, "NEEDS_REVIEW", { status: "IGNORED" });
      await recordPaymentEvent(tx, paymentId, "payment.ignored", { note: action.note }, actor);
      return true;
    });
  }

  // undo
  if (payment.status === "NEEDS_REVIEW") return CONFLICT;
  const from = payment.status;
  return inTransaction(client, async (tx) => {
    // The payment first: an undo racing another undo, or a booking that was
    // already undone, stops here before any charge is touched.
    await claim(tx, paymentId, from, { status: "NEEDS_REVIEW", chargeId: null, matchedBy: null });
    if (from === "BOOKED" && payment.chargeId) {
      const booked = await tx.paymentEvent.findFirst({
        where: { paymentId, type: "payment.booked" },
        orderBy: { createdAt: "desc" },
        select: { payload: true },
      });
      const previous = (booked?.payload as { previousChargeStatus?: string } | null)?.previousChargeStatus;
      const restore = (OPEN_CHARGE as readonly string[]).includes(previous ?? "")
        ? (previous as (typeof OPEN_CHARGE)[number])
        : "REQUESTED";
      await tx.charge.updateMany({
        where: { id: payment.chargeId, status: "PAID" },
        data: { status: restore, paidAt: null },
      });
    }
    await recordPaymentEvent(tx, paymentId, from === "BOOKED" ? "payment.undone" : "payment.reopened", {}, actor);
    return true;
  });
}
