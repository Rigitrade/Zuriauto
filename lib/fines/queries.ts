/**
 * What the dashboard's fines section reads.
 */

import type { FineStatus, PrismaClient } from "@/generated/prisma/client";
import { loadIntervals } from "./repo/possessionLoad";

export type FineTab = "review" | "open" | "paid" | "all";

const TAB_STATUSES: Record<FineTab, FineStatus[] | null> = {
  review: ["NEEDS_REVIEW", "PROOF_SUBMITTED"],
  open: ["NOTIFIED"],
  paid: ["PAID"],
  all: null,
};

export function asTab(value: string | null): FineTab {
  return value === "open" || value === "paid" || value === "all" ? value : "review";
}

const DAY_MS = 24 * 60 * 60 * 1000;

export async function listFines(client: PrismaClient, tab: FineTab, now: Date) {
  const statuses = TAB_STATUSES[tab];
  const fines = await client.fine.findMany({
    where: statuses ? { status: { in: statuses } } : {},
    orderBy: [{ violationAt: "desc" }, { createdAt: "desc" }],
    take: 500,
    select: {
      id: true,
      status: true,
      reviewReason: true,
      violationAt: true,
      violationTimeKnown: true,
      amountCents: true,
      issuerName: true,
      issuerKind: true,
      fineNumber: true,
      dueDate: true,
      reminderLevel: true,
      handlingFeeStatus: true,
      createdAt: true,
      car: { select: { plate: true, model: true } },
      customer: { select: { firstName: true, lastName: true } },
    },
  });

  // Letters not yet attached to a fine: still being read, or failed.
  const documents =
    tab === "review" || tab === "all"
      ? await client.fineDocument.findMany({
          where: { status: { in: ["UPLOADED", "PROCESSING", "FAILED"] } },
          orderBy: { uploadedAt: "desc" },
          select: { id: true, status: true, attempts: true, error: true, uploadedAt: true, uploadedByName: true },
        })
      : [];

  // The figure that decides whether the AI fallback is worth paying for:
  // how many of the last month's letters went out with nobody looking.
  const created = await client.fineEvent.findMany({
    where: { type: "fine.created", createdAt: { gte: new Date(now.getTime() - 30 * DAY_MS) } },
    select: { payload: true },
  });
  const auto = created.filter(
    (event) => (event.payload as { reviewReason?: string | null } | null)?.reviewReason == null
  ).length;

  return {
    fines: fines.map(({ car, customer, ...fine }) => ({
      ...fine,
      plate: car?.plate ?? null,
      carModel: car?.model ?? null,
      renterName: customer ? `${customer.firstName} ${customer.lastName}` : null,
    })),
    documents,
    stats: { last30: created.length, auto },
  };
}

/** Rentals of the car whose possession touches the week either side. */
const CANDIDATE_WINDOW_MS = 7 * DAY_MS;

export async function fineDetail(client: PrismaClient, fineId: string) {
  const fine = await client.fine.findUnique({
    where: { id: fineId },
    include: {
      car: { select: { id: true, plate: true, model: true } },
      customer: { select: { firstName: true, lastName: true, email: true, phone: true } },
      documents: {
        orderBy: { uploadedAt: "asc" },
        select: {
          id: true, status: true, kind: true, language: true, reader: true, pages: true,
          uploadedAt: true, uploadedByName: true, extraction: true, error: true, attempts: true,
        },
      },
      proofs: {
        orderBy: { submittedAt: "asc" },
        select: { id: true, verdict: true, submittedAt: true, paidOn: true, contentType: true, accepted: true },
      },
      events: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!fine) return null;

  let candidates: {
    rentalId: string;
    from: Date;
    to: Date | null;
    renterName: string;
    email: string;
    phone: string;
  }[] = [];
  if (fine.carId && fine.violationAt) {
    const at = fine.violationAt.getTime();
    const near = (await loadIntervals(client, fine.carId)).filter(
      (i) =>
        i.from.getTime() <= at + CANDIDATE_WINDOW_MS &&
        (i.to === null || i.to.getTime() >= at - CANDIDATE_WINDOW_MS)
    );
    const customers = await client.customer.findMany({
      where: { id: { in: near.map((i) => i.customerId) } },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true },
    });
    candidates = near.map((i) => {
      const c = customers.find((customer) => customer.id === i.customerId)!;
      return {
        rentalId: i.rentalId,
        from: i.from,
        to: i.to,
        renterName: `${c.firstName} ${c.lastName}`,
        email: c.email,
        phone: c.phone,
      };
    });
  }

  return { fine, documents: fine.documents, proofs: fine.proofs, events: fine.events, candidates };
}

/**
 * What the bell counts: fines the system would not send, letters it could
 * not read after every attempt, proofs to check, and sent fines past their
 * deadline with no word from the renter.
 */
export async function fineAttentionCounts(client: PrismaClient, now: Date) {
  const today = new Date(`${new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich" }).format(now)}T00:00:00Z`);
  const [review, failedLetters, proof, overdue] = await Promise.all([
    client.fine.count({ where: { status: "NEEDS_REVIEW" } }),
    // 3 is MAX_ATTEMPTS in process.ts, not imported: that module pulls in the
    // reader, and the overview endpoint has no business loading Tesseract.
    client.fineDocument.count({ where: { status: "FAILED", attempts: { gte: 3 } } }),
    client.fine.count({ where: { status: "PROOF_SUBMITTED" } }),
    client.fine.count({ where: { status: "NOTIFIED", dueDate: { lt: today } } }),
  ]);
  return { review: review + failedLetters, proof, overdue };
}
