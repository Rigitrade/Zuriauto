/**
 * What the office can do to a fine.
 *
 * Each action checks the state it needs, does one thing, and writes a
 * `FineEvent` naming who did it — the timeline is how the office answers
 * "who decided this was Anna's?" months later. Moving a fine out of the
 * states a renter can act on burns its payment link.
 */

import { z } from "zod";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { zurichInstant } from "@/lib/admin/rentalPeriod";
import { isPlaceholderEmail } from "@/lib/rental/placeholder";
import { recordEvent, type Actor } from "./events";
import { handlingFeeCents } from "./fee";
import { fineThanksMail } from "./mail";
import { notifyRenter, sendFineOnce, type NotifyDeps } from "./notify";
import { momentOf, responsibleAt } from "./possession";
import { loadIntervals } from "./repo/possessionLoad";
import { burnFineTokens } from "./token";
import { asRentalLanguage } from "@/lib/rental/labels";

export const fineActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("assign"), rentalId: z.string().min(1) }),
  z.object({ action: z.literal("send") }),
  z.object({
    action: z.literal("correct"),
    field: z.enum(["violationAt", "carId", "amountCents", "fineNumber", "dueDate"]),
    value: z.union([z.string(), z.number()]),
  }),
  z.object({ action: z.literal("markPaid"), note: z.string().max(500).optional() }),
  z.object({ action: z.literal("acceptProof"), proofId: z.string().min(1) }),
  z.object({ action: z.literal("rejectProof"), proofId: z.string().min(1) }),
  z.object({ action: z.literal("close"), note: z.string().trim().min(1).max(500) }),
  z.object({ action: z.literal("void"), note: z.string().max(500).optional() }),
  z.object({ action: z.literal("reopen") }),
  z.object({ action: z.literal("feePaid") }),
  z.object({ action: z.literal("feeWaived") }),
]);

export type FineAction = z.infer<typeof fineActionSchema>;

export type ActionResult = { ok: true } | { ok: false; code: "bad-request" | "conflict" | "not-found" };

const BAD = { ok: false, code: "bad-request" } as const;
const CONFLICT = { ok: false, code: "conflict" } as const;
const OK = { ok: true } as const;

async function feeOf(client: PrismaClient, rentalId: string): Promise<number> {
  const pickup = await client.contract.findFirst({
    where: { rentalId, kind: "PICKUP" },
    select: { gtcVersion: true },
  });
  return handlingFeeCents(pickup?.gtcVersion ?? null);
}

/** The Zurich day a stored instant falls on, as YYYY-MM-DD. */
function zurichDay(at: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich" }).format(at);
}

/**
 * Who had the car, again, after the office corrected the car or the moment.
 * The fine stays in review either way; sending is a separate, deliberate act.
 */
async function rematch(client: PrismaClient, fineId: string): Promise<void> {
  const fine = await client.fine.findUniqueOrThrow({
    where: { id: fineId },
    select: { carId: true, violationAt: true, violationTimeKnown: true },
  });
  if (!fine.carId || !fine.violationAt) return;

  const moment = fine.violationTimeKnown
    ? ({ kind: "instant", at: fine.violationAt } as const)
    : momentOf(zurichDay(fine.violationAt), null);
  if (!moment) return;

  const responsible = responsibleAt(await loadIntervals(client, fine.carId), moment);
  if (!responsible.ok) {
    await client.fine.update({
      where: { id: fineId },
      data: { rentalId: null, customerId: null, reviewReason: responsible.reason },
    });
    return;
  }
  await assignRental(client, fineId, responsible.rentalId);
}

async function assignRental(client: PrismaClient, fineId: string, rentalId: string): Promise<void> {
  const rental = await client.rental.findUniqueOrThrow({
    where: { id: rentalId },
    select: { customerId: true, customer: { select: { email: true } } },
  });
  const fee = await feeOf(client, rentalId);
  await client.fine.update({
    where: { id: fineId },
    data: {
      rentalId,
      customerId: rental.customerId,
      reviewReason: isPlaceholderEmail(rental.customer.email) ? "NO_CUSTOMER_EMAIL" : null,
      handlingFeeCents: fee,
      handlingFeeStatus: fee > 0 ? "DUE" : "NONE",
    },
  });
}

async function thank(deps: NotifyDeps, fineId: string): Promise<void> {
  const fine = await deps.client.fine.findUniqueOrThrow({
    where: { id: fineId },
    include: {
      car: { select: { plate: true, model: true } },
      customer: { select: { firstName: true, email: true } },
      rental: { select: { contracts: { where: { kind: "PICKUP" }, select: { gtcLanguage: true }, take: 1 } } },
    },
  });
  if (!fine.customer || !fine.car || !fine.violationAt || isPlaceholderEmail(fine.customer.email)) return;
  const { customer, car } = fine;
  await sendFineOnce(deps, { fineId, kind: "FINE_PAID", dedupeKey: "paid", to: customer.email }, async () => ({
    to: customer.email,
    ...fineThanksMail({
      language: asRentalLanguage(fine.rental?.contracts[0]?.gtcLanguage),
      firstName: customer.firstName,
      plate: car.plate,
      carModel: car.model,
      violationAt: fine.violationAt!,
      timeKnown: fine.violationTimeKnown,
      location: fine.location,
      offence: { de: "", en: "" },
      amountCents: fine.amountCents ?? 0,
      dueDate: fine.dueDate,
      issuerName: fine.issuerName,
      fineNumber: fine.fineNumber,
      feeCents: 0,
      payUrl: "",
      reminder: false,
    }),
  }));
}

