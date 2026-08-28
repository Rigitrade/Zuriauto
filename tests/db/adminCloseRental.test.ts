import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/admin/rentals/[id]/close/route";
import { GET as fleetGet } from "@/app/api/fleet/route";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/admin/password";
import { ADMIN_COOKIE, issueAdminSession } from "@/lib/admin/session";
import { persistPickup, type PickupUpload } from "@/lib/rental/persistPickup";
import type { ContractDetails } from "@/lib/rental/schema";
import { createMemoryStore } from "@/lib/storage";
import { persistReturn } from "@/lib/rental/persistReturn";
import type { ReturnDetails } from "@/lib/rental/returnSchema";

/** The renter's own answers; the tests below vary only the settlement. */
const returnDetails: ReturnDetails = {
  vehicleId: "prius-zh513925",
  mileageKm: 121_450,
  papersInside: "yes",
  keyReturned: "yes",
  fuelLevel: "1/2",
  cleanliness: "clean",
  damages: "",
  tickets: "no",
  ticketsNote: "",
  fullyPaid: "yes",
  paymentMethods: ["twint"],
  paidOn: "2026-09-14",
  hasDuePayment: "no",
  dueDate: "",
  depositBack: "yes",
  lastName: "Meier",
  firstName: "Anna",
  email: "anna@example.ch",
  place: "Zurich",
};
import { ensureOrganisation, seedFleet } from "@/prisma/seed";

const SECRET = "test-admin-secret";

const details: ContractDetails = {
  vehicleId: "prius-zh513925",
  mileageKm: 120_000,
  fuelLevel: "3/4",
  existingDamage: "",
  terms: {
    type: "WEEKLY",
    startAt: "2026-08-17T08:00:00.000Z",
    totalWeeks: 4,
    weeklyAmountCents: 45_000,
    depositCents: 50_000,
  },
  lastName: "Meier",
  firstName: "Anna",
  birthDate: "1990-04-12",
  street: "Bahnhofstrasse 1",
  postalCode: "8001",
  city: "Zürich",
  country: "Switzerland",
  mobile: "079 123 45 67",
  email: "anna@example.ch",
  gtcAccepted: true,
  gtcVersion: "2026-07-31",
  gtcLanguage: "de",
  acceptedAt: "2026-08-17T08:00:00.000Z",
  place: "Zurich",
};

const uploads: PickupUpload[] = [
  { kind: "SIGNATURE", body: new Uint8Array([6]), contentType: "image/png" },
];

async function signedInCookie(): Promise<string> {
  const org = await ensureOrganisation(prisma);
  const user = await prisma.adminUser.upsert({
    where: { organisationId_username: { organisationId: org.id, username: "ahmed" } },
    update: {},
    create: {
      organisationId: org.id,
      username: "ahmed",
      displayName: "Eng Ahmed",
      role: "staff",
      passwordHash: await hashPassword("Sommer2026!"),
    },
    select: { id: true },
  });
  return issueAdminSession(user.id);
}

