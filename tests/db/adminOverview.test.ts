import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/admin/overview/route";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/admin/password";
import { ADMIN_COOKIE, issueAdminSession } from "@/lib/admin/session";
import { persistPickup, type PickupUpload } from "@/lib/rental/persistPickup";
import { persistReturn } from "@/lib/rental/persistReturn";
import type { ReturnDetails } from "@/lib/rental/returnSchema";
import type { ContractDetails } from "@/lib/rental/schema";
import { fleet } from "@/lib/rental/fleet";
import { createMemoryStore } from "@/lib/storage";
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

const returnDetails: ReturnDetails = {
  vehicleId: "prius-zh513925",
  mileageKm: 121_000,
  papersInside: "yes",
  keyReturned: "yes",
  fuelLevel: "1/2",
  cleanliness: "clean",
  damages: "",
  tickets: "no",
  ticketsNote: "",
  fullyPaid: "yes",
  paymentMethods: ["twint"],
  paidOn: "",
  hasDuePayment: "no",
  dueDate: "",
  depositBack: "yes",
  lastName: "Meier",
  firstName: "Anna",
  email: "anna@example.ch",
  place: "Zurich",
};

const uploads: PickupUpload[] = [
  { kind: "SIGNATURE", body: new Uint8Array([6]), contentType: "image/png" },
];

async function signedIn(): Promise<Request> {
  const org = await ensureOrganisation(prisma);
  const user = await prisma.adminUser.create({
    data: {
      organisationId: org.id,
      username: "ahmed",
      displayName: "Eng Ahmed",
      role: "staff",
      passwordHash: await hashPassword("Sommer2026!"),
    },
    select: { id: true },
  });
  return new Request("https://zuriauto.ch/api/admin/overview/", {
    headers: { cookie: `${ADMIN_COOKIE}=${issueAdminSession(user.id)}` },
  });
}

