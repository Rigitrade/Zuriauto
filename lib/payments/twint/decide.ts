/**
 * From what we know about a payment to "book it" or "ask the office".
 *
 * Booked only when two independent things agree (the spec, decision 4):
 *
 *   reference + amount         the text names a car and a week, and the
 *                              amount is exactly that week's;
 *   holder + payer + amount    whoever had the named car at that moment is
 *                              the customer whose email or phone paid, and
 *                              owes exactly this amount.
 *
 * Everything else waits, with the reason and the rentals to choose from.
 * Pure: the database work is in evidence.ts, so every rule is a table test.
 */

import type { Responsible } from "@/lib/fines/possession";

export const OPEN_CHARGE = ["SCHEDULED", "REQUESTED", "REMINDED", "OVERDUE"] as const;

export interface OpenCharge {
  id: string;
  rentalId: string;
  weekNumber: number;
  amountCents: number;
  dueDate: Date;
}

export type PaymentReviewReason =
  | "NO_PLATE"
  | "PLATE_NOT_IN_FLEET"
  | "PLATE_AMBIGUOUS"
  | "PLATE_DOUBTFUL"
  | "NO_RENTAL_AT_TIME"
  | "HANDOVER_BOUNDARY"
  | "OVERLAPPING_RENTALS"
  | "PAYER_MISMATCH"
  | "AMOUNT_MISMATCH"
  | "CHARGE_ALREADY_PAID"
  | "REFERENCE_UNKNOWN"
  | "REFERENCE_AMBIGUOUS"
  | "PICKUP_PAYMENT"
  | "PAID_AFTER_RETURN";

/**
 * What the text's plate + week point at.
 *
 *   open     the week is owed by exactly one rental, and that rental is the
 *            one accountable at the payment's moment (the holder, or the last
 *            renter when nobody holds the car and nobody has since);
 *   paid     the week exists and nobody owes it any more;
 *   unknown  no rental of the car has that week;
 *   unclear  the week is owed, but not clearly by the accountable rental —
 *            a renter paying after the next one picked the car up.
 *   none     the text names no week (or no car of ours).
 */
export type Reference =
  | { kind: "open"; charge: OpenCharge }
  | { kind: "paid"; rentalId: string }
  | { kind: "unknown" }
  | { kind: "unclear"; reason: PaymentReviewReason; candidates: string[] }
  | { kind: "none" };

/** One of the payer's own rentals of the named car (evidence.ts, payerRentalsOf). */
export interface PayerRental {
  rentalId: string;
  /** COMPLETED: the payment came after the rental closed. */
  closed: boolean;
  /** Held the car at the payment's minute (the fines possession rule). */
  isHolder: boolean;
  /** The pickup contract's signature, null for a rental without one. */
  pickupAt: Date | null;
  depositCents: number;
  depositReceivedCents: number;
  /** Week 1, if it is still open. */
  week1: OpenCharge | null;
  /** Open items still owed: weeks under isOwedAfterReturn, plus week 0. */
  owedOpen: OpenCharge[];
}

export interface Evidence {
  amountCents: number;
  /** TWINT's moment of payment. */
  paidAt: Date;
  plate: {
    carId: string | null;
    status: "CONFIRMED" | "DOUBTFUL" | "MISSING";
    reason: "PLATE_AMBIGUOUS" | "PLATE_NOT_IN_FLEET" | null;
  };
  reference: Reference;
  /** Null when no car was found to ask about. */
  holder: Responsible | null;
  /** The holder rental's open charges; empty without a holder. */
  holderOpenCharges: OpenCharge[];
  /** Customers whose email or phone is the payer's. */
  payerCustomerIds: string[];
  /** Those customers' recent rentals, offered to the office. */
  payerRentalIds: string[];
  /** Those customers' rentals of the named car; empty without a confirmed plate. */
  payerRentals: PayerRental[];
}

export type Decision =
  | {
      status: "BOOKED";
      rentalId: string;
      /** The week it pays, or null for the deposit alone. */
      chargeId: string | null;
      /** The part of the amount that is the deposit; 0 for a week alone. */
      depositCents: number;
      matchedBy: "reference+amount" | "holder+payer+amount" | "payer+plate+amount" | "payer+plate+deposit";
      candidates: string[];
    }
  | { status: "NEEDS_REVIEW"; reason: PaymentReviewReason; rentalId: string | null; candidates: string[] };

/** "At the pickup": from a day before the signed pickup to two days after (the ledger spec, decision 5). */
export const PICKUP_WINDOW = { beforeMs: 24 * 3_600_000, afterMs: 48 * 3_600_000 } as const;

const byDue = (a: OpenCharge, b: OpenCharge) => a.dueDate.getTime() - b.dueDate.getTime();

function atPickup(r: PayerRental, paidAt: Date): boolean {
  if (!r.pickupAt || r.depositReceivedCents >= r.depositCents) return false;
  const offset = paidAt.getTime() - r.pickupAt.getTime();
  return offset >= -PICKUP_WINDOW.beforeMs && offset <= PICKUP_WINDOW.afterMs;
}

