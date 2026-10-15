import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { dryRunMails, rentalLabels } from "@/lib/payments/twint/dryRun";
import { ingestMail } from "@/lib/payments/twint/ingest";
import { seedOrganisation, seedRental } from "./fineHelpers";
import { rawMail } from "./paymentHelpers";

const signed = async () => true;

async function setup() {
  const org = await seedOrganisation();
  const rental = await seedRental(org.id, { signedAt: new Date("2026-06-01T08:00:00Z") });
  return { org, rental };
}

describe("dryRunMails", () => {
  it("says what the cron would do with each email, and writes nothing", async () => {
    const { rental } = await setup();
    const mails = [
      rawMail(),
      rawMail({ transaction: "0f0e0d0c-aaaa-bbbb-cccc-000000000002", message: ["ZH918747"] }, 2),
      rawMail({ store: "Velo Huber GmbH" }, 3),
      rawMail({ amount: "zweihundert" }, 4),
    ];

    const rows = await dryRunMails(prisma, mails, { verify: signed });

    expect(rows.map((row) => row.outcome)).toEqual(["booked", "review", "other-store", "unreadable"]);
    const week2 = await prisma.charge.findFirstOrThrow({ where: { rentalId: rental.id, weekNumber: 2 } });
    expect(rows[0]).toMatchObject({ decision: { status: "BOOKED", chargeId: week2.id, matchedBy: "reference+amount" } });
    expect(rows[1]).toMatchObject({ decision: { status: "NEEDS_REVIEW", reason: "PLATE_NOT_IN_FLEET" } });
    expect(rows[2]).toMatchObject({ detail: "Velo Huber GmbH" });
    expect((await rentalLabels(prisma, rows)).get(rental.id)).toMatch(/^ZH 513 925 · \S+ \S\. · 01\.06\.26–\S* · ACTIVE$/);

    expect(await prisma.payment.count()).toBe(0);
    expect(await prisma.paymentMailIssue.count()).toBe(0);
    expect(await prisma.charge.count({ where: { status: "PAID" } })).toBe(0);
  });

  it("reports a payment the cron already stored instead of judging it again", async () => {
    const { org } = await setup();
    await ingestMail({ client: prisma, organisationId: org.id, verify: signed }, rawMail());

    const rows = await dryRunMails(prisma, [rawMail()], { verify: signed });

    expect(rows).toMatchObject([{ outcome: "stored", status: "BOOKED" }]);
  });

  it("stores nothing from mail that is not TWINT's", async () => {
    await setup();

    const rows = await dryRunMails(prisma, [rawMail()], { verify: async () => false });

    expect(rows).toMatchObject([{ outcome: "unsigned" }]);
    expect(await prisma.paymentMailIssue.count()).toBe(0);
  });
});
