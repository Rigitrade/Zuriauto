/**
 * A rental's account: the deposit, every week and what paid it, the balance
 * declared at the return, credits, and what is due, paid and open — the
 * "Mietkonto" (the ledger spec, decision 7). And across rentals, who owes
 * what ("Offene Beträge").
 *
 * Plain JSON for the client. One rule for "owed", the daily job's own
 * (isOwedAfterReturn): a week that had not begun when the rental closed is
 * owed only if the office kept it; the balance from the return form always is.
 */

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { RETURN_CLOSE_EVENT } from "@/lib/rental/closeRental";
import { isOwedAfterReturn } from "@/lib/rental/passes";
import { CLOSE_EVENTS, closedAtOf, pendingAfterClose } from "./afterClose";
import { OPEN_CHARGE } from "./twint/decide";

export type PaymentPurpose = "week" | "deposit" | "deposit+week" | "return-balance" | "credit";

/** What a booked payment paid; null for one that is not booked. */
export function purposeOf(
  payment: { status: string; chargeId: string | null; depositCents: number },
  weekNumber: number | null
): PaymentPurpose | null {
  if (payment.status !== "BOOKED") return null;
  if (payment.chargeId && weekNumber === 0) return "return-balance";
  if (payment.chargeId) return payment.depositCents > 0 ? "deposit+week" : "week";
  return payment.depositCents > 0 ? "deposit" : "credit";
}

export interface AccountItem {
  chargeId: string;
  /** 0 = the balance the renter declared on the return form. */
  weekNumber: number;
  dueDate: string;
  amountCents: number;
  status: string;
  /** Owed under isOwedAfterReturn at the close. */
  owed: boolean;
  /** Began after the close, and the office has not decided yet. */
  pendingAfterClose: boolean;
  paidBy: { paymentId: string; method: string; paidAt: string } | null;
}

export interface RentalAccount {
  rentalId: string;
  renterName: string;
  plate: string;
  carModel: string;
  status: string;
  startAt: string;
  endAt: string;
  closedAt: string | null;
  closedBy: "return" | "manual" | null;
  cutoverAt: string | null;
  deposit: {
    agreedCents: number;
    receivedCents: number;
    payments: { paymentId: string; method: string; paidAt: string; cents: number }[];
    back: boolean | null;
  };
  /** Weeks ascending, week 0 last. */
  items: AccountItem[];
  credits: { paymentId: string; method: string; paidAt: string; amountCents: number; note: string | null }[];
  declaration: {
    fullyPaid: boolean | null;
    paymentMethods: string[];
    paidAmountCents: number | null;
    hasDuePayment: boolean | null;
    dueAmountCents: number | null;
    dueDate: string | null;
    depositBack: boolean | null;
  } | null;
  totals: { dueToDateCents: number; paidCents: number; openCents: number };
}

export interface OwedRow {
  rentalId: string;
  renterName: string;
  plate: string;
  status: string;
  closed: boolean;
  owedCents: number;
  oldestDue: string | null;
  /** Running rentals started on or after the cut-over, 48 h after the pickup. */
  depositMissingCents: number;
  /** Closed rentals whose weeks after the close wait for the office. */
  pendingWeeks: number;
}

const RUNNING = ["ACTIVE", "EXTENSION_REQUESTED", "RETURN_SUBMITTED"];
const DEPOSIT_GRACE_MS = 48 * 3_600_000;

const accountInclude = {
  car: { select: { plate: true, model: true } },
  customer: { select: { firstName: true, lastName: true } },
  organisation: { select: { paymentsCutoverAt: true } },
  charges: { orderBy: { weekNumber: "asc" } },
  payments: {
    where: { status: "BOOKED" },
    orderBy: { paidAt: "asc" },
    select: { id: true, method: true, paidAt: true, amountCents: true, depositCents: true, chargeId: true, note: true },
  },
  events: { where: { type: { in: CLOSE_EVENTS } }, select: { type: true, createdAt: true } },
  contracts: {
    where: { kind: { in: ["PICKUP", "RETURN_ADDENDUM"] } },
    orderBy: { signedAt: "desc" },
    select: {
      kind: true,
      signedAt: true,
      fullyPaid: true,
      paymentMethods: true,
      paidAmountCents: true,
      hasDuePayment: true,
      dueAmountCents: true,
      dueDate: true,
      depositBack: true,
    },
  },
} satisfies Prisma.RentalInclude;

type AccountRow = Prisma.RentalGetPayload<{ include: typeof accountInclude }>;

const isOpen = (status: string) => (OPEN_CHARGE as readonly string[]).includes(status);

