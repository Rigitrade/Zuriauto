/**
 * "E-Mails" on the payments page: every payment email the system sent a
 * renter, next to what the week is now — and the office's answer to the ones
 * that went wrong.
 *
 * A payment email is a problem when the week it asked for was, by now,
 * - paid before the email went out (cash at the desk recorded late),
 * - settled at the cut-over (due before the system started), or
 * - waived (VOID: not owed),
 * or when the email could not be delivered. A week paid *after* the email is
 * the normal case, not a problem.
 *
 * The office answers a problem once: "Korrektur senden" writes the renter a
 * short please-ignore email (only for a week that is no longer owed — telling
 * somebody to ignore a real debt would be untrue), or "Erledigt" when nothing
 * needs saying. Both record who answered and when.
 */

import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import type { Actor } from "@/lib/fines/events";
import { asRentalLanguage } from "@/lib/rental/labels";
import { chargeCorrectionMail, sendMail, type LifecycleMailConfig } from "@/lib/rental/lifecycleMail";
import { sendOnce, weekDedupeKey } from "@/lib/rental/notify";

/** How far back the page lists sent payment emails. */
export const SENT_MAIL_DAYS = 60;

export type MailProblem = "paidBefore" | "settled" | "voided" | "failed";

export interface SentPaymentMailRow {
  notificationId: string;
  rentalId: string;
  kind: "CHARGE_REQUESTED" | "CHARGE_REMINDER" | "CHARGE_CORRECTION";
  to: string;
  sentAt: string | null;
  createdAt: string;
  error: string | null;
  renterName: string;
  plate: string;
  carModel: string;
  rentalStatus: string;
  chargeId: string | null;
  weekNumber: number | null;
  amountCents: number | null;
  dueDate: string | null;
  /** The week's status now, not when the email went out. */
  chargeStatus: string | null;
  paidAt: string | null;
  problem: MailProblem | null;
  /** A please-ignore email may be sent: the week is no longer owed. */
  correctable: boolean;
  /** When a correction for this week went out, if one did. */
  correctionSentAt: string | null;
  reviewedAt: string | null;
  reviewedByName: string | null;
  reviewOutcome: string | null;
}

const PAYMENT_KINDS = ["CHARGE_REQUESTED", "CHARGE_REMINDER", "CHARGE_CORRECTION"] as const;
const NOT_OWED = ["PAID", "SETTLED", "VOID"];

function weekOf(dedupeKey: string): number | null {
  const match = /^week-(\d+)$/.exec(dedupeKey);
  return match ? Number(match[1]) : null;
}

export function mailProblem(
  mail: { sentAt: Date | null; error: string | null; kind: string },
  charge: { status: string; paidAt: Date | null } | null
): MailProblem | null {
  if (mail.kind === "CHARGE_CORRECTION") return null;
  if (!mail.sentAt) return mail.error ? "failed" : null;
  if (!charge) return null;
  if (charge.status === "SETTLED") return "settled";
  if (charge.status === "VOID") return "voided";
  if (charge.status === "PAID" && charge.paidAt && charge.paidAt.getTime() <= mail.sentAt.getTime()) return "paidBefore";
  return null;
}

