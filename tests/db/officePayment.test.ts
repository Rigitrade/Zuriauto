import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { applyPaymentAction } from "@/lib/payments/actions";
import { recordOfficePayment } from "@/lib/payments/office";
import { ingestMail } from "@/lib/payments/twint/ingest";
import { rawMail } from "./paymentHelpers";
import { seedOrganisation, seedRental } from "./fineHelpers";

const office = { id: "user-1", displayName: "Ahmed" };

async function setup() {
  const org = await seedOrganisation();
  // weekly 450, deposit 500 (seedRental's defaults)
  const rental = await seedRental(org.id, { signedAt: new Date("2026-06-01T08:00:00Z") });
  const week = (n: number) => prisma.charge.findFirstOrThrow({ where: { rentalId: rental.id, weekNumber: n } });
  const deposit = async () =>
    (await prisma.payment.aggregate({ where: { rentalId: rental.id, status: "BOOKED" }, _sum: { depositCents: true } }))._sum
      .depositCents ?? 0;
  return { rental, week, deposit };
}

const cash = (overrides: Record<string, unknown> = {}) => ({
  amountCents: 45_000,
  paidOn: "2026-06-08",
  method: "CASH" as const,
  chargeId: null as string | null,
  depositCents: 0,
  note: "",
  ...overrides,
});

describe("recordOfficePayment", () => {
  it("records cash for a week: the week is paid on that day, and the timeline names the office", async () => {
    const { rental, week } = await setup();
    const week2 = await week(2);

    expect(await recordOfficePayment(prisma, rental.id, cash({ chargeId: week2.id }), office)).toEqual({ ok: true });

    expect(await week(2)).toMatchObject({ status: "PAID" });
    const payment = await prisma.payment.findFirstOrThrow({ include: { events: { orderBy: { createdAt: "asc" } } } });
    expect(payment).toMatchObject({ method: "CASH", status: "BOOKED", matchedBy: "office", chargeId: week2.id });
    expect(payment.externalId).toMatch(/^office:/);
    expect(payment.events.map((e) => [e.type, e.actorName])).toEqual([
      ["payment.recorded", "Ahmed"],
      ["payment.booked", "Ahmed"],
    ]);
  });

  it("takes the deposit and week 1 from one payment", async () => {
    const { rental, week, deposit } = await setup();

    await recordOfficePayment(prisma, rental.id, cash({ amountCents: 95_000, chargeId: (await week(1)).id, depositCents: 50_000 }), office);

    expect((await week(1)).status).toBe("PAID");
    expect(await deposit()).toBe(50_000);
  });

  it("refuses an amount that is not the week plus the deposit, and stores nothing", async () => {
    const { rental, week } = await setup();

    expect(await recordOfficePayment(prisma, rental.id, cash({ amountCents: 40_000, chargeId: (await week(2)).id }), office)).toEqual({
      ok: false,
      code: "bad-request",
    });
    expect(await prisma.payment.count()).toBe(0);
  });

  it("refuses more deposit than was agreed", async () => {
    const { rental } = await setup();

    expect(await recordOfficePayment(prisma, rental.id, cash({ amountCents: 60_000, depositCents: 60_000 }), office)).toEqual({
      ok: false,
      code: "bad-request",
    });
  });

  it("cancels an office payment on undo, and the week is owed again", async () => {
    const { rental, week, deposit } = await setup();
    const week1 = await week(1);
    await recordOfficePayment(prisma, rental.id, cash({ amountCents: 95_000, chargeId: week1.id, depositCents: 50_000 }), office);
    const payment = await prisma.payment.findFirstOrThrow();

    expect(await applyPaymentAction(prisma, payment.id, { action: "undo" }, office)).toEqual({ ok: true });

    expect(await week(1)).toMatchObject({ status: "SCHEDULED", paidAt: null });
    expect(await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).toMatchObject({
      status: "IGNORED",
      depositCents: 0,
      chargeId: null,
    });
    expect(await deposit()).toBe(0);
    expect(await applyPaymentAction(prisma, payment.id, { action: "undo" }, office)).toEqual({ ok: false, code: "conflict" });
  });
});

