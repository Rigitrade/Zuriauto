import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/rental-return/prefill/route";
import { prisma } from "@/lib/db";
import { persistPickup, type PickupUpload } from "@/lib/rental/persistPickup";
import type { ContractDetails } from "@/lib/rental/schema";
import { createMemoryStore } from "@/lib/storage";
import { ensureOrganisation, seedFleet } from "@/prisma/seed";

/**
 * The return form filling in the renter from the car.
 *
 * Public by the owner's decision of 2026-10-02 — see lib/rental/returnPrefill.ts.
 * What these pin is how narrow that answer stays: the renter of an open rental
 * and nothing else, never a past renter, never more than the form asks for.
 */

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
  truthfulInfoConfirmedAt: "2026-08-17T08:00:10.000Z",
  deceptionNoticeConfirmedAt: "2026-08-17T08:00:20.000Z",
  place: "Zurich",
};

const uploads: PickupUpload[] = [
  { kind: "PORTRAIT", body: new Uint8Array([1]), contentType: "image/jpeg" },
  { kind: "ID_FRONT", body: new Uint8Array([2]), contentType: "image/jpeg" },
  { kind: "ID_BACK", body: new Uint8Array([3]), contentType: "image/jpeg" },
  { kind: "LICENCE_FRONT", body: new Uint8Array([4]), contentType: "image/jpeg" },
  { kind: "LICENCE_BACK", body: new Uint8Array([5]), contentType: "image/jpeg" },
  { kind: "SIGNATURE", body: new Uint8Array([6]), contentType: "image/png" },
];

function request(body: unknown, origin?: string): Request {
  return new Request("https://zuriauto.ch/api/rental-return/prefill/", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(origin ? { origin } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function seedOneRental() {
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
  return org;
}

describe("POST /api/rental-return/prefill", () => {
  beforeEach(() => {
    process.env.RATE_LIMIT_SALT = "test-salt";
  });

  it("fills in the renter and the pickup mileage of the car's open rental", async () => {
    await seedOneRental();
    const response = await POST(request({ vehicleId: "prius-zh513925" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");

    // Exactly these four. No phone, address, birth date or ids — the form
    // does not ask for them, so the endpoint does not hand them out.
    expect((await response.json()).prefill).toEqual({
      firstName: "Anna",
      lastName: "Meier",
      email: "anna@example.ch",
      pickupMileageKm: 120_000,
    });
  });

  it("answers null for a car with nothing out on it", async () => {
    await seedOneRental();
    const response = await POST(request({ vehicleId: "octavia-zh886530" }));
    expect(response.status).toBe(200);
    expect((await response.json()).prefill).toBeNull();
  });

  it("never names the renter of a rental that has ended", async () => {
    await seedOneRental();
    await prisma.rental.updateMany({ data: { status: "COMPLETED" } });

    const response = await POST(request({ vehicleId: "prius-zh513925" }));
    expect((await response.json()).prefill).toBeNull();
  });

  it("refuses a cross-site post", async () => {
    await seedOneRental();
    const response = await POST(
      request({ vehicleId: "prius-zh513925" }, "https://evil.example")
    );
    expect(response.status).toBe(403);
  });

  it("rejects a missing vehicle", async () => {
    const response = await POST(request({}));
    expect(response.status).toBe(400);
  });

  it("refuses the thirty-first lookup in ten minutes", async () => {
    await seedOneRental();
    let refusedAt = 0;
    for (let attempt = 0; attempt < 31; attempt += 1) {
      const status = (await POST(request({ vehicleId: "prius-zh513925" })))
        .status;
      if (status === 429 && refusedAt === 0) refusedAt = attempt + 1;
    }
    expect(refusedAt).toBe(31);
  });
});
