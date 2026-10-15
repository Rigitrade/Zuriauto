import { describe, expect, it } from "vitest";
import { decidePayment, type Evidence, type OpenCharge } from "./decide";

const week = (n: number, overrides: Partial<OpenCharge> = {}): OpenCharge => ({
  id: `charge-w${n}`,
  rentalId: "rental-anna",
  weekNumber: n,
  amountCents: 45_000,
  dueDate: new Date(`2026-06-${String(n * 7).padStart(2, "0")}T00:00:00Z`),
  ...overrides,
});

const evidence = (overrides: Partial<Evidence> = {}): Evidence => ({
  amountCents: 45_000,
  plate: { carId: "car-prius", status: "CONFIRMED", reason: null },
  reference: { kind: "none" },
  holder: { ok: true, rentalId: "rental-anna", customerId: "anna" },
  holderOpenCharges: [week(2), week(3)],
  payerCustomerIds: ["anna"],
  payerRentalIds: ["rental-anna"],
  paidAt: new Date("2026-06-10T10:00:00Z"),
  payerRentals: [],
  ...overrides,
});

describe("decidePayment", () => {
  it("books the referenced week when the amount is that week's", () => {
    expect(decidePayment(evidence({ reference: { kind: "open", charge: week(3) } }))).toEqual({
      status: "BOOKED",
      rentalId: "rental-anna",
      chargeId: "charge-w3",
      matchedBy: "reference+amount",
      candidates: ["rental-anna"],
    });
  });

  it("does not book a referenced week for a different amount", () => {
    const d = decidePayment(evidence({ amountCents: 20_000, reference: { kind: "open", charge: week(3) } }));
    expect(d).toMatchObject({ status: "NEEDS_REVIEW", reason: "AMOUNT_MISMATCH", rentalId: "rental-anna" });
  });

  it("never pays another week when the referenced one is already paid", () => {
    const d = decidePayment(evidence({ reference: { kind: "paid", rentalId: "rental-anna" } }));
    expect(d).toMatchObject({ status: "NEEDS_REVIEW", reason: "CHARGE_ALREADY_PAID", rentalId: "rental-anna" });
  });

  it("waits when the named week exists on no rental of that car, rather than paying another week", () => {
    const d = decidePayment(evidence({ reference: { kind: "unknown" } }));
    expect(d).toMatchObject({ status: "NEEDS_REVIEW", reason: "REFERENCE_UNKNOWN" });
  });

  it("waits with every rental that owes the named week when it is not clearly the holder's", () => {
    const d = decidePayment(
      evidence({ reference: { kind: "unclear", reason: "REFERENCE_AMBIGUOUS", candidates: ["rental-a", "rental-b"] }, payerRentalIds: [] })
    );
    expect(d).toEqual({ status: "NEEDS_REVIEW", reason: "REFERENCE_AMBIGUOUS", rentalId: null, candidates: ["rental-a", "rental-b"] });
  });

  it("books the earliest open week of the holder when the payer is the holder", () => {
    expect(decidePayment(evidence())).toMatchObject({
      status: "BOOKED",
      chargeId: "charge-w2",
      matchedBy: "holder+payer+amount",
    });
  });

  it("waits when someone else paid for the holder", () => {
    const d = decidePayment(evidence({ payerCustomerIds: [] , payerRentalIds: [] }));
    expect(d).toEqual({ status: "NEEDS_REVIEW", reason: "PAYER_MISMATCH", rentalId: "rental-anna", candidates: ["rental-anna"] });
  });

  it("waits when the holder owes nothing of that amount", () => {
    expect(decidePayment(evidence({ amountCents: 12_345 }))).toMatchObject({ reason: "AMOUNT_MISMATCH" });
  });

  it("waits on a guessed plate even when everything else agrees", () => {
    const d = decidePayment(evidence({ plate: { carId: "car-prius", status: "DOUBTFUL", reason: null } }));
    expect(d).toMatchObject({ status: "NEEDS_REVIEW", reason: "PLATE_DOUBTFUL" });
  });

  it("passes the possession rule's reason and candidates through", () => {
    const d = decidePayment(
      evidence({ holder: { ok: false, reason: "HANDOVER_BOUNDARY", candidates: ["rental-a", "rental-b"] }, payerRentalIds: [] })
    );
    expect(d).toEqual({ status: "NEEDS_REVIEW", reason: "HANDOVER_BOUNDARY", rentalId: null, candidates: ["rental-a", "rental-b"] });
  });

  it("names a plate that is not ours, and offers the payer's rentals", () => {
    const d = decidePayment(
      evidence({ plate: { carId: null, status: "MISSING", reason: "PLATE_NOT_IN_FLEET" }, holder: null })
    );
    expect(d).toEqual({ status: "NEEDS_REVIEW", reason: "PLATE_NOT_IN_FLEET", rentalId: null, candidates: ["rental-anna"] });
  });

  it("asks when no plate was written at all", () => {
    const d = decidePayment(evidence({ plate: { carId: null, status: "MISSING", reason: null }, holder: null }));
    expect(d).toMatchObject({ status: "NEEDS_REVIEW", reason: "NO_PLATE" });
  });

  it("asks when the text names two of our cars", () => {
    const d = decidePayment(evidence({ plate: { carId: null, status: "DOUBTFUL", reason: "PLATE_AMBIGUOUS" }, holder: null }));
    expect(d).toMatchObject({ status: "NEEDS_REVIEW", reason: "PLATE_AMBIGUOUS" });
  });
});
