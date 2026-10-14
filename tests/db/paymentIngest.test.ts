import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { ingestMail } from "@/lib/payments/twint/ingest";
import { seedOrganisation, seedRental } from "./fineHelpers";
import { rawMail } from "./paymentHelpers";

const signed = async () => true;

async function setup() {
  const org = await seedOrganisation();
  const rental = await seedRental(org.id, { signedAt: new Date("2026-06-01T08:00:00Z") });
  const deps = { client: prisma, organisationId: org.id, verify: signed };
  return { org, rental, deps };
}

describe("ingestMail", () => {
  it("books the referenced week and marks it paid at the payment's moment", async () => {
    const { rental, deps } = await setup();

    expect(await ingestMail(deps, rawMail())).toBe("booked");

    const charge = await prisma.charge.findFirstOrThrow({ where: { rentalId: rental.id, weekNumber: 2 } });
    expect(charge).toMatchObject({ status: "PAID", paidAt: new Date("2026-06-10T10:00:00Z") });
    const payment = await prisma.payment.findFirstOrThrow({ include: { events: true } });
    expect(payment).toMatchObject({ status: "BOOKED", chargeId: charge.id, matchedBy: "reference+amount" });
    expect(payment.events.map((e) => e.type)).toEqual(["payment.received", "payment.booked"]);
  });

  it("stores the same transaction once, however often it is read", async () => {
    const { deps } = await setup();
    await ingestMail(deps, rawMail());

    expect(await ingestMail(deps, rawMail())).toBe("duplicate");
    expect(await prisma.payment.count()).toBe(1);
  });

  it("stores nothing from a message that is not signed by TWINT", async () => {
    const { deps } = await setup();

    expect(await ingestMail({ ...deps, verify: async () => false }, rawMail())).toBe("unsigned");
    expect(await prisma.payment.count()).toBe(0);
  });

  it("keeps a payment with a plate that is not ours for the office, and touches no charge", async () => {
    const { deps } = await setup();

    expect(await ingestMail(deps, rawMail({ message: ["Auto vermieten", "ZH918747"] }))).toBe("review");
    expect(await prisma.payment.findFirstOrThrow()).toMatchObject({ status: "NEEDS_REVIEW", reviewReason: "PLATE_NOT_IN_FLEET" });
    expect(await prisma.charge.count({ where: { status: "PAID" } })).toBe(0);
  });

  it("sends a second payment for an already-paid week to the office", async () => {
    const { deps } = await setup();
    await ingestMail(deps, rawMail());

    const second = rawMail({ transaction: "0f0e0d0c-aaaa-bbbb-cccc-000000000002" }, 2);
    expect(await ingestMail(deps, second)).toBe("review");
    expect(await prisma.payment.findFirstOrThrow({ where: { mailUid: 2 } })).toMatchObject({ reviewReason: "CHARGE_ALREADY_PAID" });
    expect(await prisma.charge.count({ where: { status: "PAID" } })).toBe(1);
  });

  it("refuses an email it cannot read without storing a half row", async () => {
    const { deps } = await setup();

    expect(await ingestMail(deps, rawMail({ amount: "zweihundert" }))).toBe("unreadable");
    expect(await prisma.payment.count()).toBe(0);
  });
});
