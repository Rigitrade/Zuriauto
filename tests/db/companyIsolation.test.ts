import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { CASES, ROUTES, call } from "./adminRoutes";
import { buildCompany, snapshot, type CompanyFixture } from "./companyFixture";

/**
 * Multi-company phase A (15.11.2026): company B's staff call every office
 * endpoint with company A's ids, and get nothing of A's back and change
 * nothing of A's. A control call by A's own owner proves each request really
 * reaches A's record, so a "not found" for B is the wall and not a bad test.
 */

/** Strings that would only appear in a response if A's data leaked. */
function leakMarkers(a: CompanyFixture): string[] {
  return [
    a.plate, a.renterLastName, a.carId, a.customerId, a.rentalId, a.contractId, a.assetId,
    a.chargeId, a.paymentId, a.repairId, a.fineId, a.fineDocumentId, a.proofId,
    a.notificationId, a.mailIssueId, a.ownerId, a.companyPhone,
  ];
}

describe("company isolation", () => {
  it("covers every office route: no route without a case, no case without a route", () => {
    const discovered = ROUTES.map((r) => `${r.method} ${r.route}`).sort();
    const listed = Object.entries(CASES)
      .flatMap(([route, methods]) => Object.keys(methods).map((m) => `${m} ${route}`))
      .sort();
    expect(listed).toEqual(discovered);
    expect(discovered.length).toBeGreaterThanOrEqual(45);
  });

  let a: CompanyFixture;
  let b: CompanyFixture;
  beforeEach(async () => {
    a = await buildCompany("A");
    b = await buildCompany("B");
  });

  it.each(ROUTES.map((r) => [`${r.method} ${r.route}`, r] as const))(
    "%s: company B gets nothing of A's and changes nothing of A's",
    async (_name, route) => {
      const c = CASES[route.route]?.[route.method];
      expect(c, "a case for this route").toBeDefined();
      const before = await snapshot(a);

      const asB = await call(route, c!, b, a);

      if (c!.params) {
        // Exactly "not found": a 409 or 400 would still say the record exists.
        expect(asB.status, asB.text.slice(0, 300)).toBe(404);
      } else {
        for (const marker of leakMarkers(a)) {
          expect(asB.text.includes(marker), `leaked ${marker}: ${asB.text.slice(0, 300)}`).toBe(false);
        }
      }
      expect(await snapshot(a)).toBe(before);
      expect(await prisma.assetAccess.count({ where: { userId: b.ownerId } })).toBe(0);

      // Control: the same request by A's owner reaches A's record.
      if (c!.params) {
        const asA = await call(route, c!, a, a);
        expect(asA.text.includes('"not-found"'), `control ${asA.status} ${asA.text.slice(0, 200)}`).toBe(false);
      }
    }
  );
});

describe("company isolation: overview counts", () => {
  it("counts only the caller's own fines and payments to review", async () => {
    const a = await buildCompany("A");
    const b = await buildCompany("B");
    // A gets a second fine and payment waiting, so its counts differ from B's.
    await prisma.fine.create({
      data: { organisationId: a.organisationId, status: "NEEDS_REVIEW", reviewReason: "FIELDS_MISSING" },
    });
    await prisma.payment.create({
      data: {
        organisationId: a.organisationId,
        externalId: "twint-a-2",
        amountCents: 100,
        paidAt: new Date("2026-11-03T10:00:00Z"),
        status: "NEEDS_REVIEW",
      },
    });
    const { GET } = await import("@/app/api/admin/overview/route");

    const response = await GET(new Request("https://zuriauto.ch/api/admin/overview/", { headers: b.headers }));
    const body = (await response.json()) as {
      fineAttention: { review: number };
      paymentReview: number;
    };

    expect(body.fineAttention.review).toBe(1);
    // One payment to book plus one unresolved TWINT mail issue, both B's.
    expect(body.paymentReview).toBe(2);
  });
});
