import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { ingestMail } from "@/lib/payments/twint/ingest";
import { paymentDetail, paymentList, paymentMailIssues, paymentReviewCount } from "@/lib/payments/queries";
import { applyPaymentAction, resolveMailIssue } from "@/lib/payments/actions";
import { closeAt, seedOrganisation, seedRental } from "./fineHelpers";
import { rawMail } from "./paymentHelpers";

async function onePaidOneWaiting() {
  const org = await seedOrganisation();
  const rental = await seedRental(org.id, { signedAt: new Date("2026-06-01T08:00:00Z") });
  const deps = { client: prisma, organisationId: org.id, verify: async () => true };
  await ingestMail(deps, rawMail({}, 1));
  await ingestMail(deps, rawMail({ transaction: "aaaaaaaa-0000-0000-0000-000000000002", message: ["Danke"] }, 2));
  return { rental };
}

describe("payment queries", () => {
  it("lists what waits on the review tab, and counts it for the Overview", async () => {
    await onePaidOneWaiting();

    const review = await paymentList(prisma, "review");
    expect(review).toHaveLength(1);
    expect(review[0]).toMatchObject({ status: "NEEDS_REVIEW", reviewReason: "NO_PLATE", message: "Danke" });
    expect(await paymentReviewCount(prisma)).toBe(1);
    expect(await paymentList(prisma, "all")).toHaveLength(2);
  });

  it("shows a booked payment with its renter, car and week", async () => {
    await onePaidOneWaiting();

    const [booked] = await paymentList(prisma, "booked");
    expect(booked).toMatchObject({ renterName: "Anna Meier", plate: "ZH 513 925", weekNumber: 2 });
  });

  it("offers the open rentals and their open weeks as choices", async () => {
    const { rental } = await onePaidOneWaiting();
    const waiting = await prisma.payment.findFirstOrThrow({ where: { status: "NEEDS_REVIEW" } });

    const detail = await paymentDetail(prisma, waiting.id);
    const choice = detail?.choices.find((c) => c.rentalId === rental.id);
    expect(choice?.openCharges.map((c) => c.weekNumber)).toEqual([1, 3, 4, 5, 6, 7, 8]);
  });

  it("counts and lists the TWINT emails nothing was booked from, until the office marks them done", async () => {
    const org = await seedOrganisation();
    await ingestMail({ client: prisma, organisationId: org.id, verify: async () => false }, rawMail({}, 7));

    expect(await paymentReviewCount(prisma)).toBe(1);
    const [issue] = await paymentMailIssues(prisma);
    expect(issue).toMatchObject({ reason: "UNSIGNED", subject: "Erfolgreiche Transaktion" });

    expect(await resolveMailIssue(prisma, issue.id, { id: "u1", displayName: "Ahmed" })).toEqual({ ok: true });
    expect(await resolveMailIssue(prisma, issue.id, { id: "u1", displayName: "Ahmed" })).toEqual({ ok: false, code: "conflict" });
    expect(await paymentReviewCount(prisma)).toBe(0);
    expect(await paymentMailIssues(prisma)).toEqual([]);
  });

  it("offers a rental that has already ended, for a balance paid after the return", async () => {
    const org = await seedOrganisation();
    const rental = await seedRental(org.id, { signedAt: new Date("2026-06-01T08:00:00Z") });
    await closeAt(org.id, rental, new Date("2026-06-20T09:00:00Z"));
    await ingestMail(
      { client: prisma, organisationId: org.id, verify: async () => true },
      rawMail({ message: ["Restbetrag"], contact: ["partner@example.ch"], date: "25.06.2026, 18:00" }, 3)
    );
    const waiting = await prisma.payment.findFirstOrThrow();

    const detail = await paymentDetail(prisma, waiting.id);
    expect(detail?.choices.map((c) => c.rentalId)).toContain(rental.id);
  });

  it("says what each booked payment paid: deposit and week, a credit, the balance after the return", async () => {
    const org = await seedOrganisation();
    const rental = await seedRental(org.id, { signedAt: new Date("2026-06-01T08:00:00Z") });
    const balance = await prisma.charge.create({
      data: { organisationId: org.id, rentalId: rental.id, weekNumber: 0, dueDate: new Date("2026-07-30T00:00:00Z"), amountCents: 8_000 },
    });
    const week1 = await prisma.charge.findFirstOrThrow({ where: { rentalId: rental.id, weekNumber: 1 } });
    const deps = { client: prisma, organisationId: org.id, verify: async () => true };
    const office = { id: "u1", displayName: "Ahmed" };
    const waiting = async (uid: number, amount: string) => {
      const tx = `cccccccc-0000-0000-0000-00000000000${uid}`;
      await ingestMail(deps, rawMail({ amount, transaction: tx, message: ["Danke"] }, uid));
      return prisma.payment.findFirstOrThrow({ where: { mailUid: uid } });
    };

    const both = await waiting(1, "CHF 950.00");
    await applyPaymentAction(prisma, both.id, { action: "book", rentalId: rental.id, chargeId: week1.id, depositCents: 50_000 }, office);
    const credit = await waiting(2, "CHF 30.00");
    await applyPaymentAction(prisma, credit.id, { action: "book", rentalId: rental.id, chargeId: null }, office);
    const rest = await waiting(3, "CHF 80.00");
    await applyPaymentAction(prisma, rest.id, { action: "book", rentalId: rental.id, chargeId: balance.id }, office);

    const booked = await paymentList(prisma, "booked");
    const row = (id: string) => booked.find((p) => p.id === id);
    expect(row(both.id)).toMatchObject({ purpose: "deposit+week", weekNumber: 1, method: "TWINT", depositCents: 50_000 });
    expect(row(credit.id)).toMatchObject({ purpose: "credit" });
    expect(row(rest.id)).toMatchObject({ purpose: "return-balance", weekNumber: 0 });

    const another = await waiting(4, "CHF 450.00");
    const choice = (await paymentDetail(prisma, another.id))?.choices.find((c) => c.rentalId === rental.id);
    expect(choice).toMatchObject({ depositCents: 50_000, depositReceivedCents: 50_000 });
  });
});
