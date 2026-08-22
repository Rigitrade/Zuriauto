import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/customers/lookup/route";
import { prisma } from "@/lib/db";
import { APPLY_KEY_HEADER } from "@/lib/applyKey";
import { persistPickup, type PickupUpload } from "@/lib/rental/persistPickup";
import { readReuseToken } from "@/lib/rental/reuseToken";
import type { ContractDetails } from "@/lib/rental/schema";
import { createMemoryStore } from "@/lib/storage";
import { ensureOrganisation, seedFleet } from "@/prisma/seed";

const SECRET = "test-office-secret";

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
  { kind: "PORTRAIT", body: new Uint8Array([1]), contentType: "image/jpeg" },
  { kind: "ID_FRONT", body: new Uint8Array([2]), contentType: "image/jpeg" },
  { kind: "ID_BACK", body: new Uint8Array([3]), contentType: "image/jpeg" },
  { kind: "LICENCE_FRONT", body: new Uint8Array([4]), contentType: "image/jpeg" },
  { kind: "LICENCE_BACK", body: new Uint8Array([5]), contentType: "image/jpeg" },
  { kind: "SIGNATURE", body: new Uint8Array([6]), contentType: "image/png" },
];

function request(body: unknown, key: string | null = SECRET): Request {
  return new Request("https://zuriauto.ch/api/customers/lookup/", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(key ? { [APPLY_KEY_HEADER]: key } : {}),
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

describe("POST /api/customers/lookup", () => {
  beforeEach(() => {
    process.env.APPLY_SECRET = SECRET;
    process.env.RATE_LIMIT_SALT = "test-salt";
  });

  it("refuses an unfenced request", async () => {
    const response = await POST(request({ phone: "079 123 45 67" }, null));
    expect(response.status).toBe(401);
  });

  it("refuses the wrong key", async () => {
    const response = await POST(request({ phone: "079 123 45 67" }, "wrong"));
    expect(response.status).toBe(401);
  });

  it("finds a returning customer and hands back a usable token", async () => {
    await seedOneRental();
    const response = await POST(request({ phone: "079 123 45 67" }));
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.matches).toHaveLength(1);
    expect(body.matches[0].firstName).toBe("Anna");
    expect(body.matches[0].documentsOnFile.contractNumber).toMatch(
      /^ZA-\d{8}-\d{4}$/
    );

    // A token, not an id — and one the submit path will accept.
    expect(body.matches[0].documentsOnFile.contractId).toBeUndefined();
    const token = body.matches[0].documentsOnFile.reuseToken;
    expect(readReuseToken(token)).toMatch(/^c[a-z0-9]+$/);
  });

  it("answers 200 with an empty list for an unknown number", async () => {
    await seedOneRental();
    const response = await POST(request({ phone: "079 000 00 00" }));
    // A query that succeeded and found nothing, not a missing resource — a 404
    // would read to the staff member as a broken lookup.
    expect(response.status).toBe(200);
    expect((await response.json()).matches).toEqual([]);
  });

  it("answers 200 with an empty list for an unnormalisable number", async () => {
    await seedOneRental();
    const response = await POST(request({ phone: "ask at the desk" }));
    expect(response.status).toBe(200);
    expect((await response.json()).matches).toEqual([]);
  });

  it("rejects a missing phone field", async () => {
    const response = await POST(request({}));
    expect(response.status).toBe(400);
  });

  it("records every lookup as a hash, with the match count", async () => {
    await seedOneRental();
    await POST(request({ phone: "079 123 45 67" }));

    const [audit] = await prisma.customerLookup.findMany();
    expect(audit.matches).toBe(1);
    expect(audit.phoneHash).toMatch(/^[0-9a-f]{64}$/);
    // The number itself must never be recoverable from this table.
    expect(audit.phoneHash).not.toContain("791234567");
  });

  it("rate-limits repeated lookups", async () => {
    await seedOneRental();
    let last = 200;
    // RATE_LIMIT.max is 5, so the sixth is refused.
    for (let attempt = 0; attempt < 7; attempt += 1) {
      last = (await POST(request({ phone: "079 123 45 67" }))).status;
    }
    expect(last).toBe(429);
  });
});
