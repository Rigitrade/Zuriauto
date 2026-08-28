import { beforeEach, describe, expect, it } from "vitest";
import { DELETE } from "@/app/api/admin/cars/[id]/route";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/admin/password";
import { ADMIN_COOKIE, issueAdminSession } from "@/lib/admin/session";
import { persistPickup, type PickupUpload } from "@/lib/rental/persistPickup";
import type { ContractDetails } from "@/lib/rental/schema";
import { createMemoryStore } from "@/lib/storage";
import { ensureOrganisation, seedFleet } from "@/prisma/seed";

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
  mobile: "+41791234567",
  email: "anna@example.ch",
  gtcAccepted: true,
  gtcVersion: "2026-07-31",
  gtcLanguage: "de",
  acceptedAt: "2026-08-17T08:00:00.000Z",
  place: "Zurich",
};

const uploads: PickupUpload[] = [
  { kind: "SIGNATURE", body: new Uint8Array([1]), contentType: "image/png" },
];

async function signedIn(): Promise<Request> {
  const org = await ensureOrganisation(prisma);
  const user = await prisma.adminUser.create({
    data: {
      organisationId: org.id,
      username: "chef",
      displayName: "Die Chefin",
      role: "owner",
      passwordHash: await hashPassword("Sommer2026!"),
    },
    select: { id: true },
  });
  return new Request("https://example.test/api/admin/cars/x/", {
    method: "DELETE",
    headers: { cookie: `${ADMIN_COOKIE}=${issueAdminSession(user.id)}` },
  });
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  process.env.ADMIN_SECRET = "signing-key-for-tests";
});

describe("DELETE /api/admin/cars/[id]", () => {
  it("deletes a car that has no history", async () => {
    const request = await signedIn();
    const org = await prisma.organisation.findFirstOrThrow();
    const car = await prisma.car.create({
      data: {
        organisationId: org.id,
        slug: "typo-zh000000",
        model: "Typo",
        plate: "ZH 000 000",
      },
      select: { id: true },
    });

    const response = await DELETE(request, params(car.id));
    expect(response.status).toBe(200);
    expect(await prisma.car.count({ where: { id: car.id } })).toBe(0);
  });

  it("refuses a car with a rental, and keeps it", async () => {
    const request = await signedIn();
    const org = await prisma.organisation.findFirstOrThrow();
    await seedFleet(prisma, org.id);
    await persistPickup({
      organisationId: org.id,
      details,
      vehicleSlug: details.vehicleId,
      uploads,
      pdf: { body: new Uint8Array([2]) },
      store: createMemoryStore(),
    });

    const car = await prisma.car.findFirstOrThrow({
      where: { slug: details.vehicleId },
    });
    const response = await DELETE(request, params(car.id));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ code: "has-history" });
    // Still there: the traffic-fine lookup and the signed contract need it.
    expect(await prisma.car.count({ where: { id: car.id } })).toBe(1);
  });

  it("answers 404 for an unknown id", async () => {
    const request = await signedIn();
    const response = await DELETE(request, params("clxnope00000000000000000"));
    expect(response.status).toBe(404);
  });

  it("refuses a stranger", async () => {
    const response = await DELETE(
      new Request("https://example.test/api/admin/cars/x/", { method: "DELETE" }),
      params("whatever")
    );
    expect(response.status).toBe(401);
  });
});
