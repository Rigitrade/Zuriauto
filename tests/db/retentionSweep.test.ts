import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { sweepExpiredAssets } from "@/lib/admin/retention";
import { persistPickup, type PickupUpload } from "@/lib/rental/persistPickup";
import type { ContractDetails } from "@/lib/rental/schema";
import { createMemoryStore, type MemoryStore } from "@/lib/storage";
import { ensureOrganisation, seedFleet } from "@/prisma/seed";

/**
 * The sweep, against a real database.
 *
 * The arithmetic is covered in lib/admin/retention.test.ts. What needs a
 * database is the part that cannot be reasoned about in isolation: that the
 * bytes actually leave the store, that the row survives them, and that a
 * rental still inside its five years is left completely alone.
 */

const details: ContractDetails = {
  vehicleId: "prius-zh513925",
  mileageKm: 120_000,
  fuelLevel: "3/4",
  existingDamage: "",
  terms: {
    type: "WEEKLY",
    startAt: "2020-01-06T08:00:00.000Z",
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
  acceptedAt: "2020-01-06T08:00:00.000Z",
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

/** A rental whose end date is set explicitly, so the clock can be aimed. */
async function rentalEndedOn(endAt: string): Promise<MemoryStore> {
  const org = await ensureOrganisation(prisma);
  await seedFleet(prisma, org.id);
  const store = createMemoryStore();
  const saved = await persistPickup({
    organisationId: org.id,
    details,
    vehicleSlug: details.vehicleId,
    uploads,
    pdf: { body: new Uint8Array([7]) },
    store,
  });
  await prisma.rental.update({
    where: { id: saved.rentalId },
    data: { endAt: new Date(endAt) },
  });
  return store;
}

const NOW = new Date("2026-08-29T10:00:00.000Z");

describe("sweepExpiredAssets", () => {
  it("deletes the bytes of a rental that ended over five years ago", async () => {
    const store = await rentalEndedOn("2021-01-01T00:00:00.000Z");
    // Seven objects: six person-assets and the contract PDF.
    expect(store.objects.size).toBe(7);

    const result = await sweepExpiredAssets(prisma, store, NOW);

    expect(result.deleted).toBe(6);
    expect(result.failed).toBe(0);
    // One left, and the next test says which.
    expect(store.objects.size).toBe(1);
  });

  it("keeps the rows, so the record that a passport was checked survives", async () => {
    // The whole point of stamping rather than deleting: the office may need to
    // show that identity was verified at that handover, long after the image
    // itself must be gone.
    const store = await rentalEndedOn("2021-01-01T00:00:00.000Z");
    await sweepExpiredAssets(prisma, store, NOW);

    const assets = await prisma.asset.findMany();
    expect(assets).toHaveLength(6);
    expect(assets.every((asset) => asset.deletedAt !== null)).toBe(true);
    expect(assets.map((a) => a.kind).sort()).toContain("ID_FRONT");
  });

  it("leaves a rental inside its five years completely alone", async () => {
    const store = await rentalEndedOn("2025-06-01T00:00:00.000Z");

    const result = await sweepExpiredAssets(prisma, store, NOW);

    expect(result.considered).toBe(0);
    expect(store.objects.size).toBe(7);
    const assets = await prisma.asset.findMany();
    expect(assets.every((asset) => asset.deletedAt === null)).toBe(true);
  });

  it("is idempotent — a second run finds nothing left to do", async () => {
    const store = await rentalEndedOn("2021-01-01T00:00:00.000Z");
    await sweepExpiredAssets(prisma, store, NOW);

    const second = await sweepExpiredAssets(prisma, store, NOW);
    expect(second.considered).toBe(0);
    expect(second.deleted).toBe(0);
  });

  it("leaves the row unstamped when the store refuses, so tomorrow retries", async () => {
    const store = await rentalEndedOn("2021-01-01T00:00:00.000Z");
    const failing = {
      ...store,
      remove: async () => {
        throw new Error("R2 unreachable");
      },
    };

    const result = await sweepExpiredAssets(prisma, failing, NOW);

    expect(result.failed).toBe(6);
    expect(result.deleted).toBe(0);
    const assets = await prisma.asset.findMany();
    // Unstamped is the honest state: the bytes are still there.
    expect(assets.every((asset) => asset.deletedAt === null)).toBe(true);
  });

  it("does not touch the contract PDF, which is kept for ten years", async () => {
    // OR 958f. The sweep is about the person, not the record.
    const store = await rentalEndedOn("2021-01-01T00:00:00.000Z");
    const before = await prisma.contract.findFirstOrThrow({
      select: { pdfKey: true },
    });
    expect(before.pdfKey).toBeTruthy();

    await sweepExpiredAssets(prisma, store, NOW);

    const after = await prisma.contract.findFirstOrThrow({
      select: { pdfKey: true },
    });
    expect(after.pdfKey).toBe(before.pdfKey);
    // Not just the column — the object itself is still in the bucket, which
    // is the half that would actually breach OR 958f if it went.
    expect(store.objects.has(before.pdfKey as string)).toBe(true);
  });
});
