/**
 * Everything decidePayment needs, from the database.
 *
 * The car comes from the fines plate search (our plates looked for in the
 * text, so "zh.513.925" is found and "ZH918747" is not invented); the holder
 * from the fines possession rule, at the payment's minute. Neither is copied.
 */

import type { PrismaClient } from "@/generated/prisma/client";
import { matchPlate } from "@/lib/fines/plates";
import { responsibleAt } from "@/lib/fines/possession";
import { loadIntervals } from "@/lib/fines/repo/possessionLoad";
import { normalisePhone } from "@/lib/rental/phone";
import { OPEN_CHARGE, type Evidence, type OpenCharge, type Reference } from "./decide";
import type { TwintNotification } from "./parse";
import { printedPlate, weekOf } from "./signals";

/** A week may be paid a little before the rental it belongs to starts. */
const PREPAY_MS = 7 * 24 * 60 * 60 * 1000;

const isOpen = (status: string) => (OPEN_CHARGE as readonly string[]).includes(status);

const openChargeSelect = { id: true, rentalId: true, weekNumber: true, amountCents: true, dueDate: true } as const;
const chargeSelect = { ...openChargeSelect, status: true } as const;

async function referenceOf(
  client: PrismaClient,
  carId: string,
  week: number,
  paidAt: Date
): Promise<Reference> {
  // The car's latest rental that had started by then — not an older rental
  // whose week N happens to be unpaid, which belongs to somebody else.
  const rental = await client.rental.findFirst({
    where: { carId, status: { not: "CANCELLED" }, startAt: { lte: new Date(paidAt.getTime() + PREPAY_MS) } },
    orderBy: { startAt: "desc" },
    select: { id: true, charges: { where: { weekNumber: week }, select: chargeSelect } },
  });
  const charge = rental?.charges[0];
  if (!rental || !charge) return { kind: "none" };
  return isOpen(charge.status) ? { kind: "open", charge } : { kind: "paid", rentalId: rental.id };
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

  const week = weekOf(message);
  const reference: Reference =
    plate.carId && plate.status === "CONFIRMED" && week
      ? await referenceOf(client, plate.carId, week, n.paidAt)
      : { kind: "none" };

  const holder = plate.carId
    ? responsibleAt(await loadIntervals(client, plate.carId), { kind: "instant", at: n.paidAt })
    : null;

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