function accountOf(r: AccountRow, now: Date): RentalAccount {
  const closedAt = closedAtOf(r.events);
  const firstClose = [...r.events].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
  const pending = new Set(pendingAfterClose(r.charges, closedAt));
  const addendum = r.contracts.find((c) => c.kind === "RETURN_ADDENDUM") ?? null;
  const paidBy = new Map(r.payments.filter((p) => p.chargeId).map((p) => [p.chargeId!, p]));

  const items: AccountItem[] = [...r.charges]
    .sort((a, b) => (a.weekNumber === 0 ? 1 : 0) - (b.weekNumber === 0 ? 1 : 0) || a.weekNumber - b.weekNumber)
    .map((c) => {
      const payment = paidBy.get(c.id);
      return {
        chargeId: c.id,
        weekNumber: c.weekNumber,
        dueDate: c.dueDate.toISOString(),
        amountCents: c.amountCents,
        status: c.status,
        owed: isOwedAfterReturn(c, closedAt),
        pendingAfterClose: pending.has(c.id),
        paidBy: payment ? { paymentId: payment.id, method: payment.method, paidAt: payment.paidAt.toISOString() } : null,
      };
    });

  let dueToDateCents = 0;
  let paidCents = 0;
  for (const item of items) {
    if (!item.owed || item.status === "VOID" || new Date(item.dueDate).getTime() > now.getTime()) continue;
    dueToDateCents += item.amountCents;
    if (item.status === "PAID" || item.status === "SETTLED") paidCents += item.amountCents;
  }

  const depositPayments = r.payments.filter((p) => p.depositCents > 0);
  return {
    rentalId: r.id,
    renterName: `${r.customer.firstName} ${r.customer.lastName}`.trim(),
    plate: r.car.plate,
    carModel: r.car.model,
    status: r.status,
    startAt: r.startAt.toISOString(),
    endAt: r.endAt.toISOString(),
    closedAt: closedAt?.toISOString() ?? null,
    closedBy: firstClose ? (firstClose.type === RETURN_CLOSE_EVENT ? "return" : "manual") : null,
    cutoverAt: r.organisation.paymentsCutoverAt?.toISOString() ?? null,
    deposit: {
      agreedCents: r.depositCents,
      receivedCents: depositPayments.reduce((sum, p) => sum + p.depositCents, 0),
      payments: depositPayments.map((p) => ({ paymentId: p.id, method: p.method, paidAt: p.paidAt.toISOString(), cents: p.depositCents })),
      back: addendum?.depositBack ?? null,
    },
    items,
    credits: r.payments
      .filter((p) => !p.chargeId && p.depositCents === 0)
      .map((p) => ({ paymentId: p.id, method: p.method, paidAt: p.paidAt.toISOString(), amountCents: p.amountCents, note: p.note })),
    declaration: addendum
      ? {
          fullyPaid: addendum.fullyPaid,
          paymentMethods: addendum.paymentMethods,
          paidAmountCents: addendum.paidAmountCents,
          hasDuePayment: addendum.hasDuePayment,
          dueAmountCents: addendum.dueAmountCents,
          dueDate: addendum.dueDate?.toISOString() ?? null,
          depositBack: addendum.depositBack,
        }
      : null,
    totals: { dueToDateCents, paidCents, openCents: dueToDateCents - paidCents },
  };
}

export async function rentalAccount(client: PrismaClient, rentalId: string, now: Date): Promise<RentalAccount | null> {
  const r = await client.rental.findUnique({ where: { id: rentalId }, include: accountInclude });
  return r ? accountOf(r, now) : null;
}

/** Who owes what: returned renters first, then the oldest debt first. */
export async function openBalances(client: PrismaClient, organisationId: string, now: Date): Promise<OwedRow[]> {
  // Tens of rentals: one query, and the same computation as the account.
  const rentals = await client.rental.findMany({
    where: {
      organisationId,
      status: { not: "CANCELLED" },
      OR: [{ charges: { some: { status: { in: [...OPEN_CHARGE] } } } }, { depositCents: { gt: 0 } }],
    },
    include: accountInclude,
  });

  const rows: OwedRow[] = [];
  for (const r of rentals) {
    const account = accountOf(r, now);
    const owedOpen = account.items.filter(
      (i) => i.owed && isOpen(i.status) && new Date(i.dueDate).getTime() <= now.getTime()
    );
    const cutover = r.organisation.paymentsCutoverAt;
    const pickupAt = r.contracts.find((c) => c.kind === "PICKUP")?.signedAt ?? r.startAt;
    const depositMissingCents =
      RUNNING.includes(r.status) &&
      cutover !== null &&
      r.startAt.getTime() >= cutover.getTime() &&
      now.getTime() - pickupAt.getTime() >= DEPOSIT_GRACE_MS
        ? Math.max(0, account.deposit.agreedCents - account.deposit.receivedCents)
        : 0;
    const pendingWeeks = account.items.filter((i) => i.pendingAfterClose).length;
    const owedCents = owedOpen.reduce((sum, i) => sum + i.amountCents, 0);
    if (owedCents === 0 && depositMissingCents === 0 && pendingWeeks === 0) continue;

    rows.push({
      rentalId: r.id,
      renterName: account.renterName,
      plate: account.plate,
      status: r.status,
      closed: r.status === "COMPLETED",
      owedCents,
      oldestDue: owedOpen.map((i) => i.dueDate).sort()[0] ?? null,
      depositMissingCents,
      pendingWeeks,
    });
  }
  return rows.sort(
    (a, b) =>
      Number(b.closed) - Number(a.closed) ||
      (a.oldestDue ?? "9999").localeCompare(b.oldestDue ?? "9999")
  );
}
