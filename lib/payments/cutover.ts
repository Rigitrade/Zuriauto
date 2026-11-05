/**
 * The cut-over: weeks due before the payments feature went live count as
 * settled.
 *
 * Data, not a rule computed on read, because the daily job reads
 * Charge.status: weeklyChargePass requests every SCHEDULED week whose due day
 * has come, so a computed rule would leave it asking renters for weeks they
 * paid in cash months ago (the ledger spec, decision 1). Paid and void weeks
 * are not touched; a second run finds nothing left to settle. The office can
 * reopen a week, and every change names who made it. Balances declared on a
 * return form (week 0) are left open.
 */

import type { PrismaClient } from "@/generated/prisma/client";
import type { Actor } from "@/lib/fines/events";
import { OPEN_CHARGE } from "./twint/decide";

export interface CutoverCharge {
  id: string;
  rentalId: string;
  weekNumber: number;
  dueDate: Date;
  amountCents: number;
  status: string;
}

/**
 * The cut-over has run already. A second one with a later date would settle
 * weeks that fell due — and were requested — since the first, so it is
 * refused unless asked for explicitly.
 */
export class CutoverAlreadyApplied extends Error {
  constructor(readonly at: Date) {
    super(`the cut-over was already applied, for weeks due before ${at.toISOString()}`);
  }
}

const select = { id: true, rentalId: true, weekNumber: true, dueDate: true, amountCents: true, status: true } as const;

// Weeks only. Week 0 is the balance the renter declared still owed on the
// return form: a late payment still to come, not a week paid in cash before
// the system, so it stays open (the owner, 15.10.2026).
const dueBefore = (organisationId: string, before: Date) => ({
  organisationId,
  weekNumber: { gt: 0 },
  status: { in: [...OPEN_CHARGE] },
  dueDate: { lt: before },
});

/** What applyCutover would settle, for the dry run. */
export async function planCutover(client: PrismaClient, organisationId: string, before: Date): Promise<CutoverCharge[]> {
  return client.charge.findMany({
    where: dueBefore(organisationId, before),
    orderBy: [{ rentalId: "asc" }, { weekNumber: "asc" }],
    select,
  });
}

export async function applyCutover(
  client: PrismaClient,
  organisationId: string,
  before: Date,
  options: { force?: boolean } = {}
): Promise<{ settled: number }> {
  return client.$transaction(
    async (tx) => {
      const organisation = await tx.organisation.findUniqueOrThrow({
        where: { id: organisationId },
        select: { paymentsCutoverAt: true },
      });
      if (organisation.paymentsCutoverAt && !options.force) throw new CutoverAlreadyApplied(organisation.paymentsCutoverAt);
      const planned = await tx.charge.findMany({
        where: dueBefore(organisationId, before),
        orderBy: [{ rentalId: "asc" }, { weekNumber: "asc" }],
        select,
      });
      const byRental = new Map<string, { id: string; weekNumber: number; previous: string }[]>();
      for (const charge of planned) {
        // Conditional on the status read: a payment booking the week in the
        // same moment wins, and the cut-over leaves it alone.
        const moved = await tx.charge.updateMany({
          where: { id: charge.id, status: charge.status },
          data: { status: "SETTLED" },
        });
        if (moved.count === 0) continue;
        const list = byRental.get(charge.rentalId) ?? [];
        list.push({ id: charge.id, weekNumber: charge.weekNumber, previous: charge.status });
        byRental.set(charge.rentalId, list);
      }
      for (const [rentalId, charges] of byRental) {
        await tx.rentalEvent.create({
          data: { rentalId, type: "charges.settled.cutover", payload: { before: before.toISOString(), charges } },
        });
      }
      await tx.organisation.update({ where: { id: organisationId }, data: { paymentsCutoverAt: before } });
      return { settled: [...byRental.values()].reduce((sum, list) => sum + list.length, 0) };
    },
    // One update per week against a remote database: Prisma's 5 s default is short.
    { maxWait: 20_000, timeout: 120_000 }
  );
}

export async function reopenCharge(
  client: PrismaClient,
  chargeId: string,
  actor: Actor
): Promise<{ ok: true } | { ok: false; code: "conflict" | "not-found" }> {
  const charge = await client.charge.findUnique({
    where: { id: chargeId },
    select: { rentalId: true, weekNumber: true },
  });
  if (!charge) return { ok: false, code: "not-found" };
  return client.$transaction(async (tx) => {
    const moved = await tx.charge.updateMany({ where: { id: chargeId, status: "SETTLED" }, data: { status: "SCHEDULED" } });
    if (moved.count === 0) return { ok: false, code: "conflict" } as const;
    await tx.rentalEvent.create({
      data: {
        rentalId: charge.rentalId,
        type: "charge.reopened",
        payload: { chargeId, weekNumber: charge.weekNumber, actorId: actor.id, actorName: actor.displayName },
      },
    });
    return { ok: true } as const;
  });
}
