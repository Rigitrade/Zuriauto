import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { findCustomersByPhone } from "@/lib/rental/findCustomers";
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

async function ready() {
  const org = await ensureOrganisation(prisma);
  await seedFleet(prisma, org.id);
  return { organisationId: org.id };
}

async function pickup(
  organisationId: string,
  overrides: Partial<ContractDetails> = {},
  uploads: PickupUpload[] = ALL_FIVE
) {
  const merged = { ...details, ...overrides } as ContractDetails;
  return persistPickup({
    organisationId,
    details: merged,
    vehicleSlug: merged.vehicleId,
    uploads,
    pdf: { body: new Uint8Array([7]) },
    store: createMemoryStore(),
  });
}

describe("findCustomersByPhone", () => {
  it("returns nothing for a number nobody has rented on", async () => {
    const { organisationId } = await ready();
    expect(
      await findCustomersByPhone(prisma, organisationId, "+41790000000")
    ).toEqual([]);
  });

  it("returns the prefillable fields for a returning customer", async () => {
    const { organisationId } = await ready();
    await pickup(organisationId);

    const [match] = await findCustomersByPhone(
      prisma,
      organisationId,
      "+41791234567"
    );

    expect(match.firstName).toBe("Anna");
    expect(match.lastName).toBe("Meier");
    // ISO date, not a Date: this crosses JSON to the browser.
    expect(match.birthDate).toBe("1990-04-12");
    expect(match.street).toBe("Bahnhofstrasse 1");
    expect(match.email).toBe("anna@example.ch");
    expect(match.rentalCount).toBe(1);
    expect(match.firstRentalAt).toBe("2026-08-17");
  });

  it("offers the documents from the most recent pickup", async () => {
    const { organisationId } = await ready();
    const first = await pickup(organisationId);

    const [match] = await findCustomersByPhone(
      prisma,
      organisationId,
      "+41791234567"
    );
    expect(match.documentsOnFile?.contractId).toBe(first.contractId);
    expect(match.documentsOnFile?.contractNumber).toBe(first.contractNumber);
  });

  it("does not offer documents when the set is incomplete", async () => {
    const { organisationId } = await ready();
    // A signature and a portrait, no ID or licence. A half-populated document
    // step is worse than an empty one, so this is treated as nothing on file.
    await pickup(organisationId, {}, [ALL_FIVE[0], ALL_FIVE[5]]);

    const [match] = await findCustomersByPhone(
      prisma,
      organisationId,
      "+41791234567"
    );
    expect(match.rentalCount).toBe(1);
    expect(match.documentsOnFile).toBeNull();
  });

  it("does not offer documents past the retention window", async () => {
    const { organisationId } = await ready();
    const first = await pickup(organisationId);

    // Both ends pinned. `signedAt` defaults to the wall clock, so comparing it
    // against "five years from now" put the boundary within hours of the test
    // run and passed or failed depending on the time of day — the same
    // time-bomb shape as a scheduler test that only works on the day it was
    // written.
    await prisma.contract.update({
      where: { id: first.contractId },
      data: { signedAt: new Date("2020-01-01T00:00:00.000Z") },
    });
    const now = new Date("2026-08-22T12:00:00.000Z");

    const [match] = await findCustomersByPhone(
      prisma,
      organisationId,
      "+41791234567",
      now
    );
    expect(match.documentsOnFile).toBeNull();
  });

  it("still offers documents just inside the window", async () => {
    const { organisationId } = await ready();
    const first = await pickup(organisationId);

    await prisma.contract.update({
      where: { id: first.contractId },
      data: { signedAt: new Date("2026-08-01T00:00:00.000Z") },
    });
    const now = new Date("2031-07-01T00:00:00.000Z");

    const [match] = await findCustomersByPhone(
      prisma,
      organisationId,
      "+41791234567",
      now
    );
    // Four years and eleven months on — inside five years, so still reusable.
    expect(match.documentsOnFile?.contractNumber).toBe(first.contractNumber);
  });

  it("returns both people who share a number", async () => {
    const { organisationId } = await ready();
    await pickup(organisationId);
    await pickup(organisationId, {
      firstName: "Peter",
      email: "peter@example.ch",
      vehicleId: "prius-zh589864",
    });

    const matches = await findCustomersByPhone(
      prisma,
      organisationId,
      "+41791234567"
    );
    expect(matches).toHaveLength(2);
    expect(matches.map((m) => m.firstName).sort()).toEqual(["Anna", "Peter"]);
  });
});