type Review = (reason: PaymentReviewReason, rentalId: string | null, candidates: string[]) => Decision;

/**
 * The payer is one of our customers and the plate is a car they rented: the
 * payment is about their rental of it, whoever holds the car now. Two signals
 * still — who paid, and what car they named — and the amount must fit exactly.
 * Null when the rule does not apply, and the older rules decide.
 */
function payerLed(e: Evidence, review: Review): Decision | null {
  if (e.plate.status !== "CONFIRMED" || e.payerRentals.length === 0) return null;
  const amount = e.amountCents;

  const starting = e.payerRentals.filter((r) => atPickup(r, e.paidAt));
  if (starting.length > 1) return review("PICKUP_PAYMENT", null, starting.map((r) => r.rentalId));
  if (starting.length === 1) {
    const r = starting[0];
    const deposit = r.depositCents - r.depositReceivedCents;
    const week1 = r.week1;
    const book = (chargeId: string | null, depositCents: number): Decision => ({
      status: "BOOKED",
      rentalId: r.rentalId,
      chargeId,
      depositCents,
      matchedBy: depositCents > 0 ? "payer+plate+deposit" : r.isHolder ? "holder+payer+amount" : "payer+plate+amount",
      candidates: [r.rentalId],
    });
    // 250 when both the deposit and week 1 cost 250: which one is a guess.
    if (week1 && week1.amountCents === deposit && amount === deposit) return review("PICKUP_PAYMENT", r.rentalId, [r.rentalId]);
    if (amount === deposit) return book(null, deposit);
    if (week1 && amount === deposit + week1.amountCents) return book(week1.id, deposit);
    if (week1 && amount === week1.amountCents) return book(week1.id, 0);
    return review("PICKUP_PAYMENT", r.rentalId, [r.rentalId]);
  }

  const matching = e.payerRentals
    .map((r) => ({ r, charge: r.owedOpen.filter((c) => c.amountCents === amount).sort(byDue)[0] }))
    .filter((m): m is { r: PayerRental; charge: OpenCharge } => Boolean(m.charge));
  if (matching.length > 1) return review("REFERENCE_AMBIGUOUS", null, matching.map((m) => m.r.rentalId));
  if (matching.length === 1) {
    const { r, charge } = matching[0];
    return {
      status: "BOOKED",
      rentalId: r.rentalId,
      chargeId: charge.id,
      depositCents: 0,
      matchedBy: r.isHolder ? "holder+payer+amount" : "payer+plate+amount",
      candidates: [r.rentalId],
    };
  }
  // Nothing of theirs has this amount. They may be paying for whoever has the
  // car now — a friend — so that rental is offered beside their own.
  const proposed = e.payerRentals.find((r) => r.isHolder) ?? e.payerRentals[0];
  const holderRental = e.holder?.ok ? [e.holder.rentalId] : [];
  return review(proposed.closed ? "PAID_AFTER_RETURN" : "AMOUNT_MISMATCH", proposed.rentalId, [proposed.rentalId, ...holderRental]);
}

export function decidePayment(e: Evidence): Decision {
  const review = (reason: PaymentReviewReason, rentalId: string | null, candidates: string[]): Decision => ({
    status: "NEEDS_REVIEW",
    reason,
    rentalId,
    candidates: [...new Set([...candidates, ...e.payerRentalIds])],
  });

  if (e.reference.kind === "open") {
    const charge = e.reference.charge;
    if (charge.amountCents !== e.amountCents) return review("AMOUNT_MISMATCH", charge.rentalId, [charge.rentalId]);
    return {
      status: "BOOKED",
      rentalId: charge.rentalId,
      chargeId: charge.id,
      depositCents: 0,
      matchedBy: "reference+amount",
      candidates: [charge.rentalId],
    };
  }
  if (e.reference.kind === "paid") {
    return review("CHARGE_ALREADY_PAID", e.reference.rentalId, [e.reference.rentalId]);
  }
  // The customer named a week: never fall through and pay a different one.
  if (e.reference.kind === "unknown") return review("REFERENCE_UNKNOWN", null, []);
  if (e.reference.kind === "unclear") return review(e.reference.reason, null, e.reference.candidates);

  const led = payerLed(e, review);
  if (led) return led;

  if (!e.plate.carId || !e.holder) {
    return review(e.plate.reason ?? "NO_PLATE", null, []);
  }
  if (!e.holder.ok) return review(e.holder.reason, null, e.holder.candidates);

  const { rentalId, customerId } = e.holder;
  if (e.plate.status !== "CONFIRMED") return review("PLATE_DOUBTFUL", rentalId, [rentalId]);
  if (!e.payerCustomerIds.includes(customerId)) return review("PAYER_MISMATCH", rentalId, [rentalId]);

  const charge = e.holderOpenCharges
    .filter((c) => c.rentalId === rentalId && c.amountCents === e.amountCents)
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0];
  if (!charge) return review("AMOUNT_MISMATCH", rentalId, [rentalId]);

  return {
    status: "BOOKED",
    rentalId,
    chargeId: charge.id,
    depositCents: 0,
    matchedBy: "holder+payer+amount",
    candidates: [rentalId],
  };
}
