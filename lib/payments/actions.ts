/**
 * What the office can do to a payment.
 *
 *   book    a waiting payment to a rental — to one of its open weeks, to the
 *           deposit, to both, or to neither, as a credit (damage, anything
 *           else). One payment pays at most the deposit and one week.
 *   ignore  a waiting payment that is not ours to book; a reason is required
 *   undo    a booking (the charge goes back to its previous status) or an
 *           ignore; a TWINT payment waits again, a payment the office
 *           recorded by hand is cancelled (lib/payments/office.ts)
 *
 * Every action writes a PaymentEvent naming who did it.
 */

import { z } from "zod";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { Actor } from "@/lib/fines/events";
import { bookPayment, PaymentNotWaiting } from "./book";
import { recordPaymentEvent } from "./events";
import { forgetPayerFrom, rememberPayer } from "./payerAlias";
import { OPEN_CHARGE } from "./twint/decide";

export const paymentActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("book"),
    rentalId: z.string().min(1),
    chargeId: z.string().min(1).nullable(),
    depositCents: z.number().int().min(0).default(0),
    /** "Zahler merken": this payer's email and phone now count as the renter's. */
    rememberPayer: z.boolean().default(false),
  }),
  z.object({ action: z.literal("ignore"), note: z.string().trim().min(1).max(500) }),
  z.object({ action: z.literal("undo") }),
]);

export type PaymentAction = z.input<typeof paymentActionSchema>;
export type PaymentActionResult = { ok: true } | { ok: false; code: "bad-request" | "conflict" | "not-found" };

export const OK = { ok: true } as const;
export const BAD_REQUEST = { ok: false, code: "bad-request" } as const;
export const CONFLICT = { ok: false, code: "conflict" } as const;
export const NOT_FOUND = { ok: false, code: "not-found" } as const;

/** Runs one action's transaction; a payment taken by a concurrent action is a conflict. */
export async function inTransaction(
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

/** The deposit still to come on a rental: agreed minus what booked payments carried. */
export async function outstandingDeposit(
  client: PrismaClient | Prisma.TransactionClient,
  rentalId: string
): Promise<number | null> {
  const rental = await client.rental.findUnique({
    where: { id: rentalId },
    select: { depositCents: true, payments: { where: { status: "BOOKED" }, select: { depositCents: true } } },
  });
  if (!rental) return null;
  return rental.depositCents - rental.payments.reduce((sum, p) => sum + p.depositCents, 0);
}

/** Puts a booked week back to the status it had before the booking. */
async function restoreCharge(tx: Prisma.TransactionClient, paymentId: string, chargeId: string): Promise<void> {
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
    where: { id: chargeId, status: "PAID" },
    data: { status: restore, paidAt: null },
  });
}

export async function applyPaymentAction(
  client: PrismaClient,
  paymentId: string,
  input: PaymentAction,
  actor: Actor
): Promise<PaymentActionResult> {
  const action = paymentActionSchema.parse(input);
  const payment = await client.payment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      organisationId: true,
      status: true,
      chargeId: true,
      paidAt: true,
      amountCents: true,
      method: true,
      payerEmail: true,
      payerPhone: true,
    },
  });
  if (!payment) return NOT_FOUND;

  if (action.action === "book") {
    if (payment.status !== "NEEDS_REVIEW") return CONFLICT;
    const rental = await client.rental.findFirst({
      where: { id: action.rentalId, organisationId: payment.organisationId },
      select: { id: true, customerId: true },
    });
    if (!rental) return NOT_FOUND;
    if (action.depositCents > 0) {
      const outstanding = (await outstandingDeposit(client, rental.id)) ?? 0;
      if (action.depositCents > outstanding || action.depositCents > payment.amountCents) return BAD_REQUEST;
      // Deposit and week from one payment only when it covers both.
      if (action.chargeId) {
        const charge = await client.charge.findFirst({ where: { id: action.chargeId, rentalId: rental.id }, select: { amountCents: true } });
        if (charge && payment.amountCents < charge.amountCents + action.depositCents) return BAD_REQUEST;
      }
    }
    return inTransaction(client, async (tx) => {
      const booked = await bookPayment(tx, {
        paymentId,
        rentalId: rental.id,
        chargeId: action.chargeId,
        depositCents: action.depositCents,
        matchedBy: "office",
        paidAt: payment.paidAt,
        actor,
      });
      if (booked && action.rememberPayer) {
        const remembered = await rememberPayer(tx, {
          organisationId: payment.organisationId,
          customerId: rental.customerId,
          paymentId,
          email: payment.payerEmail,
          phone: payment.payerPhone,
          actor,
        });
        if (remembered > 0) await recordPaymentEvent(tx, paymentId, "payment.payer.remembered", { count: remembered }, actor);
      }
      return booked;
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

  if (payment.method !== "TWINT") {
    // An office payment has no email to wait for: undoing it cancels it, and a
    // cancelled one is not reopened — the office records a new one instead.
    if (from !== "BOOKED") return CONFLICT;
    return inTransaction(client, async (tx) => {
      await claim(tx, paymentId, "BOOKED", { status: "IGNORED", chargeId: null, depositCents: 0, matchedBy: null });
      if (payment.chargeId) await restoreCharge(tx, paymentId, payment.chargeId);
      await forgetPayerFrom(tx, paymentId);
      await recordPaymentEvent(tx, paymentId, "payment.cancelled", {}, actor);
      return true;
    });
  }

  return inTransaction(client, async (tx) => {
    // The payment first: an undo racing another undo, or a booking that was
    // already undone, stops here before any charge is touched.
    await claim(tx, paymentId, from, { status: "NEEDS_REVIEW", chargeId: null, depositCents: 0, matchedBy: null });
    if (from === "BOOKED" && payment.chargeId) await restoreCharge(tx, paymentId, payment.chargeId);
    await forgetPayerFrom(tx, paymentId);
    await recordPaymentEvent(tx, paymentId, from === "BOOKED" ? "payment.undone" : "payment.reopened", {}, actor);
    return true;
  });
}

/** The office has looked at a TWINT email nothing was booked from. */
export async function resolveMailIssue(
  client: PrismaClient,
  issueId: string,
  actor: Actor
): Promise<PaymentActionResult> {
  const done = await client.paymentMailIssue.updateMany({
    where: { id: issueId, resolvedAt: null },
    data: { resolvedAt: new Date(), resolvedById: actor.id, resolvedByName: actor.displayName },
  });
  return done.count === 1 ? OK : CONFLICT;
}
