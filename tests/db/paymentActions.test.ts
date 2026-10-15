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

  it("lets only one of two simultaneous bookings through, so one payment never pays two weeks", async () => {
    const { rental, payment, week3 } = await waitingPayment();
    const week4 = await prisma.charge.findFirstOrThrow({ where: { rentalId: rental.id, weekNumber: 4 } });

    const results = await Promise.all([
      applyPaymentAction(prisma, payment.id, { action: "book", rentalId: rental.id, chargeId: week3.id }, office),
      applyPaymentAction(prisma, payment.id, { action: "book", rentalId: rental.id, chargeId: week4.id }, office),
    ]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toEqual([{ ok: false, code: "conflict" }]);
    expect(await prisma.charge.count({ where: { id: { in: [week3.id, week4.id] }, status: "PAID" } })).toBe(1);
  });

  it("does not ignore a payment that a simultaneous booking already took", async () => {
    const { rental, payment, week3 } = await waitingPayment();

    await Promise.all([
      applyPaymentAction(prisma, payment.id, { action: "book", rentalId: rental.id, chargeId: week3.id }, office),
      applyPaymentAction(prisma, payment.id, { action: "ignore", note: "Test" }, office),
    ]);

    const after = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    const charge = await prisma.charge.findUniqueOrThrow({ where: { id: week3.id } });
    // Either the booking won (BOOKED, week paid) or the ignore did (IGNORED, week open) — never both.
    expect([after.status, charge.status]).toSatisfy(
      ([p, c]: string[]) => (p === "BOOKED" && c === "PAID") || (p === "IGNORED" && c !== "PAID")
    );
  });
});
