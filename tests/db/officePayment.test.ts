import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { applyPaymentAction } from "@/lib/payments/actions";
import { recordOfficePayment } from "@/lib/payments/office";
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
