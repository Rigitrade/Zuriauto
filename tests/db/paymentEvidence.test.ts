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
});
