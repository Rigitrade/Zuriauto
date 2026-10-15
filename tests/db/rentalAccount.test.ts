import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { openBalances, rentalAccount } from "@/lib/payments/account";
import { applyCutover } from "@/lib/payments/cutover";
import { recordOfficePayment } from "@/lib/payments/office";
import { ingestMail } from "@/lib/payments/twint/ingest";
import { closeRental, RETURN_CLOSE_EVENT } from "@/lib/rental/closeRental";
import { seedOrganisation, seedRental } from "./fineHelpers";
import { rawMail } from "./paymentHelpers";

const office = { id: "user-1", displayName: "Ahmed" };
const signed = async () => true;
// seedRental: 8 weeks of CHF 450 from 01.06, deposit CHF 500.

async function running() {
  const org = await seedOrganisation();
  const rental = await seedRental(org.id, { signedAt: new Date("2026-06-01T08:00:00Z") });
  return { org, rental };
}

async function returnedOn16June() {
  const { org, rental } = await running();
  await prisma.$transaction((tx) =>
    closeRental(tx, {
      organisationId: org.id,
      rentalId: rental.id,
      carId: rental.carId,
      fromStatuses: ["ACTIVE"],
      settlement: { amountCents: 12_000, dueDate: new Date("2026-06-20T00:00:00Z") },
      event: { type: RETURN_CLOSE_EVENT, payload: {} },
      now: new Date("2026-06-16T08:00:00Z"),
    })
  );
  return { org, rental };
}

describe("rentalAccount", () => {
  it("shows a cash deposit, a week paid by TWINT, and what is due, paid and open", async () => {
    const { org, rental } = await running();
    await recordOfficePayment(
      prisma,
      rental.id,
      { amountCents: 50_000, paidOn: "2026-06-01", method: "CASH", chargeId: null, depositCents: 50_000, note: "" },
      office
    );
    const week1 = rawMail({ amount: "CHF 450.00", date: "02.06.2026, 12:00", message: ["Miete", "ZH 513 925 W1"] }, 1);
    expect(await ingestMail({ client: prisma, organisationId: org.id, verify: signed }, week1)).toBe("booked");

    const account = await rentalAccount(prisma, rental.id, new Date("2026-06-10T08:00:00Z"));

    expect(account?.deposit).toMatchObject({ agreedCents: 50_000, receivedCents: 50_000, payments: [{ method: "CASH", cents: 50_000 }] });
    expect(account?.items[0]).toMatchObject({ weekNumber: 1, status: "PAID", owed: true, paidBy: { method: "TWINT" } });
    expect(account?.totals).toEqual({ dueToDateCents: 90_000, paidCents: 45_000, openCents: 45_000 });
  });

  it("shows weeks settled at the cut-over as paid, with no payment", async () => {
    const { org, rental } = await running();
    await applyCutover(prisma, org.id, new Date("2026-06-20T00:00:00Z"));

    const account = await rentalAccount(prisma, rental.id, new Date("2026-06-21T08:00:00Z"));

    expect(account?.items.slice(0, 3).map((i) => [i.status, i.paidBy])).toEqual([
      ["SETTLED", null],
      ["SETTLED", null],
      ["SETTLED", null],
    ]);
    expect(account?.cutoverAt).toBe("2026-06-20T00:00:00.000Z");
    expect(account?.totals).toEqual({ dueToDateCents: 135_000, paidCents: 135_000, openCents: 0 });
  });

  it("puts the balance after the return last, and the weeks that had not begun as undecided", async () => {
    const { rental } = await returnedOn16June();

    const account = await rentalAccount(prisma, rental.id, new Date("2026-06-25T08:00:00Z"));

    expect(account).toMatchObject({ closedBy: "return", closedAt: "2026-06-16T08:00:00.000Z" });
    expect(account?.items.at(-1)).toMatchObject({ weekNumber: 0, amountCents: 12_000, owed: true, pendingAfterClose: false });
    expect(account?.items.filter((i) => i.pendingAfterClose).map((i) => i.weekNumber)).toEqual([4, 5, 6, 7, 8]);
    expect(account?.items.find((i) => i.weekNumber === 4)).toMatchObject({ owed: false });
    // Weeks 1–3 and week 0 are due by the 25th; weeks 4–8 are not owed until the office decides.
    expect(account?.totals).toEqual({ dueToDateCents: 147_000, paidCents: 0, openCents: 147_000 });
  });
});

describe("openBalances", () => {
  it("lists returned renters who owe first, then running ones, and a missing deposit only after the cut-over", async () => {
    const { org, rental: returned } = await returnedOn16June();
    await prisma.organisation.update({ where: { id: org.id }, data: { paymentsCutoverAt: new Date("2026-06-18T00:00:00Z") } });
    const fresh = await seedRental(org.id, {
      signedAt: new Date("2026-06-20T08:00:00Z"),
      details: { vehicleId: "prius-18-zh918474" },
    });

    const rows = await openBalances(prisma, org.id, new Date("2026-06-25T08:00:00Z"));

    expect(rows.map((r) => r.rentalId)).toEqual([returned.id, fresh.id]);
    expect(rows[0]).toMatchObject({ closed: true, owedCents: 147_000, oldestDue: "2026-06-01T08:00:00.000Z", depositMissingCents: 0, pendingWeeks: 5 });
    expect(rows[1]).toMatchObject({ closed: false, owedCents: 45_000, depositMissingCents: 50_000, pendingWeeks: 0 });
  });
});
