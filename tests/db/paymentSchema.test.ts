import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { seedOrganisation } from "./fineHelpers";

/** The idempotency of reading the mailbox is this constraint, not a flag. */
describe("Payment", () => {
  const row = (organisationId: string) => ({
    organisationId,
    externalId: "ce21e52e-2354-4f6d-a7d7-64a448f335f8",
    amountCents: 25_000,
    paidAt: new Date("2026-10-05T08:00:00Z"),
    status: "NEEDS_REVIEW" as const,
    reviewReason: "NO_PLATE" as const,
  });

  it("stores one row per TWINT transaction number", async () => {
    const org = await seedOrganisation();
    await prisma.payment.create({ data: row(org.id) });

    await expect(prisma.payment.create({ data: row(org.id) })).rejects.toMatchObject({ code: "P2002" });
  });

  it("keeps a timeline per payment", async () => {
    const org = await seedOrganisation();
    const payment = await prisma.payment.create({ data: row(org.id) });
    await prisma.paymentEvent.create({ data: { paymentId: payment.id, type: "payment.received" } });

    expect(await prisma.paymentEvent.count({ where: { paymentId: payment.id } })).toBe(1);
  });
});
