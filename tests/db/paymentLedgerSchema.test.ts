import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { seedOrganisation, seedRental } from "./fineHelpers";

describe("the ledger schema", () => {
  it("stores an office payment with its method, deposit share and note", async () => {
    const org = await seedOrganisation();
    const rental = await seedRental(org.id, { signedAt: new Date("2026-06-01T08:00:00Z") });

    const payment = await prisma.payment.create({
      data: {
        organisationId: org.id,
        externalId: "office:test-1",
        amountCents: 95_000,
        paidAt: new Date("2026-06-01T10:00:00Z"),
        method: "CASH",
        depositCents: 50_000,
        note: "Bar bei Übergabe",
        status: "BOOKED",
        rentalId: rental.id,
      },
    });

    expect(payment).toMatchObject({ method: "CASH", depositCents: 50_000, note: "Bar bei Übergabe" });
    expect(
      await prisma.payment.create({
        data: { organisationId: org.id, externalId: "twint-1", amountCents: 1, paidAt: new Date(), status: "NEEDS_REVIEW" },
      })
    ).toMatchObject({ method: "TWINT", depositCents: 0, note: null });
  });

  it("lets a week be settled at the cut-over and kept after a return", async () => {
    const org = await seedOrganisation();
    const rental = await seedRental(org.id, { signedAt: new Date("2026-06-01T08:00:00Z") });
    const week1 = await prisma.charge.findFirstOrThrow({ where: { rentalId: rental.id, weekNumber: 1 } });

    expect(await prisma.charge.update({ where: { id: week1.id }, data: { status: "SETTLED", keptAfterReturn: true } }))
      .toMatchObject({ status: "SETTLED", keptAfterReturn: true });
    expect(
      await prisma.organisation.update({ where: { id: org.id }, data: { paymentsCutoverAt: new Date("2026-10-20T00:00:00Z") } })
    ).toMatchObject({ paymentsCutoverAt: new Date("2026-10-20T00:00:00Z") });
  });

  it("remembers a payer once per customer", async () => {
    const org = await seedOrganisation();
    const rental = await seedRental(org.id, { signedAt: new Date("2026-06-01T08:00:00Z") });
    const alias = { organisationId: org.id, customerId: rental.customerId, kind: "phone", value: "+41791112233" };

    await prisma.payerAlias.create({ data: alias });

    await expect(prisma.payerAlias.create({ data: alias })).rejects.toMatchObject({ code: "P2002" });
  });

  it("knows the two new reasons a payment waits", async () => {
    const org = await seedOrganisation();
    for (const reviewReason of ["PICKUP_PAYMENT", "PAID_AFTER_RETURN"] as const) {
      await prisma.payment.create({
        data: { organisationId: org.id, externalId: reviewReason, amountCents: 1, paidAt: new Date(), status: "NEEDS_REVIEW", reviewReason },
      });
    }
    expect(await prisma.payment.count({ where: { reviewReason: { in: ["PICKUP_PAYMENT", "PAID_AFTER_RETURN"] } } })).toBe(2);
  });
});
