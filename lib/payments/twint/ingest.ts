/**
 * One email from the mailbox, start to finish.
 *
 *   is it TWINT's?        no  → "unsigned"
 *   can we read it?       no  → "unreadable"
 *   paid to our store?    no  → "other-store"
 *   seen it before?       yes → "duplicate"
 *   then: store, decide, and book if two signals agree — in one transaction,
 *   so a payment never exists half-booked.
 *
 * The first three book nothing and leave a PaymentMailIssue for the office,
 * once per email: a forged notification, a layout TWINT changed or another
 * merchant's payment forwarded here must be seen, not only logged. The other
 * store matters because a merchant's own TWINT notification is genuinely
 * signed — forwarded to us, it would otherwise book our week for money paid
 * to somebody else.
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
import { parseNotification, type TwintNotification } from "./parse";

export interface RawMail {
  uid: number | null;
  source: Buffer;
}

export type IngestOutcome = "booked" | "review" | "duplicate" | "unsigned" | "unreadable" | "other-store";

export interface ReadOptions {
  /** Injected by tests; production checks TWINT's DKIM signature. */
  verify?: (raw: Buffer) => Promise<boolean>;
  /** Our store's name as TWINT prints it; TWINT_STORE_NAME, else "Zuriauto". */
  storeName?: string;
}

export interface IngestDeps extends ReadOptions {
  client: PrismaClient;
  organisationId: string;
}

interface About {
  messageKey: string;
  subject: string | null;
  receivedAt: Date | null;
}

/** A notification TWINT signed, that reads, for our store — or why not. */
export type MailReading =
  | { ok: true; notification: TwintNotification; about: About }
  | {
      ok: false;
      outcome: "unsigned" | "unreadable" | "other-store";
      reason: "UNSIGNED" | "UNREADABLE" | "OTHER_STORE";
      detail: string | null;
      about: About;
    };

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";
}

const sameStore = (a: string | null, b: string) => (a ?? "").trim().toLowerCase() === b.trim().toLowerCase();

/** One issue per email, however often the mailbox is read again. */
async function recordIssue(
  client: PrismaClient,
  organisationId: string,
  issue: {
    messageKey: string;
    reason: "UNSIGNED" | "UNREADABLE" | "OTHER_STORE";
    detail: string | null;
    subject: string | null;
    receivedAt: Date | null;
  }
): Promise<void> {
  try {
    await client.paymentMailIssue.create({ data: { organisationId, ...issue } });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
  }
}

/**
 * The first three questions, none of which needs the database. Shared with
 * the dry run (dryRun.ts), so what it reports is what this file would do.
 */
export async function readMail(mail: RawMail, options: ReadOptions = {}): Promise<MailReading> {
  const verify = options.verify ?? verifyTwintSignature;
  const ourStore = options.storeName ?? (process.env.TWINT_STORE_NAME?.trim() || "Zuriauto");

  // Read first, trust second: an email that fails the signature still needs
  // its subject and Message-ID to be listed for the office.
  const parsed = await simpleParser(mail.source);
  const about = {
    messageKey: parsed.messageId ?? `uid:${mail.uid}`,
    subject: parsed.subject ?? null,
    receivedAt: parsed.date ?? null,
  };

  if (!(await verify(mail.source))) {
    console.warn(`[twint] uid ${mail.uid}: not signed by TWINT, skipped`);
    return { ok: false, outcome: "unsigned", reason: "UNSIGNED", detail: null, about };
  }

  const result = parseNotification(parsed.html || parsed.textAsHtml || "");
  if (!result.ok) {
    console.warn(`[twint] uid ${mail.uid}: ${result.reason} ${result.field ?? ""}`.trim());
    return { ok: false, outcome: "unreadable", reason: "UNREADABLE", detail: result.field ?? result.reason, about };
  }
  const n = result.notification;

  if (!sameStore(n.storeName, ourStore)) {
    console.warn(`[twint] uid ${mail.uid}: paid to "${n.storeName}", not to "${ourStore}"`);
    return { ok: false, outcome: "other-store", reason: "OTHER_STORE", detail: n.storeName, about };
  }
  return { ok: true, notification: n, about };
}

export async function ingestMail(deps: IngestDeps, mail: RawMail): Promise<IngestOutcome> {
  const { client, organisationId } = deps;

  const reading = await readMail(mail, deps);
  if (!reading.ok) {
    await recordIssue(client, organisationId, { ...reading.about, reason: reading.reason, detail: reading.detail });
    return reading.outcome;
  }
  const n = reading.notification;

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
