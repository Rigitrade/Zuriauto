/**
 * Payments the office records by hand: cash at the desk, a card, a bank
 * transfer, or a TWINT payment whose email never came. They go through the
 * same booking as a TWINT email (bookPayment), so the week, the deposit, the
 * timeline and undo all behave the same — the ledger spec, decision 2.
 */

import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import { zurichInstant } from "@/lib/admin/rentalPeriod";
import type { Actor } from "@/lib/fines/events";
import { BAD_REQUEST, CONFLICT, inTransaction, NOT_FOUND, outstandingDeposit, type PaymentActionResult } from "./actions";
import { bookPayment } from "./book";
import { recordPaymentEvent } from "./events";

/** TWINT's Transaktions-Nr., as parse.ts reads it from the email. */
const TWINT_ID = /^[0-9a-f][0-9a-f-]{7,}$/i;

export const officePaymentSchema = z
  .object({
    amountCents: z.number().int().positive().max(10_000_000),
    /** The Zurich day it was paid; stored as noon that day. */
    paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    method: z.enum(["CASH", "CARD", "BANK", "TWINT"]),
    chargeId: z.string().min(1).nullable(),
    depositCents: z.number().int().min(0).default(0),
    note: z.string().trim().max(500).default(""),
    /**
     * Required for TWINT. A TWINT payment recorded by hand — the renter shows
     * the confirmation at the desk — still sends its email. Stored under the
     * same Transaktions-Nr., the email is then a duplicate instead of a second
     * payment that books the next week.
     */
    transactionId: z.string().trim().max(64).optional(),
  })
  .refine((p) => p.method !== "TWINT" || TWINT_ID.test(p.transactionId ?? ""), { path: ["transactionId"] });
export type OfficePayment = z.input<typeof officePaymentSchema>;

export async function recordOfficePayment(
  client: PrismaClient,
  rentalId: string,
  raw: OfficePayment,
  actor: Actor
): Promise<PaymentActionResult> {
  const parsed = officePaymentSchema.safeParse(raw);
  if (!parsed.success) return BAD_REQUEST;
  const input = parsed.data;

  const rental = await client.rental.findUnique({ where: { id: rentalId }, select: { organisationId: true } });
  if (!rental) return NOT_FOUND;

  const outstanding = (await outstandingDeposit(client, rentalId)) ?? 0;
  if (input.depositCents > outstanding || input.depositCents > input.amountCents) return BAD_REQUEST;
  if (input.chargeId) {
    const charge = await client.charge.findFirst({ where: { id: input.chargeId, rentalId }, select: { amountCents: true } });
    if (!charge) return NOT_FOUND;
    // The whole amount is accounted for: the week and the deposit share.
    if (input.amountCents !== charge.amountCents + input.depositCents) return BAD_REQUEST;
  } else if (input.depositCents > 0 && input.amountCents !== input.depositCents) {
    return BAD_REQUEST;
  }
  const paidAt = zurichInstant(`${input.paidOn}T12:00`);
  if (!paidAt) return BAD_REQUEST;

  // A bookPayment that finds the week paid in between returns false, and
  // inTransaction answers "conflict" and rolls the new payment back with it.
  const externalId = input.method === "TWINT" ? input.transactionId!.toLowerCase() : `office:${randomUUID()}`;
  try {
    return await recordAndBook(client, rentalId, rental.organisationId, externalId, paidAt, input, actor);
  } catch (error) {
    // That Transaktions-Nr. is already stored: its email was read, or it was recorded.
    if ((error as { code?: string }).code === "P2002") return CONFLICT;
    throw error;
  }
}

function recordAndBook(
  client: PrismaClient,
  rentalId: string,
  organisationId: string,
  externalId: string,
  paidAt: Date,
  input: z.output<typeof officePaymentSchema>,
  actor: Actor
): Promise<PaymentActionResult> {
  return inTransaction(client, async (tx) => {
    const payment = await tx.payment.create({
      data: {
        organisationId,
        externalId,
        amountCents: input.amountCents,
        paidAt,
        method: input.method,
        note: input.note || null,
        status: "NEEDS_REVIEW",
        candidates: [rentalId],
      },
      select: { id: true },
    });
    await recordPaymentEvent(tx, payment.id, "payment.recorded", { method: input.method, note: input.note || null }, actor);
    return bookPayment(tx, {
      paymentId: payment.id,
      rentalId,
      chargeId: input.chargeId,
      depositCents: input.depositCents,
      matchedBy: "office",
      paidAt,
      actor,
    });
  });
}
