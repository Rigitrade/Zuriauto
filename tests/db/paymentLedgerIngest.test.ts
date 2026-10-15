import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { ingestMail } from "@/lib/payments/twint/ingest";
import { applyCutover } from "@/lib/payments/cutover";
import { closeAt, seedOrganisation, seedRental } from "./fineHelpers";
import { rawMail } from "./paymentHelpers";

const signed = async () => true;

describe("ingestMail with the rental account", () => {
  // ZH 615 166 on 20.09.2026, replayed on the seed car ZH 513 925:
  // deposit 250, weekly 250, pickup 12:33; CHF 500 at 16:38; CHF 250 on 29.09.
  // rawMail's contact is Anna's email and phone: the renter paid both, as on 20.09.
  it("takes deposit and week 1 from the pickup payment, and does not pay week 1 again nine days later", async () => {
    const org = await seedOrganisation();
    const rental = await seedRental(org.id, {
      signedAt: new Date("2026-09-20T10:33:00Z"),
      details: {
        terms: { type: "WEEKLY", startAt: "2026-09-20T10:33:00.000Z", totalWeeks: 1, weeklyAmountCents: 25_000, depositCents: 25_000 },
      },
    });
    const deps = { client: prisma, organisationId: org.id, verify: signed };

    const first = rawMail(
      { amount: "CHF 500.00", date: "20.09.2026, 16:38", transaction: "aaaaaaaa-0000-0000-0000-000000000001", message: ["Prius", "ZH 513 925"] },
      1
    );
    expect(await ingestMail(deps, first)).toBe("booked");
    expect(await prisma.payment.findFirstOrThrow({ where: { mailUid: 1 } })).toMatchObject({
      depositCents: 25_000,
      matchedBy: "payer+plate+deposit",
    });

    const second = rawMail(
      {
        amount: "CHF 250.00",
        date: "29.09.2026, 13:52",
        transaction: "aaaaaaaa-0000-0000-0000-000000000002",
        message: ["Toyota Prius miete", "ZH 513 925"],
      },
      2
    );
    expect(await ingestMail(deps, second)).toBe("review");
    expect(await prisma.charge.count({ where: { rentalId: rental.id, status: "PAID" } })).toBe(1);
  });

  it("books a late payment to the renter who paid, not to the one who has the car now", async () => {
    const org = await seedOrganisation();
    const anna = await seedRental(org.id, { signedAt: new Date("2026-06-01T08:00:00Z") });
    await closeAt(org.id, anna, new Date("2026-06-16T08:00:00Z"));
    const ben = await seedRental(org.id, {
      signedAt: new Date("2026-06-17T08:00:00Z"),
      details: { firstName: "Ben", lastName: "Keller", email: "ben@example.ch", mobile: "079 765 43 21" },
    });

    const late = rawMail({ amount: "CHF 450.00", date: "18.06.2026, 12:00", message: ["Restgeld", "ZH 513 925"] }, 3);
    expect(await ingestMail({ client: prisma, organisationId: org.id, verify: signed }, late)).toBe("booked");

    const payment = await prisma.payment.findFirstOrThrow({ where: { mailUid: 3 }, include: { charge: true } });
    expect(payment).toMatchObject({ rentalId: anna.id, matchedBy: "payer+plate+amount", charge: { weekNumber: 1 } });
    expect(await prisma.charge.count({ where: { rentalId: ben.id, status: "PAID" } })).toBe(0);
  });
});

describe("ingestMail after the cut-over", () => {
  // The reviewer's case: weekly 250 from 20.09, cut-over 20.10 settles weeks 1–5;
  // a CHF 250 paid on 12.10 must not pay week 6 (due 25.10).
  it("does not book a payment from before the cut-over to a week after it", async () => {
    const org = await seedOrganisation();
    const rental = await seedRental(org.id, {
      signedAt: new Date("2026-09-20T08:00:00Z"),
      details: { terms: { type: "WEEKLY", startAt: "2026-09-20T08:00:00.000Z", totalWeeks: 8, weeklyAmountCents: 25_000, depositCents: 0 } },
    });
    await applyCutover(prisma, org.id, new Date("2026-10-20T00:00:00Z"));

    const early = rawMail({ amount: "CHF 250.00", date: "12.10.2026, 09:07", message: ["Auto mieten", "ZH 513 925"] }, 9);
    expect(await ingestMail({ client: prisma, organisationId: org.id, verify: signed }, early)).toBe("review");

    expect(await prisma.payment.findFirstOrThrow({ where: { mailUid: 9 } })).toMatchObject({ reviewReason: "BEFORE_CUTOVER" });
    expect(await prisma.charge.count({ where: { rentalId: rental.id, status: "PAID" } })).toBe(0);
  });
});
