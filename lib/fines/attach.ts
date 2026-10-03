/**
 * A processed letter, attached to the fine it is about.
 *
 * Either a new fine, matched to a car and renter, or — for a reminder or a
 * second copy — the fine already on file. A new fine that matched cleanly is
 * handed to `notify`; anything else waits for the office.
 */

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { AssetStore } from "@/lib/storage";
import { recordEvent } from "./events";
import { handlingFeeCents } from "./fee";
import { matchFine, type MatchResult } from "./match";
import { offenceWording } from "./offences";
import type { FineReader, ReadResult } from "./reader";
import type { Extraction } from "./types";

export type NotifyReason = "notice" | "reminder" | "reopened";

export interface FineDeps {
  client: PrismaClient;
  store: AssetStore;
  reader: FineReader;
  now: Date;
  /** Emails the renter and moves the fine on; see lib/fines/notify.ts. */
  notify: (fineId: string, reason: NotifyReason) => Promise<void>;
}

/** Payment periods on Swiss fines are thirty days from the letter. */
export const DEFAULT_PAYMENT_DAYS = 30;

function day(iso: string | null): Date | null {
  return iso ? new Date(`${iso}T00:00:00Z`) : null;
}

function plusDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function trusted<T>(f: { value: T | null; status: string }): T | null {
  return f.status === "READ" || f.status === "CONFIRMED" ? f.value : null;
}

export function dueDateOf(x: Extraction): string | null {
  const printed = trusted(x.dueDate);
  if (printed) return printed;
  const letter = trusted(x.letterDate);
  return letter ? plusDays(letter, DEFAULT_PAYMENT_DAYS) : null;
}

async function feeFor(client: PrismaClient, rentalId: string | null): Promise<number> {
  if (!rentalId) return 0;
  const pickup = await client.contract.findFirst({
    where: { rentalId, kind: "PICKUP" },
    select: { gtcVersion: true },
  });
  return handlingFeeCents(pickup?.gtcVersion ?? null);
}

/** The columns a fine takes from its first letter and its match. */
export function fineFields(
  x: Extraction,
  match: MatchResult
): Omit<Prisma.FineUncheckedCreateInput, "organisationId"> {
  const wording = offenceWording({
    code: x.offenceCode.value,
    original: x.offenceText.value,
    language: x.language,
    issuerKind: x.issuerKind,
  });
  return {
    issuerKind: x.issuerKind,
    issuerName: x.issuerName.value,
    issuerIban: x.issuerIban.value,
    fineNumber: x.fineNumber.value,
    paymentReference: x.paymentReference.value,
    amountCents: x.amountCents.value,
    violationAt: match.violationAt,
    violationTimeKnown: match.violationTimeKnown,
    location: x.location.value,
    offenceCode: x.offenceCode.value,
    offenceTextOriginal: x.offenceText.value,
    offenceTextDe: wording.de,
    offenceTextEn: wording.en,
    speedMeasuredKmh: x.speedMeasuredKmh.value,
    speedLimitKmh: x.speedLimitKmh.value,
    letterDate: day(trusted(x.letterDate)),
    dueDate: day(dueDateOf(x)),
    reminderLevel: x.kind === "REMINDER" ? 1 : 0,
    firstSeenAsReminder: x.kind === "REMINDER",
    carId: match.carId,
    rentalId: match.rentalId,
    customerId: match.customerId,
    status: "NEEDS_REVIEW",
    reviewReason: match.reviewReason,
  };
}

export async function attachDocument(
  deps: FineDeps,
  document: { id: string; organisationId: string },
  read: ReadResult
): Promise<{ fineId: string; created: boolean }> {
  const { client, now } = deps;
  const x = read.extraction;
  const match = await matchFine(client, document.organisationId, x, read.ocrText);
  const fee = match.reviewReason === null ? await feeFor(client, match.rentalId) : 0;

  const fineId = await client.$transaction(async (tx) => {
    const fine = await tx.fine.create({
      data: {
        organisationId: document.organisationId,
        ...fineFields(x, match),
        handlingFeeCents: fee,
        handlingFeeStatus: fee > 0 ? "DUE" : "NONE",
      },
      select: { id: true },
    });
    await tx.fineDocument.update({ where: { id: document.id }, data: { fineId: fine.id } });
    await recordEvent(tx, fine.id, "fine.created", {
      documentId: document.id,
      reviewReason: match.reviewReason,
      candidates: match.candidates,
    }, null, now);
    return fine.id;
  });

  if (match.reviewReason === null) await deps.notify(fineId, "notice");
  return { fineId, created: true };
}
