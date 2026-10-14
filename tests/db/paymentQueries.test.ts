import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { ingestMail } from "@/lib/payments/twint/ingest";
import { paymentDetail, paymentList, paymentReviewCount } from "@/lib/payments/queries";
import { seedOrganisation, seedRental } from "./fineHelpers";
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
});
