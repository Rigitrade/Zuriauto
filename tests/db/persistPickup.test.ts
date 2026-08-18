import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { persistPickup, type PickupUpload } from "@/lib/rental/persistPickup";
import type { ContractDetails } from "@/lib/rental/schema";
import { createMemoryStore } from "@/lib/storage";
import { ensureOrganisation, seedFleet } from "@/prisma/seed";

const details: ContractDetails = {
  vehicleId: "prius-zh513925",
  mileageKm: 120_000,
  fuelLevel: "3/4",
  existingDamage: "Kratzer hinten links",
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
  email: "Anna@Example.CH",
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

const pdf = { body: new Uint8Array([7, 8, 9]) };

async function ready() {
  const org = await ensureOrganisation(prisma);
  await seedFleet(prisma, org.id);
  return { organisationId: org.id, store: createMemoryStore() };
}

describe("persistPickup", () => {
  it("writes a customer, a rental, a contract and one asset per upload", async () => {
    const { organisationId, store } = await ready();
    const result = await persistPickup({
      organisationId,
      details,
      vehicleSlug: details.vehicleId,
      uploads,
      pdf,
      store,
    });

    expect(result.contractNumber).toMatch(/^ZA-\d{8}-\d{4}$/);
    expect(await prisma.customer.count()).toBe(1);
    expect(await prisma.rental.count()).toBe(1);
    expect(await prisma.contract.count()).toBe(1);
    expect(await prisma.asset.count()).toBe(uploads.length);
  });

  it("uploads every asset and the PDF", async () => {
    const { organisationId, store } = await ready();
    await persistPickup({
      organisationId,
      details,
      vehicleSlug: details.vehicleId,
      uploads,
      pdf,
      store,
    });
    // Six assets plus the contract PDF.
    expect(store.objects.size).toBe(uploads.length + 1);
  });

  it("records the PDF key on the contract", async () => {
    const { organisationId, store } = await ready();
    await persistPickup({
      organisationId,
      details,
      vehicleSlug: details.vehicleId,
      uploads,
      pdf,
      store,
    });
    const contract = await prisma.contract.findFirstOrThrow();
    expect(contract.pdfKey).toBeTruthy();
    expect(store.objects.has(contract.pdfKey!)).toBe(true);
  });

  it("derives endAt from the weekly term", async () => {
    const { organisationId, store } = await ready();
    await persistPickup({
      organisationId,
      details,
      vehicleSlug: details.vehicleId,
      uploads,
      pdf,
      store,
    });
    const rental = await prisma.rental.findFirstOrThrow();
    expect(rental.endAt.toISOString()).toBe("2026-09-14T08:00:00.000Z");
    expect(rental.weeklyAmountCents).toBe(45_000);
    expect(rental.totalWeeks).toBe(4);
    expect(rental.totalAmountCents).toBeNull();
    expect(rental.depositCents).toBe(50_000);
  });

  it("stores a fixed-term rental's own end and total", async () => {
    const { organisationId, store } = await ready();
    await persistPickup({
      organisationId,
      details: {
        ...details,
        terms: {
          type: "FIXED_TERM",
          startAt: "2026-08-17T08:00:00.000Z",
          endAt: "2026-08-24T17:00:00.000Z",
          totalAmountCents: 60_000,
          depositCents: 0,
        },
      },
      vehicleSlug: details.vehicleId,
      uploads,
      pdf,
      store,
    });
    const rental = await prisma.rental.findFirstOrThrow();
    expect(rental.endAt.toISOString()).toBe("2026-08-24T17:00:00.000Z");
    expect(rental.totalAmountCents).toBe(60_000);
    expect(rental.weeklyAmountCents).toBeNull();
    expect(rental.billingWeekday).toBeNull();
  });

  it("marks the car rented", async () => {
    const { organisationId, store } = await ready();
    await persistPickup({
      organisationId,
      details,
      vehicleSlug: details.vehicleId,
      uploads,
      pdf,
      store,
    });
    const car = await prisma.car.findFirstOrThrow({
      where: { slug: details.vehicleId },
    });
    expect(car.status).toBe("rented");
  });

  it("records a pickup.completed event", async () => {
    const { organisationId, store } = await ready();
    await persistPickup({
      organisationId,
      details,
      vehicleSlug: details.vehicleId,
      uploads,
      pdf,
      store,
    });
    const event = await prisma.rentalEvent.findFirstOrThrow();
    expect(event.type).toBe("pickup.completed");
  });

  it("stores the fuel level in its database spelling", async () => {
    const { organisationId, store } = await ready();
    await persistPickup({
      organisationId,
      details,
      vehicleSlug: details.vehicleId,
      uploads,
      pdf,
      store,
    });
    const contract = await prisma.contract.findFirstOrThrow();
    expect(contract.fuelLevel).toBe("three_quarter");
  });

  it("lowercases the customer email it stores", async () => {
    const { organisationId, store } = await ready();
    await persistPickup({
      organisationId,
      details,
      vehicleSlug: details.vehicleId,
      uploads,
      pdf,
      store,
    });
    const customer = await prisma.customer.findFirstOrThrow();
    expect(customer.email).toBe("anna@example.ch");
  });

  it("refuses a car that is already rented", async () => {
    const { organisationId, store } = await ready();
    const args = {
      organisationId,
      details,
      vehicleSlug: details.vehicleId,
      uploads,
      pdf,
      store,
    };
    await persistPickup(args);
    await expect(persistPickup(args)).rejects.toThrow(/already rented/i);
  });

  it("rolls back completely when a step inside the transaction fails", async () => {
    const { organisationId, store } = await ready();
    await expect(
      persistPickup({
        organisationId,
        details,
        vehicleSlug: "no-such-car",
        uploads,
        pdf,
        store,
      })
    ).rejects.toThrow();

    // Not a single orphan row, in particular no Customer: a half-written
    // handover is worse than none, because it looks like a real record.
    expect(await prisma.customer.count()).toBe(0);
    expect(await prisma.rental.count()).toBe(0);
    expect(await prisma.contract.count()).toBe(0);
    expect(await prisma.asset.count()).toBe(0);
  });

  it("gives a returning customer a second rental, not a second identity", async () => {
    const { organisationId, store } = await ready();
    await persistPickup({
      organisationId,
      details,
      vehicleSlug: details.vehicleId,
      uploads,
      pdf,
      store,
    });
    await prisma.car.updateMany({ data: { status: "available" } });
    await persistPickup({
      organisationId,
      details: { ...details, email: "anna@example.ch" },
      vehicleSlug: details.vehicleId,
      uploads,
      pdf,
      store,
    });

    expect(await prisma.customer.count()).toBe(1);
    expect(await prisma.rental.count()).toBe(2);
    expect(await prisma.contract.count()).toBe(2);
  });
});