export async function sentPaymentMails(
  client: PrismaClient,
  organisationId: string,
  now: Date
): Promise<SentPaymentMailRow[]> {
  const since = new Date(now.getTime() - SENT_MAIL_DAYS * 86_400_000);
  const mails = await client.notification.findMany({
    where: { organisationId, kind: { in: [...PAYMENT_KINDS] }, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    include: {
      rental: {
        select: {
          id: true,
          status: true,
          customer: { select: { firstName: true, lastName: true } },
          car: { select: { plate: true, model: true } },
          charges: { select: { id: true, weekNumber: true, amountCents: true, dueDate: true, status: true, paidAt: true } },
        },
      },
    },
  });

  const corrections = new Map<string, Date | null>();
  for (const m of mails) {
    if (m.kind === "CHARGE_CORRECTION") corrections.set(`${m.rentalId}:${m.dedupeKey}`, m.sentAt);
  }

  return mails.map((m) => {
    const week = weekOf(m.dedupeKey);
    const charge = week === null ? null : (m.rental.charges.find((c) => c.weekNumber === week) ?? null);
    const correction = corrections.get(`${m.rentalId}:${m.dedupeKey}`);
    return {
      notificationId: m.id,
      rentalId: m.rentalId,
      kind: m.kind as SentPaymentMailRow["kind"],
      to: m.to,
      sentAt: m.sentAt?.toISOString() ?? null,
      createdAt: m.createdAt.toISOString(),
      error: m.error,
      renterName: `${m.rental.customer.firstName} ${m.rental.customer.lastName}`.trim(),
      plate: m.rental.car.plate,
      carModel: m.rental.car.model,
      rentalStatus: m.rental.status,
      chargeId: charge?.id ?? null,
      weekNumber: week,
      amountCents: charge?.amountCents ?? null,
      dueDate: charge?.dueDate.toISOString() ?? null,
      chargeStatus: charge?.status ?? null,
      paidAt: charge?.paidAt?.toISOString() ?? null,
      problem: mailProblem(m, charge),
      correctable: m.kind !== "CHARGE_CORRECTION" && !!m.sentAt && !!charge && NOT_OWED.includes(charge.status),
      correctionSentAt: correction ? correction.toISOString() : null,
      reviewedAt: m.reviewedAt?.toISOString() ?? null,
      reviewedByName: m.reviewedByName,
      reviewOutcome: m.reviewOutcome,
    };
  });
}

export const mailReviewSchema = z.object({ action: z.enum(["correction", "dismiss"]) });

export type MailReviewResult =
  | { ok: true }
  | { ok: false; code: "not-found" | "conflict" | "bad-request" | "mail-failed" | "mail-not-configured" };

/**
 * The office's answer to one payment email. A correction is sent once per
 * week (the Notification key), and marks every payment email about that week
 * answered; "dismiss" marks just this one.
 */
export async function reviewPaymentMail(
  client: PrismaClient,
  deps: { organisationId: string; notificationId: string; action: "correction" | "dismiss"; actor: Actor; mail: LifecycleMailConfig | null; now: Date }
): Promise<MailReviewResult> {
  const { organisationId, notificationId, action, actor, mail, now } = deps;
  const original = await client.notification.findFirst({
    where: { id: notificationId, organisationId, kind: { in: ["CHARGE_REQUESTED", "CHARGE_REMINDER"] } },
    include: {
      rental: {
        include: {
          customer: true,
          car: true,
          charges: true,
          contracts: { where: { kind: "PICKUP" }, orderBy: { signedAt: "asc" }, take: 1, select: { gtcLanguage: true } },
        },
      },
    },
  });
  if (!original) return { ok: false, code: "not-found" };

  const reviewed = { reviewedAt: now, reviewedById: actor.id, reviewedByName: actor.displayName };

  if (action === "dismiss") {
    await client.notification.update({ where: { id: original.id }, data: { ...reviewed, reviewOutcome: "dismissed" } });
    return { ok: true };
  }

  const week = weekOf(original.dedupeKey);
  const charge = week === null ? null : original.rental.charges.find((c) => c.weekNumber === week);
  // Only for a week that is no longer owed, and only about an email that went out.
  if (!charge || !original.sentAt || !NOT_OWED.includes(charge.status)) return { ok: false, code: "conflict" };
  if (!mail) return { ok: false, code: "mail-not-configured" };

  const { rental } = original;
  const sent = await sendOnce(
    client,
    {
      organisationId,
      rentalId: rental.id,
      kind: "CHARGE_CORRECTION",
      dedupeKey: weekDedupeKey(charge.weekNumber),
      to: rental.customer.email,
    },
    now,
    async () => {
      const message = chargeCorrectionMail({
        firstName: rental.customer.firstName,
        carModel: rental.car.model,
        plate: rental.car.plate,
        weekNumber: charge.weekNumber,
        amountCents: charge.amountCents,
        sentAt: original.sentAt!,
        language: asRentalLanguage(rental.contracts[0]?.gtcLanguage),
      });
      await sendMail(mail, { to: rental.customer.email, replyTo: mail.office, ...message });
    }
  );

  if (!sent) {
    // Sent before (pressed twice, or a second office user), or it failed now.
    const existing = await client.notification.findUnique({
      where: { rentalId_kind_dedupeKey: { rentalId: rental.id, kind: "CHARGE_CORRECTION", dedupeKey: weekDedupeKey(charge.weekNumber) } },
      select: { sentAt: true },
    });
    if (!existing?.sentAt) return { ok: false, code: "mail-failed" };
  }

  await client.notification.updateMany({
    where: {
      rentalId: rental.id,
      kind: { in: ["CHARGE_REQUESTED", "CHARGE_REMINDER"] },
      dedupeKey: original.dedupeKey,
      reviewedAt: null,
    },
    data: { ...reviewed, reviewOutcome: "correction" },
  });
  await client.rentalEvent.create({
    data: {
      rentalId: rental.id,
      type: "charge.correction.sent",
      payload: { chargeId: charge.id, weekNumber: charge.weekNumber, actorId: actor.id, actorName: actor.displayName },
    },
  });
  return { ok: true };
}

export const waiveSchema = z.object({ note: z.string().trim().min(1).max(500) });

/**
 * "Erlassen": the office says an open week is not owed — a free week, a
 * goodwill gesture, a week the renter never had the car. It becomes VOID, so
 * nothing chases it, and the reason and who decided are on the timeline.
 */
export async function waiveCharge(
  client: PrismaClient,
  deps: { organisationId: string; chargeId: string; note: string; actor: Actor }
): Promise<{ ok: true } | { ok: false; code: "not-found" | "conflict" }> {
  const charge = await client.charge.findFirst({
    where: { id: deps.chargeId, organisationId: deps.organisationId },
    select: { id: true, rentalId: true, weekNumber: true, status: true },
  });
  if (!charge) return { ok: false, code: "not-found" };
  return client.$transaction(async (tx) => {
    const moved = await tx.charge.updateMany({
      where: { id: charge.id, status: { in: ["SCHEDULED", "REQUESTED", "REMINDED", "OVERDUE", "SETTLED"] } },
      data: { status: "VOID" },
    });
    if (moved.count === 0) return { ok: false, code: "conflict" } as const;
    await tx.rentalEvent.create({
      data: {
        rentalId: charge.rentalId,
        type: "charge.waived",
        payload: {
          chargeId: charge.id,
          weekNumber: charge.weekNumber,
          previous: charge.status,
          note: deps.note,
          actorId: deps.actor.id,
          actorName: deps.actor.displayName,
        },
      },
    });
    return { ok: true } as const;
  });
}
