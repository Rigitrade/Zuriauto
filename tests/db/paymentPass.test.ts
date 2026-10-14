import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { twintPaymentPass } from "@/lib/payments/twint/pass";
import { seedOrganisation, seedRental } from "./fineHelpers";
import { rawMail } from "./paymentHelpers";

describe("twintPaymentPass", () => {
  it("counts each outcome, and one bad mail does not stop the others", async () => {
    const org = await seedOrganisation();
    await seedRental(org.id, { signedAt: new Date("2026-06-01T08:00:00Z") });
    const broken = { uid: 9, source: Buffer.from("not an email at all") };

    const counts = await twintPaymentPass({
      client: prisma,
      fetchMails: async () => [rawMail({}, 1), rawMail({}, 1), broken],
      verify: async (raw) => raw.toString().startsWith("From:"),
    });

    expect(counts).toEqual({ booked: 1, review: 0, duplicate: 1, unsigned: 1, unreadable: 0, failed: 0 });
  });
});
