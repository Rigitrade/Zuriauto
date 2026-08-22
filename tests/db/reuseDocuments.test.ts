import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { persistPickup, type PickupUpload } from "@/lib/rental/persistPickup";
import { copyDocumentsForward } from "@/lib/rental/reuseDocuments";
import type { ContractDetails } from "@/lib/rental/schema";
import { createMemoryStore, type MemoryStore } from "@/lib/storage";
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

/** One shared store, so a copy can find what the first pickup put there. */
async function firstPickup(store: MemoryStore) {
  const org = await ensureOrganisation(prisma);
  await seedFleet(prisma, org.id);
  const saved = await persistPickup({
    organisationId: org.id,
    details,
    vehicleSlug: details.vehicleId,
    uploads: ALL_FIVE,
    pdf: { body: new Uint8Array([7]) },
    store,
  });
  // Free the car so the same fleet can be rented again.
  await prisma.car.updateMany({ data: { status: "available" } });
  return { organisationId: org.id, saved };
}

describe("copyDocumentsForward", () => {
  it("copies the five identity documents and nothing else", async () => {
    const store = createMemoryStore();
    const { saved } = await firstPickup(store);

    const copied = await copyDocumentsForward(
      prisma,
      store,
      "new-submission",
      saved.contractId
    );

    expect(copied).toHaveLength(5);
    expect(copied.map((asset) => asset.kind).sort()).toEqual([
      "ID_BACK",
      "ID_FRONT",
      "LICENCE_BACK",
      "LICENCE_FRONT",
      "PORTRAIT",
    ]);
    // The signature is signed today and is never carried forward.
    expect(copied.some((asset) => asset.kind === "SIGNATURE")).toBe(false);
  });

  it("gives every copy a new key under the new submission", async () => {
    const store = createMemoryStore();
    const { saved } = await firstPickup(store);

    const copied = await copyDocumentsForward(
      prisma,
      store,
      "new-submission",
      saved.contractId
    );

    for (const asset of copied) {
      expect(asset.storageKey).toContain("pickup/new-submission/");
    }
    // Six from the first pickup, plus its PDF, plus five copies.
    expect(store.objects.size).toBe(12);
  });

  it("carries the size and content type from the source row", async () => {
    const store = createMemoryStore();
    const { saved } = await firstPickup(store);

    const copied = await copyDocumentsForward(
      prisma,
      store,
      "new-submission",
      saved.contractId
    );
    const portrait = copied.find((asset) => asset.kind === "PORTRAIT");
    expect(portrait?.contentType).toBe("image/jpeg");
    expect(portrait?.bytes).toBe(1);
  });

  it("refuses when the source set is incomplete", async () => {
    const store = createMemoryStore();
    const org = await ensureOrganisation(prisma);
    await seedFleet(prisma, org.id);
    const saved = await persistPickup({
      organisationId: org.id,
      details,
      vehicleSlug: details.vehicleId,
      uploads: [ALL_FIVE[0], ALL_FIVE[5]],
      pdf: { body: new Uint8Array([7]) },
      store,
    });

    // Loud, because the caller has already told the customer their documents
    // are on file.
    await expect(
      copyDocumentsForward(prisma, store, "new-submission", saved.contractId)
    ).rejects.toThrow(/incomplete/i);
  });
});

describe("persistPickup with reuse", () => {
  it("writes five copied assets plus the fresh signature", async () => {
    const store = createMemoryStore();
    const { organisationId, saved } = await firstPickup(store);
    const checkedAt = new Date("2026-11-01T09:00:00.000Z");

    const second = await persistPickup({
      organisationId,
      details,
      vehicleSlug: "prius-zh513925",
      uploads: [ALL_FIVE[5]],
      pdf: { body: new Uint8Array([8]) },
      store,
      reuseFromContractId: saved.contractId,
      identityCheckedAt: checkedAt,
    });

    const assets = await prisma.asset.findMany({
      where: { contractId: second.contractId },
    });
    expect(assets).toHaveLength(6);

    const contract = await prisma.contract.findUniqueOrThrow({
      where: { id: second.contractId },
    });
    expect(contract.documentsReusedFromId).toBe(saved.contractId);
    expect(contract.identityCheckedAt).toEqual(checkedAt);
  });

  it("leaves the source contract's own assets untouched", async () => {
    const store = createMemoryStore();
    const { organisationId, saved } = await firstPickup(store);

    await persistPickup({
      organisationId,
      details,
      vehicleSlug: "prius-zh513925",
      uploads: [ALL_FIVE[5]],
      pdf: { body: new Uint8Array([8]) },
      store,
      reuseFromContractId: saved.contractId,
      identityCheckedAt: new Date(),
    });

    // Each contract owns its own set on its own retention clock; nothing is
    // shared and nothing is moved.
    expect(
      await prisma.asset.count({ where: { contractId: saved.contractId } })
    ).toBe(6);
  });

  it("records one customer, not two", async () => {
    const store = createMemoryStore();
    const { organisationId, saved } = await firstPickup(store);

    await persistPickup({
      organisationId,
      details,
      vehicleSlug: "prius-zh513925",
      uploads: [ALL_FIVE[5]],
      pdf: { body: new Uint8Array([8]) },
      store,
      reuseFromContractId: saved.contractId,
      identityCheckedAt: new Date(),
    });

    expect(await prisma.customer.count()).toBe(1);
    expect(await prisma.rental.count()).toBe(2);
  });
});
