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

/**
 *  notice    a new fine for its renter
 *  reminder  a Mahnung for a fine the renter has not settled
 *  reopened  a Mahnung after the fine was thought paid — renter and office
 *  office    a Mahnung for a fine the office closed another way
 */
export type NotifyReason = "notice" | "reminder" | "reopened" | "office";

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

/**
 * The fine this letter is about, if we have it: the same issuer and number,
 * or the same payment reference. Both are exact — decoded from the slip or
 * read under their label — which is why nothing looser is trusted here.
 */
async function findExisting(
  client: PrismaClient,
  organisationId: string,
  x: Extraction
) {
  const or: Prisma.FineWhereInput[] = [];
  if (x.issuerIban.value && x.fineNumber.value) {
    or.push({ issuerIban: x.issuerIban.value, fineNumber: x.fineNumber.value });
  }
  if (x.paymentReference.value) or.push({ paymentReference: x.paymentReference.value });
  if (or.length === 0) return null;
  return client.fine.findFirst({
    where: { organisationId, OR: or },
    orderBy: { createdAt: "asc" },
    select: { id: true, status: true, rentalId: true, handlingFeeCents: true, amountCents: true },
  });
}

/**
 * A fine on file for the same car and moment, when the letter carries
 * nothing that identifies it exactly. Not merged — only flagged, because two
 * offences in the same minute are rare but not impossible.
 */
async function probableDuplicate(
  client: PrismaClient,
  organisationId: string,
  match: MatchResult,
  issuerName: string | null
): Promise<string | null> {
  if (!match.carId || !match.violationAt) return null;
  const twin = await client.fine.findFirst({
    where: {
      organisationId,
      carId: match.carId,
      violationAt: match.violationAt,
      ...(issuerName ? { OR: [{ issuerName }, { issuerName: null }] } : {}),
    },
    select: { id: true },
  });
  return twin?.id ?? null;
}

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string })?.code === "P2002";
}

/**
 * Another letter for a fine we have. A second copy only joins the file. A
 * reminder updates the amount and the deadline, and what happens next
 * depends on where the fine stands — the police are the authority on
 * whether it was paid. See the spec, "Duplicates and reminders".
 */
async function attachToExisting(
  deps: FineDeps,
  document: { id: string },
  x: Extraction,
  existing: NonNullable<Awaited<ReturnType<typeof findExisting>>>
): Promise<{ fineId: string; created: boolean }> {
  const { client, now } = deps;
  const isReminder = x.kind === "REMINDER";

  let follow: NotifyReason | null = null;
  const data: Prisma.FineUncheckedUpdateInput = {};
  if (isReminder) {
    data.reminderLevel = { increment: 1 };
    if (x.amountCents.value !== null) data.amountCents = x.amountCents.value;
    const due = dueDateOf(x);
    if (due) data.dueDate = day(due);

    switch (existing.status) {
      case "NOTIFIED": {
        // Notified and not paid: the GTC's fee for a Mahnung.
        const fee = await feeFor(client, existing.rentalId);
        if (fee > 0) {
          data.handlingFeeCents = existing.handlingFeeCents + fee;
          data.handlingFeeStatus = "DUE";
        }
        follow = "reminder";
        break;
      }
      case "PAID":
      case "PROOF_SUBMITTED":
        data.status = "NEEDS_REVIEW";
        data.reviewReason = "REMINDER_AFTER_PAID";
        data.paidAt = null;
        data.paidVia = null;
        follow = "reopened";
        break;
      case "HANDLED_OTHERWISE":
      case "VOID":
        follow = "office";
        break;
      default:
        // Already waiting for the office, who will see it.
        break;
    }
  }

  await client.$transaction(async (tx) => {
    await tx.fineDocument.update({ where: { id: document.id }, data: { fineId: existing.id } });
    if (Object.keys(data).length > 0) {
      await tx.fine.update({ where: { id: existing.id }, data });
    }
    await recordEvent(tx, existing.id, "document.attached", {
      documentId: document.id,
      kind: x.kind,
      amountCents: x.amountCents.value,
      previousStatus: existing.status,
      reopened: follow === "reopened",
    }, null, now);
  });

  if (follow) await deps.notify(existing.id, follow);
  return { fineId: existing.id, created: false };
}

export async function attachDocument(
  deps: FineDeps,
  document: { id: string; organisationId: string },
  read: ReadResult
): Promise<{ fineId: string; created: boolean }> {
  const { client, now } = deps;
  const x = read.extraction;

  const existing = await findExisting(client, document.organisationId, x);
  if (existing) return attachToExisting(deps, document, x, existing);

  let match = await matchFine(client, document.organisationId, x, read.ocrText);
  if (!x.fineNumber.value && !x.paymentReference.value) {
    const twin = await probableDuplicate(client, document.organisationId, match, x.issuerName.value);
    if (twin) match = { ...match, reviewReason: "PROBABLE_DUPLICATE", candidates: [twin] };
  }
  const fee = match.reviewReason === null ? await feeFor(client, match.rentalId) : 0;

  let fineId: string;
  try {
    fineId = await client.$transaction(async (tx) => {
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
  } catch (error) {
    // Another copy of the same fine was created a moment ago — two letters
    // processed at once. The database's unique index decided; join it.
    if (!isUniqueViolation(error)) throw error;
    const winner = await findExisting(client, document.organisationId, x);
    if (!winner) throw error;
    return attachToExisting(deps, document, x, winner);
  }

  if (match.reviewReason === null) await deps.notify(fineId, "notice");
  return { fineId, created: true };
}
