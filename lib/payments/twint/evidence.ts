/**
 * Everything decidePayment needs, from the database.
 *
 * The car comes from the fines plate search (our plates looked for in the
 * text, so "zh.513.925" is found and "ZH918747" is not invented); the holder
 * from the fines possession rule, at the payment's minute. Neither is copied.
 */

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { matchPlate } from "@/lib/fines/plates";
import { responsibleAt, type Interval, type Responsible } from "@/lib/fines/possession";
import { loadIntervals } from "@/lib/fines/repo/possessionLoad";
import { isOwedAfterReturn } from "@/lib/rental/passes";
import { normalisePhone } from "@/lib/rental/phone";
import { CLOSE_EVENTS, closedAtOf } from "../afterClose";
import { OPEN_CHARGE, type Evidence, type OpenCharge, type PayerRental, type Reference } from "./decide";
import type { TwintNotification } from "./parse";
import { printedPlate, weekOf } from "./signals";

type Client = PrismaClient | Prisma.TransactionClient;

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
  client: Client,
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

/**
 * The customers this payer is: by their own email or phone, or because the
 * office once confirmed this email or phone pays for them (a PayerAlias —
 * a friend, a partner, a second phone).
 */
async function payerCustomers(client: Client, organisationId: string, n: TwintNotification): Promise<string[]> {
  const email = n.payerEmail?.toLowerCase() ?? null;
  const phoneKey = n.payerPhone ? normalisePhone(n.payerPhone) : null;
  if (!email && !phoneKey) return [];
  // One after the other, not Promise.all: the dry run passes a transaction,
  // which runs one query at a time anyway.
  const own = await client.customer.findMany({
    where: { organisationId, OR: [...(email ? [{ email }] : []), ...(phoneKey ? [{ phoneKey }] : [])] },
    select: { id: true },
  });
  const aliases = await client.payerAlias.findMany({
    where: {
      organisationId,
      OR: [...(email ? [{ kind: "email", value: email }] : []), ...(phoneKey ? [{ kind: "phone", value: phoneKey }] : [])],
    },
    select: { customerId: true },
  });
  return [...new Set([...own.map((c) => c.id), ...aliases.map((a) => a.customerId)])];
}

/**
 * The payer's own rentals of the named car, whoever holds it now: what a
 * payment at the pickup or after the return is about (the ledger spec,
 * decision 5). Owed items follow isOwedAfterReturn, so a week that had not
 * begun at the close is owed only if the office kept it; week 0 always is.
 */
async function payerRentalsOf(
  client: Client,
  customerIds: string[],
  carId: string,
  holder: Responsible | null
): Promise<PayerRental[]> {
  const rentals = await client.rental.findMany({
    where: { customerId: { in: customerIds }, carId, status: { not: "CANCELLED" } },
    orderBy: { startAt: "desc" },
    select: {
      id: true,
      status: true,
      depositCents: true,
      contracts: { where: { kind: "PICKUP" }, orderBy: { signedAt: "asc" }, take: 1, select: { signedAt: true } },
      events: { where: { type: { in: CLOSE_EVENTS } }, select: { type: true, createdAt: true } },
      charges: {
        where: { status: { in: [...OPEN_CHARGE] } },
        orderBy: { dueDate: "asc" },
        select: { ...openChargeSelect, keptAfterReturn: true },
      },
      payments: { where: { status: "BOOKED" }, select: { depositCents: true } },
    },
  });
  return rentals.map((r) => {
    const closedAt = closedAtOf(r.events);
    const open = r.charges.map((c) => ({
      charge: { id: c.id, rentalId: c.rentalId, weekNumber: c.weekNumber, amountCents: c.amountCents, dueDate: c.dueDate },
      owed: isOwedAfterReturn(c, closedAt),
    }));
    return {
      rentalId: r.id,
      closed: r.status === "COMPLETED",
      isHolder: Boolean(holder?.ok && holder.rentalId === r.id),
      pickupAt: r.contracts[0]?.signedAt ?? null,
      depositCents: r.depositCents,
      depositReceivedCents: r.payments.reduce((sum, p) => sum + p.depositCents, 0),
      week1: open.find((o) => o.charge.weekNumber === 1)?.charge ?? null,
      owedOpen: open.filter((o) => o.owed).map((o) => o.charge),
    };
  });
}

export async function gatherEvidence(
  client: Client,
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
  const recentPayerRentals = payers.length
    ? await client.rental.findMany({
        where: { customerId: { in: payers }, status: { not: "CANCELLED" } },
        orderBy: { startAt: "desc" },
        take: 5,
        select: { id: true },
      })
    : [];
  // Only a plate of ours written in the text leads here; a look-alike the
  // fines matcher suggests is doubtful and stays with the office.
  const payerRentals =
    plate.carId && plate.status === "CONFIRMED" && payers.length
      ? await payerRentalsOf(client, payers, plate.carId, holder)
      : [];

  return {
    amountCents: n.amountCents,
    paidAt: n.paidAt,
    plate,
    reference,
    holder,
    holderOpenCharges,
    payerCustomerIds: payers,
    payerRentalIds: recentPayerRentals.map((r) => r.id),
    payerRentals,
  };
}
