import { beforeEach, describe, expect, it } from "vitest";
import { DELETE, POST } from "@/app/api/admin/session/route";
import { GET } from "@/app/api/admin/overview/route";
import { prisma } from "@/lib/db";
import { ADMIN_COOKIE, issueAdminSession } from "@/lib/admin/session";
import { persistPickup, type PickupUpload } from "@/lib/rental/persistPickup";
import { persistReturn } from "@/lib/rental/persistReturn";
import type { ReturnDetails } from "@/lib/rental/returnSchema";
import type { ContractDetails } from "@/lib/rental/schema";
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

function signedIn(): Request {
  return new Request("https://zuriauto.ch/api/admin/overview/", {
    headers: { cookie: `${ADMIN_COOKIE}=${issueAdminSession()}` },
  });
}

describe("admin session endpoint", () => {
  beforeEach(() => {
    process.env.ADMIN_SECRET = SECRET;
  });

  it("sets a cookie for the right secret", async () => {
    const response = await POST(
      new Request("https://zuriauto.ch/api/admin/session/", {
        method: "POST",
        body: JSON.stringify({ secret: SECRET }),
      })
    );
    expect(response.status).toBe(200);
    const cookie = response.cookies.get(ADMIN_COOKIE);
    expect(cookie?.value).toBeTruthy();
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("strict");
  });

  it("refuses the wrong secret and sets nothing", async () => {
    const response = await POST(
      new Request("https://zuriauto.ch/api/admin/session/", {
        method: "POST",
        body: JSON.stringify({ secret: "guess" }),
      })
    );
    expect(response.status).toBe(401);
    expect(response.cookies.get(ADMIN_COOKIE)?.value).toBeFalsy();
  });

  it("refuses a body that is not JSON", async () => {
    const response = await POST(
      new Request("https://zuriauto.ch/api/admin/session/", {
        method: "POST",
        body: "not json",
      })
    );
    expect(response.status).toBe(400);
  });

  it("clears the cookie on sign out", async () => {
    const response = await DELETE();
    expect(response.cookies.get(ADMIN_COOKIE)?.value).toBe("");
  });
});

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

    const body = await (await GET(signedIn())).json();

    expect(body.cars).toHaveLength(8);
    // /api/fleet/ hides these; this page exists to manage them.
    expect(body.cars.some((car: { status: string }) => car.status === "retired")).toBe(
      true
    );
    expect(body.counts.retired).toBe(1);
    expect(body.counts.available).toBe(7);
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

    const body = await (await GET(signedIn())).json();

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

    const body = await (await GET(signedIn())).json();
    // persistPickup does not send mail, so mailSentAt is null — which is
    // exactly the state the office needs surfaced.
    expect(body.counts.mailFailed).toBe(1);
    expect(body.latestContractAt).toBeTruthy();
  });

  it("reports an empty fleet without failing", async () => {
    await ensureOrganisation(prisma);
    const body = await (await GET(signedIn())).json();
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

    const body = await (await GET(signedIn())).json();

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

    const body = await (await GET(signedIn())).json();
    expect(body.counts.returnsAwaiting).toBe(0);
    expect(body.rentals[0].returnSubmittedAt).toBeNull();
  });

});
