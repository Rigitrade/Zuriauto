/**
 * One email from the mailbox, start to finish.
 *
 *   is it TWINT's?        no  → "unsigned", nothing stored
 *   can we read it?       no  → "unreadable", nothing stored
 *   seen it before?       yes → "duplicate"
 *   then: store, decide, and book if two signals agree — in one transaction,
 *   so a payment never exists half-booked.
 *
 * Nothing that fails here is lost: the email stays in the mailbox (opened
 * read-only) and the next run reads it again.
 */

import { simpleParser } from "mailparser";
import type { PrismaClient } from "@/generated/prisma/client";
import { bookCharge } from "../book";
import { recordPaymentEvent } from "../events";
import { verifyTwintSignature } from "./authentic";
import { decidePayment } from "./decide";
import { gatherEvidence } from "./evidence";
import { parseNotification } from "./parse";

export interface RawMail {
  uid: number | null;
  source: Buffer;
}

export type IngestOutcome = "booked" | "review" | "duplicate" | "unsigned" | "unreadable";

export interface IngestDeps {
  client: PrismaClient;
  organisationId: string;
  /** Injected by tests; production checks TWINT's DKIM signature. */
  verify?: (raw: Buffer) => Promise<boolean>;
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";
}

export async function ingestMail(deps: IngestDeps, mail: RawMail): Promise<IngestOutcome> {
  const { client, organisationId } = deps;
  const verify = deps.verify ?? verifyTwintSignature;

  if (!(await verify(mail.source))) {
    console.warn(`[twint] uid ${mail.uid}: not signed by TWINT, skipped`);
    return "unsigned";
  }

  const parsed = await simpleParser(mail.source);
  const result = parseNotification(parsed.html || parsed.textAsHtml || "");
  if (!result.ok) {
    console.warn(`[twint] uid ${mail.uid}: ${result.reason} ${result.field ?? ""}`.trim());
    return "unreadable";
  }
  const n = result.notification;

  const seen = await client.payment.findUnique({
    where: { organisationId_externalId: { organisationId, externalId: n.externalId } },
    select: { id: true },
  });
  if (seen) return "duplicate";

  const decision = decidePayment(await gatherEvidence(client, organisationId, n));

  try {
    return await client.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          organisationId,
          externalId: n.externalId,
          amountCents: n.amountCents,
          currency: n.currency,
          paidAt: n.paidAt,
          storeName: n.storeName,
          payerName: n.payerName,
          payerEmail: n.payerEmail,
          payerPhone: n.payerPhone,
          message: n.message,
          mailUid: mail.uid,
          status: "NEEDS_REVIEW",
          reviewReason: decision.status === "NEEDS_REVIEW" ? decision.reason : null,
          rentalId: decision.rentalId,
          candidates: decision.candidates,
        },
        select: { id: true },
      });
      await recordPaymentEvent(tx, payment.id, "payment.received", {
        decision: decision.status,
        reason: decision.status === "NEEDS_REVIEW" ? decision.reason : null,
      });
      if (decision.status !== "BOOKED") return "review";

      const booked = await bookCharge(tx, {
        paymentId: payment.id,
        chargeId: decision.chargeId,
        rentalId: decision.rentalId,
        matchedBy: decision.matchedBy,
        paidAt: n.paidAt,
        actor: null,
      });
      if (booked) return "booked";
      // Paid between evidence and booking — by the office or a parallel run.
      await tx.payment.update({ where: { id: payment.id }, data: { reviewReason: "CHARGE_ALREADY_PAID" } });
      return "review";
    });
  } catch (error) {
    if (isUniqueViolation(error)) return "duplicate";
    throw error;
  }
}