async function correct(
  client: PrismaClient,
  fineId: string,
  organisationId: string,
  field: "violationAt" | "carId" | "amountCents" | "fineNumber" | "dueDate",
  value: string | number
): Promise<ActionResult> {
  const data: Prisma.FineUncheckedUpdateInput = {};
  let needsRematch = false;

  if (field === "violationAt") {
    if (typeof value !== "string") return BAD;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const day = momentOf(value, null);
      if (!day || day.kind !== "day") return BAD;
      data.violationAt = day.from;
      data.violationTimeKnown = false;
    } else {
      const at = zurichInstant(value);
      if (!at) return BAD;
      data.violationAt = at;
      data.violationTimeKnown = true;
    }
    needsRematch = true;
  } else if (field === "carId") {
    if (typeof value !== "string") return BAD;
    const car = await client.car.findFirst({ where: { id: value, organisationId }, select: { id: true } });
    if (!car) return BAD;
    data.carId = car.id;
    needsRematch = true;
  } else if (field === "amountCents") {
    const cents = Number(value);
    if (!Number.isInteger(cents) || cents <= 0 || cents >= 1_000_000) return BAD;
    data.amountCents = cents;
  } else if (field === "fineNumber") {
    if (typeof value !== "string" || !value.trim()) return BAD;
    data.fineNumber = value.trim();
  } else {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return BAD;
    data.dueDate = new Date(`${value}T00:00:00Z`);
  }

  try {
    await client.fine.update({ where: { id: fineId }, data });
  } catch (error) {
    // A corrected number that another fine already has.
    if ((error as { code?: string })?.code === "P2002") return CONFLICT;
    throw error;
  }
  if (needsRematch) await rematch(client, fineId);
  return OK;
}

export async function applyFineAction(
  deps: NotifyDeps,
  fineId: string,
  action: FineAction,
  actor: Actor
): Promise<ActionResult> {
  const { client, now } = deps;
  const fine = await client.fine.findUnique({
    where: { id: fineId },
    select: {
      id: true,
      organisationId: true,
      status: true,
      carId: true,
      rentalId: true,
      customer: { select: { email: true } },
    },
  });
  if (!fine) return { ok: false, code: "not-found" };

  const open = fine.status === "NEEDS_REVIEW" || fine.status === "NOTIFIED" || fine.status === "PROOF_SUBMITTED";
  let result: ActionResult = OK;

  switch (action.action) {
    case "assign": {
      if (!open) return CONFLICT;
      const rental = await client.rental.findUnique({ where: { id: action.rentalId }, select: { carId: true } });
      if (!rental || (fine.carId && rental.carId !== fine.carId)) return CONFLICT;
      if (!fine.carId) await client.fine.update({ where: { id: fineId }, data: { carId: rental.carId } });
      await assignRental(client, fineId, action.rentalId);
      break;
    }
    case "send": {
      if (fine.status !== "NEEDS_REVIEW" && fine.status !== "NOTIFIED") return CONFLICT;
      if (!fine.rentalId || !fine.customer || isPlaceholderEmail(fine.customer.email)) return CONFLICT;
      // A dedupe key of its own: a deliberate send is never "already sent",
      // which is the point when the first one bounced.
      await notifyRenter(deps, fineId, "notice", { dedupeKey: `manual-${now.getTime()}` });
      break;
    }
    case "correct":
      if (!open) return CONFLICT;
      result = await correct(client, fineId, fine.organisationId, action.field, action.value);
      if (!result.ok) return result;
      break;
    case "markPaid":
      if (!open) return CONFLICT;
      await client.fine.update({
        where: { id: fineId },
        data: { status: "PAID", paidVia: "OFFICE", paidAt: now, reviewReason: null },
      });
      await burnFineTokens(client, fineId, now);
      break;
    case "acceptProof": {
      const proof = await client.finePaymentProof.findFirst({ where: { id: action.proofId, fineId } });
      if (!proof || !open) return CONFLICT;
      await client.finePaymentProof.update({
        where: { id: proof.id },
        data: { accepted: true, checkedById: actor.id, checkedAt: now },
      });
      await client.fine.update({
        where: { id: fineId },
        data: { status: "PAID", paidVia: "PROOF_CHECKED_BY_OFFICE", paidAt: now, reviewReason: null },
      });
      await burnFineTokens(client, fineId, now);
      await thank(deps, fineId);
      break;
    }
    case "rejectProof": {
      const proof = await client.finePaymentProof.findFirst({ where: { id: action.proofId, fineId } });
      if (!proof) return CONFLICT;
      await client.finePaymentProof.update({
        where: { id: proof.id },
        data: { accepted: false, checkedById: actor.id, checkedAt: now },
      });
      if (fine.status === "PROOF_SUBMITTED") {
        await client.fine.update({ where: { id: fineId }, data: { status: "NOTIFIED" } });
      }
      break;
    }
    case "close":
      if (!open) return CONFLICT;
      await client.fine.update({
        where: { id: fineId },
        data: { status: "HANDLED_OTHERWISE", closedById: actor.id, closedNote: action.note, reviewReason: null },
      });
      await burnFineTokens(client, fineId, now);
      break;
    case "void":
      await client.fine.update({
        where: { id: fineId },
        data: { status: "VOID", closedById: actor.id, closedNote: action.note ?? null, reviewReason: null },
      });
      await burnFineTokens(client, fineId, now);
      break;
    case "reopen":
      if (open) return CONFLICT;
      await client.fine.update({
        where: { id: fineId },
        data: { status: "NEEDS_REVIEW", paidAt: null, paidVia: null, closedById: null, closedNote: null },
      });
      break;
    case "feePaid":
    case "feeWaived":
      await client.fine.update({
        where: { id: fineId },
        data: { handlingFeeStatus: action.action === "feePaid" ? "PAID" : "WAIVED" },
      });
      break;
  }

  await recordEvent(client, fineId, `office.${action.action}`, { ...action }, actor, now);
  return result;
}