describe("a TWINT payment the office records by hand", () => {
  const twintId = "aaaaaaaa-1111-2222-3333-444444444444";

  it("needs TWINT's Transaktions-Nr., and its email then counts as the same payment", async () => {
    const { rental, week } = await setup();
    const org = await prisma.organisation.findFirstOrThrow();
    const week3 = await week(3);

    expect(await recordOfficePayment(prisma, rental.id, cash({ method: "TWINT", chargeId: week3.id }), office)).toEqual({
      ok: false,
      code: "bad-request",
    });
    expect(
      await recordOfficePayment(prisma, rental.id, cash({ method: "TWINT", chargeId: week3.id, transactionId: twintId.toUpperCase() }), office)
    ).toEqual({ ok: true });

    const email = rawMail({ amount: "CHF 450.00", transaction: twintId, message: ["Miete", "ZH 513 925"], date: "16.06.2026, 12:00" }, 5);
    expect(await ingestMail({ client: prisma, organisationId: org.id, verify: async () => true }, email)).toBe("duplicate");
    expect(await prisma.charge.count({ where: { rentalId: rental.id, status: "PAID" } })).toBe(1);
  });

  it("refuses a Transaktions-Nr. whose email was already read", async () => {
    const { rental, week } = await setup();
    const org = await prisma.organisation.findFirstOrThrow();
    const email = rawMail({ amount: "CHF 450.00", transaction: twintId, message: ["Danke"], date: "16.06.2026, 12:00" }, 6);
    await ingestMail({ client: prisma, organisationId: org.id, verify: async () => true }, email);

    expect(
      await recordOfficePayment(prisma, rental.id, cash({ method: "TWINT", chargeId: (await week(3)).id, transactionId: twintId }), office)
    ).toEqual({ ok: false, code: "conflict" });
    expect(await prisma.payment.count()).toBe(1);
  });
});

describe("what one payment can pay", () => {
  it("refuses to take the deposit and a week out of a payment that covers only the week", async () => {
    const { rental, week } = await setup();
    const org = await prisma.organisation.findFirstOrThrow();
    await ingestMail(
      { client: prisma, organisationId: org.id, verify: async () => true },
      rawMail({ amount: "CHF 450.00", message: ["Danke"], date: "02.06.2026, 12:00" }, 7)
    );
    const waiting = await prisma.payment.findFirstOrThrow({ where: { mailUid: 7 } });

    expect(
      await applyPaymentAction(prisma, waiting.id, { action: "book", rentalId: rental.id, chargeId: (await week(1)).id, depositCents: 10_000 }, office)
    ).toEqual({ ok: false, code: "bad-request" });
    expect((await week(1)).status).toBe("SCHEDULED");
  });

  it("takes the deposit once when two bookings of it race", async () => {
    const { rental, deposit } = await setup();
    const depositOnly = cash({ amountCents: 50_000, depositCents: 50_000 });

    const results = await Promise.all([
      recordOfficePayment(prisma, rental.id, depositOnly, office),
      recordOfficePayment(prisma, rental.id, depositOnly, office),
    ]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await deposit()).toBe(50_000);
    // The losing booking leaves nothing behind, not a payment waiting for review.
    expect(await prisma.payment.count()).toBe(1);
  });

  it("still records a week on a rental whose deposit was booked twice by mistake", async () => {
    const { rental, week } = await setup();
    const org = await prisma.organisation.findFirstOrThrow();
    await prisma.payment.create({
      data: { organisationId: org.id, externalId: "office:twice", amountCents: 60_000, paidAt: new Date("2026-06-01T10:00:00Z"), method: "CASH", depositCents: 60_000, status: "BOOKED", rentalId: rental.id },
    });

    expect(await recordOfficePayment(prisma, rental.id, cash({ chargeId: (await week(2)).id }), office)).toEqual({ ok: true });
  });

  it("refuses a payment dated in the future", async () => {
    const { rental, week } = await setup();
    expect(await recordOfficePayment(prisma, rental.id, cash({ chargeId: (await week(2)).id, paidOn: "2099-01-01" }), office)).toEqual({
      ok: false,
      code: "bad-request",
    });
  });
});

