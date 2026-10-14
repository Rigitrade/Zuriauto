import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { applyPaymentAction } from "@/lib/payments/actions";
import { ingestMail } from "@/lib/payments/twint/ingest";
import { seedOrganisation, seedRental } from "./fineHelpers";
import { rawMail } from "./paymentHelpers";

const office = { id: "user-1", displayName: "Ahmed" };

async function waitingPayment() {
  const org = await seedOrganisation();
  const rental = await seedRental(org.id, { signedAt: new Date("2026-06-01T08:00:00Z") });
  await ingestMail(
    { client: prisma, organisationId: org.id, verify: async () => true },
    rawMail({ message: ["für Anna"], contact: ["friend@example.ch"] })
  );
  const payment = await prisma.payment.findFirstOrThrow();
  const week3 = await prisma.charge.findFirstOrThrow({ where: { rentalId: rental.id, weekNumber: 3 } });
  return { rental, payment, week3 };
}

describe("applyPaymentAction", () => {
  it("books a waiting payment to the week the office picks, and says who did it", async () => {
    const { rental, payment, week3 } = await waitingPayment();

    const result = await applyPaymentAction(prisma, payment.id, { action: "book", rentalId: rental.id, chargeId: week3.id }, office);

    expect(result).toEqual({ ok: true });
    expect(await prisma.charge.findUniqueOrThrow({ where: { id: week3.id } })).toMatchObject({ status: "PAID" });
    const booked = await prisma.paymentEvent.findFirstOrThrow({ where: { type: "payment.booked" } });
    expect(booked).toMatchObject({ actorId: "user-1", actorName: "Ahmed" });
  });

  it("credits the rental without a charge when the office says so", async () => {
    const { rental, payment } = await waitingPayment();

    await applyPaymentAction(prisma, payment.id, { action: "book", rentalId: rental.id, chargeId: null }, office);

    expect(await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).toMatchObject({
      status: "BOOKED",
      rentalId: rental.id,
      chargeId: null,
      matchedBy: "office",
    });
  });

  it("will not pay a week that is already paid", async () => {
    const { rental, payment, week3 } = await waitingPayment();
    await prisma.charge.update({ where: { id: week3.id }, data: { status: "PAID" } });

    expect(
      await applyPaymentAction(prisma, payment.id, { action: "book", rentalId: rental.id, chargeId: week3.id }, office)
    ).toEqual({ ok: false, code: "conflict" });
  });

  it("undoes a booking and puts the charge back as it was", async () => {
    const { rental, payment, week3 } = await waitingPayment();
    await applyPaymentAction(prisma, payment.id, { action: "book", rentalId: rental.id, chargeId: week3.id }, office);

    expect(await applyPaymentAction(prisma, payment.id, { action: "undo" }, office)).toEqual({ ok: true });

    expect(await prisma.charge.findUniqueOrThrow({ where: { id: week3.id } })).toMatchObject({ status: "SCHEDULED", paidAt: null });
    expect(await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).toMatchObject({ status: "NEEDS_REVIEW", chargeId: null });
  });

  it("ignores a payment only with a reason, and can bring it back", async () => {
    const { payment } = await waitingPayment();

    await applyPaymentAction(prisma, payment.id, { action: "ignore", note: "Test payment by Ahmed" }, office);
    expect(await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).toMatchObject({ status: "IGNORED" });

    await applyPaymentAction(prisma, payment.id, { action: "undo" }, office);
    expect(await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).toMatchObject({ status: "NEEDS_REVIEW" });
  });
});
