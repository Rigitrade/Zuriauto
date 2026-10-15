/**
 * Everything decidePayment needs, from the database.
 *
 * The car comes from the fines plate search (our plates looked for in the
 * text, so "zh.513.925" is found and "ZH918747" is not invented); the holder
 * from the fines possession rule, at the payment's minute. Neither is copied.
 */

import type { PrismaClient } from "@/generated/prisma/client";
import { matchPlate } from "@/lib/fines/plates";
import { responsibleAt, type Interval, type Responsible } from "@/lib/fines/possession";
import { loadIntervals } from "@/lib/fines/repo/possessionLoad";
import { normalisePhone } from "@/lib/rental/phone";
import { OPEN_CHARGE, type Evidence, type OpenCharge, type Reference } from "./decide";
import type { TwintNotification } from "./parse";
import { printedPlate, weekOf } from "./signals";

const isOpen = (status: string) => (OPEN_CHARGE as readonly string[]).includes(status);

const openChargeSelect = { id: true, rentalId: true, weekNumber: true, amountCents: true, dueDate: true } as const;
const chargeSelect = { ...openChargeSelect, status: true } as const;

/**
 * The rental answerable for a payment at its moment: whoever held the car,
 * or — when nobody did — the last renter, provided nobody has had the car
 * since. Null when that is not clear (a handover, an overlap, a renter whose
 * pickup is still to come).
 */
function accountableRental(intervals: Interval[], holder: Responsible, paidAt: Date): string | null {
  if (holder.ok) return holder.rentalId;
  if (holder.reason !== "NO_RENTAL_AT_TIME") return null;
  const ended = intervals.filter((i) => i.to !== null && i.to <= paidAt);
  const last = ended.sort((a, b) => b.to!.getTime() - a.to!.getTime())[0];
  if (!last) return null;
  const someoneSince = intervals.some((i) => i !== last && i.from >= last.to!);
  return someoneSince ? null : last.rentalId;
}

/**
 * What a named week means. Looked for across every rental of the car, not
 * only the latest: renter A paying "W2" the day after renter B picked the
 * car up owes A's week 2, and B has a week 2 too. Booked only when exactly
 * one rental owes that week and it is the accountable one; otherwise the
 * office chooses among the rentals that owe it.
 */
async function referenceOf(
  client: PrismaClient,
  carId: string,
  week: number,
  intervals: Interval[],
  holder: Responsible,
  paidAt: Date
): Promise<Reference> {
  const charges = await client.charge.findMany({
    where: { weekNumber: week, rental: { carId, status: { not: "CANCELLED" } } },
    select: chargeSelect,
  });
  if (charges.length === 0) return { kind: "unknown" };

  const accountable = accountableRental(intervals, holder, paidAt);
  const open = charges.filter((charge) => isOpen(charge.status));
  if (open.length === 0) {
    return { kind: "paid", rentalId: accountable ?? charges[0].rentalId };
  }
  if (open.length === 1 && open[0].rentalId === accountable) {
    const { id, rentalId, weekNumber, amountCents, dueDate } = open[0];
    return { kind: "open", charge: { id, rentalId, weekNumber, amountCents, dueDate } };
  }
  return {
    kind: "unclear",
    reason: holder.ok || holder.reason === "NO_RENTAL_AT_TIME" ? "REFERENCE_AMBIGUOUS" : holder.reason,
    candidates: [...new Set([...open.map((charge) => charge.rentalId), ...(holder.ok ? [] : holder.candidates)])],
  };
}

async function payerCustomers(client: PrismaClient, organisationId: string, n: TwintNotification) {
  const phoneKey = n.payerPhone ? normalisePhone(n.payerPhone) : null;
  const or = [
    ...(n.payerEmail ? [{ email: n.payerEmail.toLowerCase() }] : []),
    ...(phoneKey ? [{ phoneKey }] : []),
  ];
  if (or.length === 0) return [];
  return client.customer.findMany({ where: { organisationId, OR: or }, select: { id: true } });
}

export async function gatherEvidence(
  client: PrismaClient,
  organisationId: string,
  n: TwintNotification
): Promise<Evidence> {
  const message = n.message ?? "";
  // Every car, retired ones included: the payment may be for a past rental.
  const fleet = await client.car.findMany({ where: { organisationId }, select: { id: true, plate: true } });
  const found = matchPlate(message, printedPlate(message), fleet);
  const plate: Evidence["plate"] = {
    carId: found.carId,
    status: found.status === "READ" ? "DOUBTFUL" : found.status,
    reason: found.reason,
  };

  const intervals = plate.carId ? await loadIntervals(client, plate.carId) : [];
  const holder = plate.carId ? responsibleAt(intervals, { kind: "instant", at: n.paidAt }) : null;

  const week = weekOf(message);
  const reference: Reference =
    plate.carId && holder && plate.status === "CONFIRMED" && week
      ? await referenceOf(client, plate.carId, week, intervals, holder, n.paidAt)
      : { kind: "none" };

  const holderOpenCharges: OpenCharge[] = holder?.ok
    ? await client.charge.findMany({
        where: { rentalId: holder.rentalId, status: { in: [...OPEN_CHARGE] } },
        orderBy: { dueDate: "asc" },
        select: openChargeSelect,
      })
    : [];

  const payers = await payerCustomers(client, organisationId, n);
  const payerRentals = payers.length
    ? await client.rental.findMany({
        where: { customerId: { in: payers.map((p) => p.id) }, status: { not: "CANCELLED" } },
        orderBy: { startAt: "desc" },
        take: 5,
        select: { id: true },
      })
    : [];

  return {
    amountCents: n.amountCents,
    plate,
    reference,
    holder,
    holderOpenCharges,
    payerCustomerIds: payers.map((p) => p.id),
    payerRentalIds: payerRentals.map((r) => r.id),
  };
}
