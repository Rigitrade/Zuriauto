import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { gatherEvidence } from "@/lib/payments/twint/evidence";
import { closeAt, seedOrganisation, seedRental } from "./fineHelpers";
import { notification } from "./paymentHelpers";

async function annaRental() {
  const org = await seedOrganisation();
  const rental = await seedRental(org.id, { signedAt: new Date("2026-06-01T08:00:00Z") });
  return { org, rental };
}

describe("gatherEvidence", () => {
  it("finds the week the text names, in the car's current rental", async () => {
    const { org, rental } = await annaRental();
    const e = await gatherEvidence(prisma, org.id, notification());

    expect(e.reference).toMatchObject({ kind: "open", charge: { rentalId: rental.id, weekNumber: 2, amountCents: 45_000 } });
  });

  it("reports a named week that is already paid", async () => {
    const { org, rental } = await annaRental();
    await prisma.charge.updateMany({ where: { rentalId: rental.id, weekNumber: 2 }, data: { status: "PAID" } });

    expect((await gatherEvidence(prisma, org.id, notification())).reference).toEqual({ kind: "paid", rentalId: rental.id });
  });

  it("finds the holder and recognises the payer by email", async () => {
    const { org, rental } = await annaRental();
    const e = await gatherEvidence(prisma, org.id, notification({ message: "ZH513925" }));

    expect(e.reference).toEqual({ kind: "none" });
    expect(e.holder).toEqual({ ok: true, rentalId: rental.id, customerId: rental.customerId });
    expect(e.payerCustomerIds).toEqual([rental.customerId]);
    expect(e.holderOpenCharges).toHaveLength(8);
  });

  it("recognises the payer by phone when the email differs", async () => {
    const { org, rental } = await annaRental();
    const e = await gatherEvidence(
      prisma,
      org.id,
      notification({ message: "zh.513.925", payerEmail: "anna.private@example.ch", payerPhone: "079 123 45 67" })
    );

    expect(e.plate).toMatchObject({ status: "CONFIRMED" });
    expect(e.payerCustomerIds).toEqual([rental.customerId]);
  });

  it("names a plate that is not ours", async () => {
    const { org } = await annaRental();
    const e = await gatherEvidence(prisma, org.id, notification({ message: "Auto vermieten\nZH918747" }));

    expect(e.plate).toEqual({ carId: null, status: "MISSING", reason: "PLATE_NOT_IN_FLEET" });
    expect(e.holder).toBeNull();
  });

  it("sends a payment made in the hour of a handover to the office", async () => {
    const { org, rental } = await annaRental();
    await closeAt(org.id, rental, new Date("2026-06-20T09:30:00Z"));
    const e = await gatherEvidence(prisma, org.id, notification({ message: "ZH 513 925", paidAt: new Date("2026-06-20T10:00:00Z") }));

    expect(e.holder).toMatchObject({ ok: false, reason: "HANDOVER_BOUNDARY" });
  });

  it("does not pay the next renter's week when the last renter pays theirs after the handover", async () => {
    const { org, rental: a } = await annaRental();
    await closeAt(org.id, a, new Date("2026-06-15T09:00:00Z"));
    const b = await seedRental(org.id, {
      signedAt: new Date("2026-06-16T08:00:00Z"),
      details: { email: "luca@example.ch", firstName: "Luca", lastName: "Brunner", mobile: "079 765 43 21" },
    });

    const e = await gatherEvidence(prisma, org.id, notification({ paidAt: new Date("2026-06-17T10:00:00Z") }));

    expect(e.reference).toMatchObject({ kind: "unclear", reason: "REFERENCE_AMBIGUOUS" });
    expect(e.reference.kind === "unclear" && [...e.reference.candidates].sort()).toEqual([a.id, b.id].sort());
  });

  it("knows a named week that no rental of the car has", async () => {
    const { org } = await annaRental();
    const e = await gatherEvidence(prisma, org.id, notification({ message: "ZH 513 925 W12" }));
    expect(e.reference).toEqual({ kind: "unknown" });
  });
});

describe("gatherEvidence — the payer's own rentals", () => {
  it("finds the payer's rental of the named car with its open weeks and deposit, though someone else has the car now", async () => {
    const org = await seedOrganisation();
    const anna = await seedRental(org.id, { signedAt: new Date("2026-06-01T08:00:00Z") });
    await closeAt(org.id, anna, new Date("2026-06-16T08:00:00Z"));
    const ben = await seedRental(org.id, {
      signedAt: new Date("2026-06-17T08:00:00Z"),
      details: { firstName: "Ben", lastName: "Keller", email: "ben@example.ch", mobile: "079 765 43 21" },
    });

    const e = await gatherEvidence(prisma, org.id, notification({ paidAt: new Date("2026-06-18T10:00:00Z") }));

    expect(e.holder).toMatchObject({ ok: true, rentalId: ben.id });
    expect(e.payerRentals).toEqual([
      expect.objectContaining({
        rentalId: anna.id,
        closed: true,
        isHolder: false,
        depositCents: 50_000,
        depositReceivedCents: 0,
        owedOpen: [
          expect.objectContaining({ weekNumber: 1 }),
          expect.objectContaining({ weekNumber: 2 }),
          expect.objectContaining({ weekNumber: 3 }),
        ],
      }),
    ]);
  });

  it("counts a remembered payer as the customer", async () => {
    const org = await seedOrganisation();
    const anna = await seedRental(org.id, { signedAt: new Date("2026-06-01T08:00:00Z") });
    await prisma.payerAlias.create({
      data: { organisationId: org.id, customerId: anna.customerId, kind: "email", value: "friend@example.ch" },
    });

    const e = await gatherEvidence(prisma, org.id, notification({ payerEmail: "friend@example.ch", payerPhone: null }));

    expect(e.payerCustomerIds).toEqual([anna.customerId]);
    expect(e.payerRentals.map((r) => r.rentalId)).toEqual([anna.id]);
  });

  it("owes a kept week after the close, and week 0, but not a week that had not begun", async () => {
    const org = await seedOrganisation();
    const anna = await seedRental(org.id, { signedAt: new Date("2026-06-01T08:00:00Z") });
    await closeAt(org.id, anna, new Date("2026-06-16T08:00:00Z"));
    await prisma.charge.updateMany({ where: { rentalId: anna.id, weekNumber: 4 }, data: { keptAfterReturn: true } });
    await prisma.charge.create({
      data: { organisationId: org.id, rentalId: anna.id, weekNumber: 0, dueDate: new Date("2026-06-20T00:00:00Z"), amountCents: 12_000 },
    });

    const e = await gatherEvidence(prisma, org.id, notification({ paidAt: new Date("2026-06-25T10:00:00Z") }));

    expect(e.payerRentals[0].owedOpen.map((c) => c.weekNumber).sort()).toEqual([0, 1, 2, 3, 4]);
  });
});
