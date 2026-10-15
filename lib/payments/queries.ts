/**
 * What the payments screen reads. Shapes are plain JSON for the client.
 */

import type { PrismaClient } from "@/generated/prisma/client";
import { purposeOf, type PaymentPurpose } from "./account";
import { OPEN_CHARGE } from "./twint/decide";

export type PaymentTab = "review" | "booked" | "all";

const STATUS_OF: Record<PaymentTab, ("BOOKED" | "NEEDS_REVIEW" | "IGNORED")[]> = {
  review: ["NEEDS_REVIEW"],
  booked: ["BOOKED"],
  all: ["NEEDS_REVIEW", "BOOKED", "IGNORED"],
};

export interface PaymentRow {
  id: string;
  status: string;
  reviewReason: string | null;
  paidAt: string;
  amountCents: number;
  payerName: string | null;
  message: string | null;
  plate: string | null;
  renterName: string | null;
  weekNumber: number | null;
  /** TWINT, or how the office recorded it: CASH, CARD, BANK. */
  method: string;
  /** The part that paid the deposit. */
  depositCents: number;
  /** What a booked payment paid ("Wofür"); null while it waits or was ignored. */
  purpose: PaymentPurpose | null;
}

const rowInclude = {
  rental: { select: { car: { select: { plate: true } }, customer: { select: { firstName: true, lastName: true } } } },
  charge: { select: { weekNumber: true } },
} as const;

export async function paymentList(client: PrismaClient, tab: PaymentTab): Promise<PaymentRow[]> {
  const payments = await client.payment.findMany({
    where: { status: { in: STATUS_OF[tab] } },
    orderBy: { paidAt: "desc" },
    take: 200,
    include: rowInclude,
  });
  return payments.map((p) => ({
    id: p.id,
    status: p.status,
    reviewReason: p.reviewReason,
    paidAt: p.paidAt.toISOString(),
    amountCents: p.amountCents,
    payerName: p.payerName,
    message: p.message,
    plate: p.rental?.car.plate ?? null,
    renterName: p.rental ? `${p.rental.customer.firstName} ${p.rental.customer.lastName}` : null,
    weekNumber: p.charge?.weekNumber ?? null,
    method: p.method,
    depositCents: p.depositCents,
    purpose: purposeOf(p, p.charge?.weekNumber ?? null),
  }));
}

/** What the Overview counts: payments to book, and TWINT emails nothing was booked from. */
export async function paymentReviewCount(client: PrismaClient): Promise<number> {
  const [payments, issues] = await Promise.all([
    client.payment.count({ where: { status: "NEEDS_REVIEW" } }),
    client.paymentMailIssue.count({ where: { resolvedAt: null } }),
  ]);
  return payments + issues;
}

export interface PaymentMailIssueRow {
  id: string;
  reason: string;
  detail: string | null;
  subject: string | null;
  receivedAt: string | null;
}

/** The TWINT emails the office has not marked done yet, newest first. */
export async function paymentMailIssues(client: PrismaClient): Promise<PaymentMailIssueRow[]> {
  const issues = await client.paymentMailIssue.findMany({
    where: { resolvedAt: null },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return issues.map((issue) => ({
    id: issue.id,
    reason: issue.reason,
    detail: issue.detail,
    subject: issue.subject,
    receivedAt: issue.receivedAt?.toISOString() ?? null,
  }));
}

export interface PaymentChoice {
  rentalId: string;
  renterName: string;
  plate: string;
  carModel: string;
  startAt: string;
  status: string;
  isCandidate: boolean;
  /** The deposit agreed, and what booked payments have carried of it. */
  depositCents: number;
  depositReceivedCents: number;
  openCharges: { id: string; weekNumber: number; amountCents: number; status: string; dueDate: string }[];
}

export interface PaymentDetailData extends PaymentRow {
  externalId: string;
  payerEmail: string | null;
  payerPhone: string | null;
  matchedBy: string | null;
  choices: PaymentChoice[];
  events: { type: string; actorName: string | null; createdAt: string; payload: unknown }[];
}

const RUNNING = ["ACTIVE", "EXTENSION_REQUESTED", "RETURN_SUBMITTED"] as const;
/** How many finished rentals the office can choose from, newest first. */
const RECENTLY_ENDED = 15;

export async function paymentDetail(client: PrismaClient, id: string): Promise<PaymentDetailData | null> {
  const p = await client.payment.findUnique({
    where: { id },
    include: { ...rowInclude, events: { orderBy: { createdAt: "asc" } } },
  });
  if (!p) return null;

  const pinned = [...p.candidates, ...(p.rentalId ? [p.rentalId] : [])];
  // The latest finished rentals too: a balance is often paid after the car is
  // back, from an account the system does not know, and then no rule names a
  // candidate — without these the office could only ignore the payment.
  const recentlyEnded = await client.rental.findMany({
    where: { organisationId: p.organisationId, status: "COMPLETED" },
    orderBy: { endAt: "desc" },
    take: RECENTLY_ENDED,
    select: { id: true },
  });
  const rentals = await client.rental.findMany({
    where: {
      organisationId: p.organisationId,
      OR: [
        { id: { in: [...pinned, ...recentlyEnded.map((r) => r.id)] } },
        { status: { in: [...RUNNING] } },
      ],
    },
    orderBy: { startAt: "desc" },
    include: {
      car: { select: { plate: true, model: true } },
      customer: { select: { firstName: true, lastName: true } },
      charges: { where: { status: { in: [...OPEN_CHARGE] } }, orderBy: { weekNumber: "asc" } },
      payments: { where: { status: "BOOKED" }, select: { depositCents: true } },
    },
  });
  const choices: PaymentChoice[] = rentals
    .map((r) => ({
      rentalId: r.id,
      renterName: `${r.customer.firstName} ${r.customer.lastName}`,
      plate: r.car.plate,
      carModel: r.car.model,
      startAt: r.startAt.toISOString(),
      status: r.status,
      isCandidate: pinned.includes(r.id),
      depositCents: r.depositCents,
      depositReceivedCents: r.payments.reduce((sum, payment) => sum + payment.depositCents, 0),
      openCharges: r.charges.map((c) => ({
        id: c.id,
        weekNumber: c.weekNumber,
        amountCents: c.amountCents,
        status: c.status,
        dueDate: c.dueDate.toISOString(),
      })),
    }))
    .sort((a, b) => Number(b.isCandidate) - Number(a.isCandidate));

  return {
    id: p.id,
    status: p.status,
    reviewReason: p.reviewReason,
    paidAt: p.paidAt.toISOString(),
    amountCents: p.amountCents,
    payerName: p.payerName,
    message: p.message,
    plate: p.rental?.car.plate ?? null,
    renterName: p.rental ? `${p.rental.customer.firstName} ${p.rental.customer.lastName}` : null,
    weekNumber: p.charge?.weekNumber ?? null,
    method: p.method,
    depositCents: p.depositCents,
    purpose: purposeOf(p, p.charge?.weekNumber ?? null),
    externalId: p.externalId,
    payerEmail: p.payerEmail,
    payerPhone: p.payerPhone,
    matchedBy: p.matchedBy,
    choices,
    events: p.events.map((e) => ({
      type: e.type,
      actorName: e.actorName,
      createdAt: e.createdAt.toISOString(),
      payload: e.payload,
    })),
  };
}