describe("GET /api/admin/overview", () => {
  beforeEach(() => {
    process.env.ADMIN_SECRET = SECRET;
  });

  it("refuses a request with no cookie", async () => {
    const response = await GET(
      new Request("https://zuriauto.ch/api/admin/overview/")
    );
    expect(response.status).toBe(401);
  });

  it("refuses a forged cookie", async () => {
    const response = await GET(
      new Request("https://zuriauto.ch/api/admin/overview/", {
        headers: { cookie: `${ADMIN_COOKIE}=made.up` },
      })
    );
    expect(response.status).toBe(401);
  });

  it("lists every car, including ones off the road", async () => {
    const org = await ensureOrganisation(prisma);
    await seedFleet(prisma, org.id);
    await prisma.car.updateMany({
      where: { slug: "prius-zh401859" },
      data: { status: "retired" },
    });

    const body = await (await GET(await signedIn())).json();

    // Counted from the fleet, not hard-coded: adding a car is a one-line
    // change to fleet.ts and must not break an unrelated test.
    expect(body.cars).toHaveLength(fleet.length);
    // /api/fleet/ hides these; this page exists to manage them.
    expect(body.cars.some((car: { status: string }) => car.status === "retired")).toBe(
      true
    );
    expect(body.counts.retired).toBe(1);
    expect(body.counts.available).toBe(fleet.length - 1);
  });

  it("reports an active rental with its car and renter", async () => {
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

    const body = await (await GET(await signedIn())).json();

    expect(body.rentals).toHaveLength(1);
    expect(body.rentals[0].customerName).toBe("Anna Meier");
    expect(body.rentals[0].contractNumber).toBe(saved.contractNumber);
    expect(body.counts.rented).toBe(1);
    expect(body.counts.activeRentals).toBe(1);
    expect(body.counts.contracts).toBe(1);

    // The car that is out carries its rental, so the row can offer to close it.
    const out = body.cars.find(
      (car: { plate: string }) => car.plate === body.rentals[0].carPlate
    );
    expect(out.activeRentalId).toBe(body.rentals[0].id);
    expect(out.status).toBe("rented");
  });

  it("counts a contract whose email never left", async () => {
    const org = await ensureOrganisation(prisma);
    await seedFleet(prisma, org.id);
    await persistPickup({
      organisationId: org.id,
      details,
      vehicleSlug: details.vehicleId,
      uploads,
      pdf: { body: new Uint8Array([7]) },
      store: createMemoryStore(),
    });

    const body = await (await GET(await signedIn())).json();
    // persistPickup does not send mail, so mailSentAt is null — which is
    // exactly the state the office needs surfaced.
    expect(body.counts.mailFailed).toBe(1);
    expect(body.latestContractAt).toBeTruthy();

    // The count alone cannot be rendered as a row somebody can act on, which
    // is what the Overview band needs. The records come back beside it.
    expect(body.unsentContracts).toHaveLength(1);
    expect(body.unsentContracts[0].contractNumber).toMatch(/^ZA-\d{8}-\d{4}$/);
    expect(body.unsentContracts[0].customerName).toBe("Anna Meier");
    expect(body.unsentContracts[0].signedAt).toBeTruthy();
    // Never the PDF key or anything else about the document: this row exists
    // to be clicked, not to carry a contract around the client.
    expect(Object.keys(body.unsentContracts[0]).sort()).toEqual([
      "contractNumber",
      "customerName",
      "id",
      "signedAt",
    ]);
  });

  it("reports no unsent contracts once the mail has gone", async () => {
    const org = await ensureOrganisation(prisma);
    await seedFleet(prisma, org.id);
    await persistPickup({
      organisationId: org.id,
      details,
      vehicleSlug: details.vehicleId,
      uploads,
      pdf: { body: new Uint8Array([7]) },
      store: createMemoryStore(),
    });
    await prisma.contract.updateMany({ data: { mailSentAt: new Date() } });

    const body = await (await GET(await signedIn())).json();
    expect(body.counts.mailFailed).toBe(0);
    expect(body.unsentContracts).toEqual([]);
  });

  it("reports an empty fleet without failing", async () => {
    await ensureOrganisation(prisma);
    const body = await (await GET(await signedIn())).json();
    expect(body.cars).toEqual([]);
    expect(body.counts.contracts).toBe(0);
    expect(body.latestContractAt).toBeNull();
  });
it("marks a rental whose return the renter has submitted", async () => {
    const org = await ensureOrganisation(prisma);
    await seedFleet(prisma, org.id);
    const store = createMemoryStore();

    await persistPickup({
      organisationId: org.id,
      details,
      vehicleSlug: details.vehicleId,
      uploads,
      pdf: { body: new Uint8Array([7]) },
      store,
    });

    await persistReturn({
      organisationId: org.id,
      details: returnDetails,
      vehicleSlug: details.vehicleId,
      returnNumber: "ZR-20260914-513925-A1B2",
      uploads: [
        { kind: "SIGNATURE", body: new Uint8Array([9]), contentType: "image/png" },
      ],
      pdf: { body: new Uint8Array([8]) },
      store,
    });

    const body = await (await GET(await signedIn())).json();

    expect(body.counts.returnsAwaiting).toBe(1);
    // Still an active rental as far as the office is concerned: the car is not
    // free until somebody confirms.
    expect(body.counts.activeRentals).toBe(1);
    expect(body.counts.rented).toBe(1);

    const rental = body.rentals[0];
    expect(rental.returnSubmittedAt).toBeTruthy();
    expect(rental.returnContractNumber).toBe("ZR-20260914-513925-A1B2");
  });

  it("reports no awaiting returns while every car is simply out", async () => {
    const org = await ensureOrganisation(prisma);
    await seedFleet(prisma, org.id);

    await persistPickup({
      organisationId: org.id,
      details,
      vehicleSlug: details.vehicleId,
      uploads,
      pdf: { body: new Uint8Array([7]) },
      store: createMemoryStore(),
    });

    const body = await (await GET(await signedIn())).json();
    expect(body.counts.returnsAwaiting).toBe(0);
    expect(body.rentals[0].returnSubmittedAt).toBeNull();
  });

});
