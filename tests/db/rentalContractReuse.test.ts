import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/rental-contract/route";
import { prisma } from "@/lib/db";
import { persistPickup, type PickupUpload } from "@/lib/rental/persistPickup";
import { issueReuseToken } from "@/lib/rental/reuseToken";
import type { ContractDetails } from "@/lib/rental/schema";
import { getAssetStore } from "@/lib/storage";
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

const ALL_FIVE: PickupUpload[] = [
  { kind: "PORTRAIT", body: new Uint8Array([1]), contentType: "image/jpeg" },
  { kind: "ID_FRONT", body: new Uint8Array([2]), contentType: "image/jpeg" },
  { kind: "ID_BACK", body: new Uint8Array([3]), contentType: "image/jpeg" },
  { kind: "LICENCE_FRONT", body: new Uint8Array([4]), contentType: "image/jpeg" },
  { kind: "LICENCE_BACK", body: new Uint8Array([5]), contentType: "image/jpeg" },
  { kind: "SIGNATURE", body: new Uint8Array([6]), contentType: "image/png" },
];

/**
 * The first contract, written directly so the route test is about the second.
 *
 * Seeded through `getAssetStore()` rather than a fresh memory store, because
 * that is what the route will use: with R2 unconfigured it caches one memory
 * store for the process, so the copy the route performs can actually find these
 * objects. A local `createMemoryStore()` here would make the happy path fail
 * for a reason that has nothing to do with the code under test.
 */
async function seedFirstContract() {
  const org = await ensureOrganisation(prisma);
  await seedFleet(prisma, org.id);
  const saved = await persistPickup({
    organisationId: org.id,
    details,
    vehicleSlug: details.vehicleId,
    uploads: ALL_FIVE,
    pdf: { body: new Uint8Array([7]) },
    store: getAssetStore(),
  });
  await prisma.car.updateMany({ data: { status: "available" } });
  return saved;
}

function submission(meta: Record<string, unknown>): Request {
  const body = new FormData();
  body.append(
    "pdf",
    new File([new Uint8Array([37, 80, 68, 70])], "c.pdf", {
      type: "application/pdf",
    })
  );
  body.append(
    "asset:SIGNATURE",
    new File([new Uint8Array([6])], "s.png", { type: "image/png" })
  );
  body.append("meta", JSON.stringify(meta));
  body.append("company", "");

  return new Request("https://zuriauto.ch/api/rental-contract/", {
    method: "POST",
    body,
  });
}

const meta = {
  contractNumber: "ZA-20260822-0002",
  customerName: "Anna Meier",
  customerEmail: "anna@example.ch",
  vehicleLabel: "Toyota Prius",
  plate: "ZH 513925",
  mileageKm: 120_000,
  language: "de",
  details,
};

describe("POST /api/rental-contract with reuse", () => {
  beforeEach(() => {
    process.env.APPLY_SECRET = SECRET;
    process.env.RATE_LIMIT_SALT = "test-salt";
  });

  it("records a contract whose documents were carried forward", async () => {
    const first = await seedFirstContract();
    const response = await POST(
      submission({
        ...meta,
        reuseToken: issueReuseToken(first.contractId),
        identityChecked: true,
      })
    );

    expect(response.status).toBe(200);
    const second = await prisma.contract.findFirstOrThrow({
      where: { documentsReusedFromId: first.contractId },
    });
    expect(second.identityCheckedAt).toBeInstanceOf(Date);
    // Five copied plus the fresh signature.
    expect(await prisma.asset.count({ where: { contractId: second.id } })).toBe(
      6
    );
  });

  it("rejects a reuse token without the attestation", async () => {
    const first = await seedFirstContract();
    const response = await POST(
      submission({ ...meta, reuseToken: issueReuseToken(first.contractId) })
    );
    // The tick is a claim about what a person did and it has to stand behind a
    // contract later, so it cannot be enforced only in the browser.
    expect(response.status).toBe(400);
    expect(await prisma.contract.count()).toBe(1);
  });

  it("rejects a forged reuse token", async () => {
    await seedFirstContract();
    const response = await POST(
      submission({
        ...meta,
        reuseToken: "bm90LWEtdG9rZW4.forged",
        identityChecked: true,
      })
    );
    expect(response.status).toBe(400);
    expect(await prisma.contract.count()).toBe(1);
  });

  it("rejects an expired reuse token", async () => {
    const first = await seedFirstContract();
    const stale = issueReuseToken(
      first.contractId,
      new Date(Date.now() - 60 * 60 * 1000)
    );
    const response = await POST(
      submission({ ...meta, reuseToken: stale, identityChecked: true })
    );
    // Half an hour has passed; the wizard should say so rather than silently
    // falling back to capturing fresh photographs.
    expect(response.status).toBe(400);
    expect(await prisma.contract.count()).toBe(1);
  });
});