async function request(signed = true): Promise<Request> {
  return new Request("https://zuriauto.ch/api/admin/rentals/x/close/", {
    method: "POST",
    headers: signed ? { cookie: `${ADMIN_COOKIE}=${await signedInCookie()}` } : {},
  });
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

async function activeRental() {
  const org = await ensureOrganisation(prisma);
  await seedFleet(prisma, org.id);
  const saved = await persistPickup({
    organisationId: org.id,
    details,
    vehicleSlug: details.vehicleId,
    uploads,
    pdf: { body: new Uint8Array([7]) },
    store: createMemoryStore(),
  });
  return saved;
}

async function fleetSlugs(): Promise<string[]> {
  // The public picker's default scope: available cars only.
  const body = await (
    await fleetGet(new Request("https://zuriauto.ch/api/fleet/"))
  ).json();
  return body.vehicles.map((v: { id: string }) => v.id);
}

/** A rental whose renter has submitted a return declaring what is still owed. */
async function returnedRentalOwing(
  owing: { dueAmountChf?: number; dueDate?: string }
): Promise<string> {
  const saved = await activeRental();
  const store = createMemoryStore();
  await persistReturn({
    organisationId: (await ensureOrganisation(prisma)).id,
    details: {
      ...returnDetails,
      hasDuePayment: owing.dueAmountChf === undefined ? "no" : "yes",
      dueAmountChf: owing.dueAmountChf,
      dueDate: owing.dueDate ?? "",
    },
    vehicleSlug: details.vehicleId,
    returnNumber: "ZR-20260914-513925-TEST",
    uploads: [
      { kind: "SIGNATURE", body: new Uint8Array([10]), contentType: "image/png" },
    ],
    pdf: { body: new Uint8Array([11]) },
    store,
  });
  return saved.rentalId;
}

describe("POST /api/admin/rentals/[id]/close", () => {
  beforeEach(() => {
    process.env.ADMIN_SECRET = SECRET;
  });

  it("refuses an unfenced request", async () => {
    const saved = await activeRental();
    const response = await POST(await request(false), params(saved.rentalId));
    expect(response.status).toBe(401);
    expect(
      (await prisma.rental.findUniqueOrThrow({ where: { id: saved.rentalId } }))
        .status
    ).toBe("ACTIVE");
  });

  it("completes the rental and frees the car", async () => {
    const saved = await activeRental();
    expect(await fleetSlugs()).not.toContain("prius-zh513925");

    const response = await POST(await request(), params(saved.rentalId));
    expect(response.status).toBe(200);

    const rental = await prisma.rental.findUniqueOrThrow({
      where: { id: saved.rentalId },
    });
    expect(rental.status).toBe("COMPLETED");

    // The thing the office actually needs: the car is offerable again.
    expect(await fleetSlugs()).toContain("prius-zh513925");
  });

  it("records the close as an override, not a return", async () => {
    const saved = await activeRental();
    await POST(await request(), params(saved.rentalId));

    const events = await prisma.rentalEvent.findMany({
      where: { rentalId: saved.rentalId },
      orderBy: { createdAt: "asc" },
    });
    // pickup.completed, then the manual close — so a reconciliation can tell
    // this apart from a rental closed by the return flow.
    expect(events.map((event) => event.type)).toContain("rental.closed.manual");
  });

  it("refuses a second close", async () => {
    const saved = await activeRental();
    await POST(await request(), params(saved.rentalId));
    const again = await POST(await request(), params(saved.rentalId));
    // Says so rather than reporting success for work it did not do.
    expect(again.status).toBe(409);
  });

  it("answers 404 for a rental that does not exist", async () => {
    await ensureOrganisation(prisma);
    const response = await POST(await request(), params("ckdoesnotexist"));
    expect(response.status).toBe(404);
  });

  it("leaves the contract and its assets in place", async () => {
    const saved = await activeRental();
    await POST(await request(), params(saved.rentalId));

    // Closing a rental is not deleting a record: the contract is a commercial
    // document with its own ten-year retention.
    expect(
      await prisma.contract.count({ where: { rentalId: saved.rentalId } })
    ).toBe(1);
    expect(
      await prisma.asset.count({ where: { contractId: saved.contractId } })
    ).toBe(1);
  });
});

/**
 * The settlement the renter declared has to become something the system will
 * chase. Until this existed, "I still owe 200 francs, due the 30th" was text
 * inside a PDF: no Charge, so no reminder, no office alert, nothing.
 *
 * It is raised on confirmation rather than at submission on purpose — the
 * office reads the figure in the review modal first, so nobody is chased over
 * a number a customer typed and no one checked.
 */
describe("closing a rental settles the return's declared balance", () => {
  it("raises a charge for the outstanding amount", async () => {
    const rentalId = await returnedRentalOwing({
      dueAmountChf: 200,
      dueDate: "2026-09-30",
    });

    await POST(await request(), params(rentalId));

    const charges = await prisma.charge.findMany({ where: { rentalId } });
    const settlement = charges.find((charge) => charge.weekNumber === 0);
    expect(settlement).toBeDefined();
    expect(settlement?.amountCents).toBe(20_000);
    expect(settlement?.status).toBe("SCHEDULED");
    expect(settlement?.dueDate.toISOString().slice(0, 10)).toBe("2026-09-30");
  });

  it("raises nothing when the renter owed nothing", async () => {
    const rentalId = await returnedRentalOwing({});

    await POST(await request(), params(rentalId));

    const charges = await prisma.charge.findMany({ where: { rentalId } });
    expect(charges.some((charge) => charge.weekNumber === 0)).toBe(false);
  });

  it("does not raise a second charge if the close is retried", async () => {
    // weekNumber 0 is unique per rental, so a retry after a partial failure
    // cannot bill somebody twice for the same balance.
    const rentalId = await returnedRentalOwing({
      dueAmountChf: 150,
      dueDate: "2026-10-05",
    });

    await POST(await request(), params(rentalId));
    await POST(await request(), params(rentalId));

    const settlements = await prisma.charge.findMany({
      where: { rentalId, weekNumber: 0 },
    });
    expect(settlements).toHaveLength(1);
  });
});
