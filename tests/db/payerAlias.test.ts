import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { applyPaymentAction } from "@/lib/payments/actions";
import { ingestMail } from "@/lib/payments/twint/ingest";
import { seedOrganisation, seedRental } from "./fineHelpers";
import { rawMail } from "./paymentHelpers";

const office = { id: "user-1", displayName: "Ahmed" };
const signed = async () => true;
const friend = { contact: ["friend@example.ch", "+41 76 555 44 33"] };

async function friendPaysTwice() {
  const org = await seedOrganisation();
  const rental = await seedRental(org.id, { signedAt: new Date("2026-06-01T08:00:00Z") });
  const deps = { client: prisma, organisationId: org.id, verify: signed };
  expect(await ingestMail(deps, rawMail({ ...friend, message: ["Miete", "ZH 513 925"], date: "02.06.2026, 12:00" }, 1))).toBe("review");
  const first = await prisma.payment.findFirstOrThrow({ where: { mailUid: 1 } });
  const week1 = await prisma.charge.findFirstOrThrow({ where: { rentalId: rental.id, weekNumber: 1 } });
  return { rental, deps, first, week1 };
}

describe("remembering the payer", () => {
  it("lets the friend's next payment book itself once the office booked the first and ticked 'Zahler merken'", async () => {
    const { rental, deps, first, week1 } = await friendPaysTwice();

    await applyPaymentAction(
      prisma,
      first.id,
      { action: "book", rentalId: rental.id, chargeId: week1.id, depositCents: 0, rememberPayer: true },
      office
    );

    const next = rawMail(
      { ...friend, transaction: "bbbbbbbb-0000-0000-0000-000000000002", message: ["Miete", "ZH 513 925"], date: "09.06.2026, 12:00" },
      2
    );
    expect(await ingestMail(deps, next)).toBe("booked");
    expect(await prisma.payerAlias.findMany({ select: { kind: true, value: true, createdByName: true } })).toEqual(
      expect.arrayContaining([
        { kind: "email", value: "friend@example.ch", createdByName: "Ahmed" },
        { kind: "phone", value: "+41765554433", createdByName: "Ahmed" },
      ])
    );
  });

  it("learns nothing without the tick, and forgets on undo", async () => {
    const { rental, first, week1 } = await friendPaysTwice();
    const book = (rememberPayer: boolean) =>
      applyPaymentAction(prisma, first.id, { action: "book", rentalId: rental.id, chargeId: week1.id, depositCents: 0, rememberPayer }, office);

    await book(false);
    expect(await prisma.payerAlias.count()).toBe(0);

    await applyPaymentAction(prisma, first.id, { action: "undo" }, office);
    await book(true);
    expect(await prisma.payerAlias.count()).toBe(2);

    await applyPaymentAction(prisma, first.id, { action: "undo" }, office);
    expect(await prisma.payerAlias.count()).toBe(0);
  });
});
