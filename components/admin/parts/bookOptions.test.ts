import { describe, expect, it } from "vitest";
import { labelsFor } from "@/lib/admin/labels";
import type { PaymentChoice } from "@/lib/payments/queries";
import { bookOptions, fitting } from "./bookOptions";

const P = labelsFor("de").payments;

const choice = (depositCents: number, week1Cents: number): PaymentChoice => ({
  rentalId: "r1",
  renterName: "Anna Meier",
  plate: "ZH 513 925",
  carModel: "Prius",
  startAt: "2026-09-20T10:33:00.000Z",
  status: "ACTIVE",
  isCandidate: true,
  depositCents,
  depositReceivedCents: 0,
  openCharges: [{ id: "w1", weekNumber: 1, amountCents: week1Cents, status: "SCHEDULED", dueDate: "2026-09-20T10:33:00.000Z" }],
});

describe("the book form's choices", () => {
  it("proposes deposit + week 1 when the amount is exactly both", () => {
    expect(fitting(bookOptions(choice(25_000, 25_000), P), 50_000)).toBe("depositWeek:w1");
  });

  it("proposes nothing when the amount fits the deposit and the week alike: the office chooses", () => {
    expect(fitting(bookOptions(choice(25_000, 25_000), P), 25_000)).toBe("");
  });

  it("proposes the one option that fits, and a credit when none does", () => {
    expect(fitting(bookOptions(choice(50_000, 25_000), P), 25_000)).toBe("week:w1");
    expect(fitting(bookOptions(choice(50_000, 25_000), P), 12_345)).toBe("credit");
  });
});
