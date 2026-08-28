import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { persistPickup, type PickupUpload } from "@/lib/rental/persistPickup";
import { persistReturn, type ReturnUpload } from "@/lib/rental/persistReturn";
import type { ContractDetails } from "@/lib/rental/schema";
import type { ReturnDetails } from "@/lib/rental/returnSchema";
import { createMemoryStore, type MemoryStore } from "@/lib/storage";
import { ensureOrganisation, seedFleet } from "@/prisma/seed";

const VEHICLE = "prius-zh513925";

const pickupDetails: ContractDetails = {
  vehicleId: VEHICLE,
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

const pickupUploads: PickupUpload[] = [
  { kind: "PORTRAIT", body: new Uint8Array([1]), contentType: "image/jpeg" },
  { kind: "ID_FRONT", body: new Uint8Array([2]), contentType: "image/jpeg" },
  { kind: "ID_BACK", body: new Uint8Array([3]), contentType: "image/jpeg" },
  { kind: "LICENCE_FRONT", body: new Uint8Array([4]), contentType: "image/jpeg" },
  { kind: "LICENCE_BACK", body: new Uint8Array([5]), contentType: "image/jpeg" },
  { kind: "SIGNATURE", body: new Uint8Array([6]), contentType: "image/png" },
];

const returnDetails: ReturnDetails = {
  vehicleId: VEHICLE,
  mileageKm: 121_450,
  papersInside: "yes",
  keyReturned: "yes",
  fuelLevel: "1/2",
  cleanliness: "clean",
  damages: "Keine neuen Schäden",
  tickets: "no",
  ticketsNote: "",
  fullyPaid: "yes",
  paymentMethods: ["twint"],
  paidOn: "2026-09-14",
  hasDuePayment: "no",
  dueDate: "",
  depositBack: "yes",
  lastName: "Meier",
  firstName: "Anna",
  email: "anna@example.ch",
  place: "Zurich",
};

const returnUploads: ReturnUpload[] = [
  { kind: "SIGNATURE", body: new Uint8Array([10]), contentType: "image/png" },
];

const returnPdf = { body: new Uint8Array([11, 12, 13]) };

async function ready(): Promise<{ organisationId: string; store: MemoryStore }> {
  const org = await ensureOrganisation(prisma);
  await seedFleet(prisma, org.id);
  return { organisationId: org.id, store: createMemoryStore() };
}

/** A rental out on the road, as a return needs to find. */
async function rentalOut(organisationId: string, store: MemoryStore) {
  return persistPickup({
    organisationId,
    details: pickupDetails,
    vehicleSlug: VEHICLE,
    uploads: pickupUploads,
    pdf: { body: new Uint8Array([7, 8, 9]) },
    store,
  });
}

function submitReturn(
  organisationId: string,
  store: MemoryStore,
  overrides: Partial<ReturnDetails> = {},
  returnNumber = "ZR-20260914-513925-A1B2"
) {
  return persistReturn({
    organisationId,
    details: { ...returnDetails, ...overrides },
    vehicleSlug: VEHICLE,
    returnNumber,
    uploads: returnUploads,
    pdf: returnPdf,
    store,
  });
}

describe("the return protocol reaches columns, not only the PDF", () => {
  it("records every answer the renter gave", async () => {
    const { organisationId, store } = await ready();
    await rentalOut(organisationId, store);
    await submitReturn(organisationId, store, {
        cleanliness: "needsWash",
        papersInside: "no",
        keyReturned: "yes",
        tickets: "yes",
        ticketsNote: "Parkbusse Zürich, 40 CHF",
        fullyPaid: "no",
        paymentMethods: ["twint", "cash"],
        paidAmountChf: 300,
        paidOn: "2026-09-14",
        hasDuePayment: "yes",
        dueAmountChf: 200,
        dueDate: "2026-09-30",
        dueMethod: "bank",
      depositBack: "no",
    });

    const addendum = await prisma.contract.findFirstOrThrow({
      where: { kind: "RETURN_ADDENDUM" },
    });

    expect(addendum.cleanliness).toBe("needsWash");
    expect(addendum.papersInside).toBe(false);
    expect(addendum.keyReturned).toBe(true);
    expect(addendum.tickets).toBe(true);
    expect(addendum.ticketsNote).toBe("Parkbusse Zürich, 40 CHF");
    expect(addendum.fullyPaid).toBe(false);
    expect(addendum.paymentMethods).toEqual(["twint", "cash"]);
    // Francs in, cents stored — the same convention as Charge.amountCents.
    expect(addendum.paidAmountCents).toBe(30_000);
    expect(addendum.dueAmountCents).toBe(20_000);
    expect(addendum.dueMethod).toBe("bank");
    expect(addendum.hasDuePayment).toBe(true);
    expect(addendum.depositBack).toBe(false);
    expect(addendum.dueDate?.toISOString().slice(0, 10)).toBe("2026-09-30");
  });

  it("leaves the pickup contract's return columns null", async () => {
    // A pickup has no opinion about whether the key came back. `false` would
    // claim it did not, which is why these are nullable rather than defaulted.
    const { organisationId, store } = await ready();
    await rentalOut(organisationId, store);

    const contract = await prisma.contract.findFirstOrThrow({
      where: { kind: "PICKUP" },
    });
    expect(contract.cleanliness).toBeNull();
    expect(contract.keyReturned).toBeNull();
    expect(contract.depositBack).toBeNull();
    expect(contract.paymentMethods).toEqual([]);
  });
});

describe("persistReturn", () => {
  it("writes a return addendum against the rental the car is out on", async () => {
    const { organisationId, store } = await ready();
    const pickup = await rentalOut(organisationId, store);

    const result = await submitReturn(organisationId, store);

    expect(result.recorded).toBe(true);
    if (!result.recorded) return;
    expect(result.rentalId).toBe(pickup.rentalId);

    const contract = await prisma.contract.findUniqueOrThrow({
      where: { id: result.contractId },
    });
    expect(contract.kind).toBe("RETURN_ADDENDUM");
    expect(contract.rentalId).toBe(pickup.rentalId);
    expect(contract.contractNumber).toBe("ZR-20260914-513925-A1B2");
    expect(contract.mileageKm).toBe(121_450);
    expect(contract.fuelLevel).toBe("half");
    expect(contract.damageNotes).toBe("Keine neuen Schäden");
    expect(contract.pdfKey).toBeTruthy();
  });

  it("moves the rental to RETURN_SUBMITTED", async () => {
    const { organisationId, store } = await ready();
    const pickup = await rentalOut(organisationId, store);

    await submitReturn(organisationId, store);

    const rental = await prisma.rental.findUniqueOrThrow({
      where: { id: pickup.rentalId },
    });
    expect(rental.status).toBe("RETURN_SUBMITTED");
  });

  it("leaves the car rented, so an unfenced form cannot make it bookable", async () => {
    const { organisationId, store } = await ready();
    await rentalOut(organisationId, store);

    await submitReturn(organisationId, store);

    const car = await prisma.car.findFirstOrThrow({
      where: { organisationId, slug: VEHICLE },
    });
    expect(car.status).toBe("rented");
  });

  it("stores the signature and the return PDF under one prefix", async () => {
    const { organisationId, store } = await ready();
    await rentalOut(organisationId, store);

    const result = await submitReturn(organisationId, store);
    if (!result.recorded) throw new Error("expected a recorded return");

    const assets = await prisma.asset.findMany({
      where: { contractId: result.contractId },
    });
    expect(assets).toHaveLength(1);
    expect(assets[0].kind).toBe("SIGNATURE");
    expect(store.objects.has(assets[0].storageKey)).toBe(true);

    const contract = await prisma.contract.findUniqueOrThrow({
      where: { id: result.contractId },
    });
    expect(store.objects.has(contract.pdfKey!)).toBe(true);
    // One submission, one prefix — so an aborted return is sweepable.
    const prefix = assets[0].storageKey.split("/").slice(0, 2).join("/");
    expect(contract.pdfKey!.startsWith(prefix)).toBe(true);
  });

  it("computes the distance driven against the pickup baseline", async () => {
    const { organisationId, store } = await ready();
    await rentalOut(organisationId, store);

    const result = await submitReturn(organisationId, store);
    if (!result.recorded) throw new Error("expected a recorded return");

    expect(result.distanceKm).toBe(1_450);
    expect(result.mileageBelowPickup).toBe(false);

    const event = await prisma.rentalEvent.findFirstOrThrow({
      where: { rentalId: result.rentalId, type: "return.recorded" },
    });
    const payload = event.payload as Record<string, unknown>;
    expect(payload.pickupMileageKm).toBe(120_000);
    expect(payload.distanceKm).toBe(1_450);
  });

  it("flags a reading below the pickup baseline rather than refusing it", async () => {
    const { organisationId, store } = await ready();
    await rentalOut(organisationId, store);

    const result = await submitReturn(organisationId, store, {
      mileageKm: 119_000,
    });

    // Recorded anyway: the document is already signed and in the renter's hands.
    expect(result.recorded).toBe(true);
    if (!result.recorded) return;
    expect(result.distanceKm).toBe(-1_000);
    expect(result.mileageBelowPickup).toBe(true);
  });

  it("records the condition answers the contract has no column for", async () => {
    const { organisationId, store } = await ready();
    await rentalOut(organisationId, store);

    const result = await submitReturn(organisationId, store, {
      cleanliness: "needsWash",
      tickets: "yes",
      ticketsNote: "Parkbusse Zürich",
      hasDuePayment: "yes",
      dueAmountChf: 120,
      dueDate: "2026-09-30",
      dueMethod: "bank",
      depositBack: "no",
    });
    if (!result.recorded) throw new Error("expected a recorded return");

    const event = await prisma.rentalEvent.findFirstOrThrow({
      where: { rentalId: result.rentalId, type: "return.recorded" },
    });
    const payload = event.payload as Record<string, unknown>;
    expect(payload.cleanliness).toBe("needsWash");
    expect(payload.tickets).toBe("yes");
    expect(payload.ticketsNote).toBe("Parkbusse Zürich");
    expect(payload.dueAmountChf).toBe(120);
    expect(payload.dueMethod).toBe("bank");
    expect(payload.depositBack).toBe("no");
  });

  it("compares the submitted email without selecting the rental by it", async () => {
    const { organisationId, store } = await ready();
    await rentalOut(organisationId, store);

    // A renter who typed a different address is still returning this car.
    const result = await submitReturn(organisationId, store, {
      email: "anna.meier@work.example",
    });

    expect(result.recorded).toBe(true);
    if (!result.recorded) return;
    expect(result.emailMatchesCustomer).toBe(false);
  });

  it("matches the email case-insensitively", async () => {
    const { organisationId, store } = await ready();
    await rentalOut(organisationId, store);

    const result = await submitReturn(organisationId, store, {
      email: "ANNA@example.CH",
    });
    if (!result.recorded) throw new Error("expected a recorded return");
    expect(result.emailMatchesCustomer).toBe(true);
  });

  it("reports no-open-rental for a car that is not out", async () => {
    const { organisationId, store } = await ready();

    const result = await submitReturn(organisationId, store);

    expect(result).toEqual({ recorded: false, reason: "no-open-rental" });
  });

  it("reports no-open-rental for a plate the database does not know", async () => {
    const { organisationId, store } = await ready();

    const result = await persistReturn({
      organisationId,
      details: returnDetails,
      vehicleSlug: "does-not-exist",
      returnNumber: "ZR-20260914-000000-ZZZZ",
      uploads: returnUploads,
      pdf: returnPdf,
      store,
    });

    expect(result).toEqual({ recorded: false, reason: "no-open-rental" });
  });

  it("refuses a second return for the same rental", async () => {
    const { organisationId, store } = await ready();
    await rentalOut(organisationId, store);

    const first = await submitReturn(organisationId, store);
    expect(first.recorded).toBe(true);

    const second = await submitReturn(
      organisationId,
      store,
      {},
      "ZR-20260914-513925-C3D4"
    );
    expect(second).toEqual({ recorded: false, reason: "already-returned" });

    const addenda = await prisma.contract.count({
      where: { kind: "RETURN_ADDENDUM" },
    });
    expect(addenda).toBe(1);
  });

  it("stores a discriminated number rather than losing a return to a collision", async () => {
    const { organisationId, store } = await ready();

    // Two cars out, so two returns can legitimately be recorded — and then made
    // to collide by handing both the same number.
    await rentalOut(organisationId, store);
    await persistPickup({
      organisationId,
      details: {
        ...pickupDetails,
        vehicleId: "prius-zh401859",
        email: "bea@example.ch",
      },
      vehicleSlug: "prius-zh401859",
      uploads: pickupUploads,
      pdf: { body: new Uint8Array([7]) },
      store,
    });

    const taken = "ZR-20260914-513925-A1B2";
    await submitReturn(organisationId, store, {}, taken);

    const second = await persistReturn({
      organisationId,
      details: { ...returnDetails, vehicleId: "prius-zh401859" },
      vehicleSlug: "prius-zh401859",
      returnNumber: taken,
      uploads: returnUploads,
      pdf: returnPdf,
      store,
    });

    expect(second.recorded).toBe(true);
    if (!second.recorded) return;
    expect(second.contractNumber).toBe(`${taken}-2`);
  });

  it("lets the office close a recorded return with the existing endpoint", async () => {
    const { organisationId, store } = await ready();
    const pickup = await rentalOut(organisationId, store);
    await submitReturn(organisationId, store);

    // What /api/admin/rentals/[id]/close does, which must still accept a
    // rental sitting in RETURN_SUBMITTED.
    const rental = await prisma.rental.findUniqueOrThrow({
      where: { id: pickup.rentalId },
      select: { status: true, carId: true },
    });
    expect(rental.status).not.toBe("COMPLETED");
    expect(rental.status).not.toBe("CANCELLED");

    await prisma.$transaction(async (tx) => {
      await tx.rental.update({
        where: { id: pickup.rentalId },
        data: { status: "COMPLETED" },
      });
      await tx.car.update({
        where: { id: rental.carId },
        data: { status: "available" },
      });
    });

    const car = await prisma.car.findUniqueOrThrow({
      where: { id: rental.carId },
    });
    expect(car.status).toBe("available");
  });
});

describe("a submitted return and the money still owed", () => {
  it("keeps chasing a weekly charge after the renter has returned the car", async () => {
    const { organisationId, store } = await ready();
    const pickup = await rentalOut(organisationId, store);
    await submitReturn(organisationId, store);

    // Week 1 falls due while the rental sits in RETURN_SUBMITTED.
    const charge = await prisma.charge.findFirstOrThrow({
      where: { rentalId: pickup.rentalId, weekNumber: 1 },
    });

    const { weeklyChargePass } = await import("@/lib/rental/scheduler");
    const issued = await weeklyChargePass({
      client: prisma,
      now: new Date(charge.dueDate.getTime() + 60_000),
      baseUrl: "https://example.test",
      // No SMTP config: the pass claims and marks, and skips the send.
      mail: null,
    });

    // The car being back does not make the week already driven unpayable.
    expect(issued).toBeGreaterThan(0);
    const after = await prisma.charge.findUniqueOrThrow({
      where: { id: charge.id },
    });
    expect(after.status).toBe("REQUESTED");
  });
});
