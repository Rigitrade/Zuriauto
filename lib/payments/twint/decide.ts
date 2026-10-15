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
  | "REFERENCE_AMBIGUOUS";

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

export interface Evidence {
  amountCents: number;
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
}

export type Decision =
  | {
      status: "BOOKED";
      rentalId: string;
      chargeId: string;
      matchedBy: "reference+amount" | "holder+payer+amount";
      candidates: string[];
    }
  | { status: "NEEDS_REVIEW"; reason: PaymentReviewReason; rentalId: string | null; candidates: string[] };

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

  return { status: "BOOKED", rentalId, chargeId: charge.id, matchedBy: "holder+payer+amount", candidates: [rentalId] };
}
