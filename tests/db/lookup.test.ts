import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { driverAt } from "@/lib/rental/lookup";
import { ensureOrganisation, seedFleet } from "@/prisma/seed";

const PLATE = "ZH 589 864";

async function ready() {
  const org = await ensureOrganisation(prisma);
  await seedFleet(prisma, org.id);
  return org.id;
}

let sequence = 0;

async function aRental(opts: {
  organisationId: string;
  lastName: string;
  startAt: string;
  endAt: string;
}) {
  sequence += 1;
  const car = await prisma.car.findFirstOrThrow({ where: { plate: PLATE } });
  const customer = await prisma.customer.create({
    data: {
      organisationId: opts.organisationId,
      firstName: "Anna",
      lastName: opts.lastName,
      email: `${opts.lastName.toLowerCase()}@example.ch`,
      phone: "+41791234567",
      birthDate: new Date("1990-04-12T00:00:00.000Z"),
      street: "Bahnhofstrasse 1",
      postalCode: "8001",
      city: "Zürich",
      country: "Switzerland",
    },
  });
  const rental = await prisma.rental.create({
    data: {
      organisationId: opts.organisationId,
      carId: car.id,
      customerId: customer.id,
      createdBy: "office",
      type: "FIXED_TERM",
      startAt: new Date(opts.startAt),
      endAt: new Date(opts.endAt),
      totalAmountCents: 60_000,
    },
  });
  await prisma.contract.create({
    data: {
      organisationId: opts.organisationId,
      rentalId: rental.id,
      contractNumber: `ZA-20260801-${String(sequence).padStart(4, "0")}`,
      createdBy: "office",
      kind: "PICKUP",
      mileageKm: 1,
      fuelLevel: "full",
      gtcVersion: "2026-07-31",
      gtcLanguage: "de",
      acceptedAt: new Date(opts.startAt),
    },
  });
  return rental;
}

describe("driverAt", () => {
  it("names the driver for a moment inside a rental", async () => {
    const organisationId = await ready();
    await aRental({
      organisationId,
      lastName: "Meier",
      startAt: "2026-08-08T10:00:00.000Z",
      endAt: "2026-08-12T10:00:00.000Z",
    });

    const found = await driverAt(
      prisma,
      organisationId,
      PLATE,
      new Date("2026-08-10T14:30:00.000Z")
    );
    expect(found?.lastName).toBe("Meier");
    expect(found?.street).toBe("Bahnhofstrasse 1");
    expect(found?.contractNumber).toMatch(/^ZA-/);
  });

  it("names nobody for a moment in the gap between rentals", async () => {
    const organisationId = await ready();
    await aRental({
      organisationId,
      lastName: "Meier",
      startAt: "2026-08-01T10:00:00.000Z",
      endAt: "2026-08-05T10:00:00.000Z",
    });
    await aRental({
      organisationId,
      lastName: "Weber",
      startAt: "2026-08-12T10:00:00.000Z",
      endAt: "2026-08-18T10:00:00.000Z",
    });

    expect(
      await driverAt(
        prisma,
        organisationId,
        PLATE,
        new Date("2026-08-08T14:30:00.000Z")
      )
    ).toBeNull();
  });

  it("picks the right one of two consecutive rentals", async () => {
    const organisationId = await ready();
    await aRental({
      organisationId,
      lastName: "Meier",
      startAt: "2026-08-01T10:00:00.000Z",
      endAt: "2026-08-08T10:00:00.000Z",
    });
    await aRental({
      organisationId,
      lastName: "Weber",
      startAt: "2026-08-08T10:00:00.000Z",
      endAt: "2026-08-15T10:00:00.000Z",
    });

    const found = await driverAt(
      prisma,
      organisationId,
      PLATE,
      new Date("2026-08-10T09:00:00.000Z")
    );
    expect(found?.lastName).toBe("Weber");
  });

  it("hands the boundary instant to the incoming driver, not the outgoing one", async () => {
    const organisationId = await ready();
    await aRental({
      organisationId,
      lastName: "Meier",
      startAt: "2026-08-01T10:00:00.000Z",
      endAt: "2026-08-08T10:00:00.000Z",
    });
    await aRental({
      organisationId,
      lastName: "Weber",
      startAt: "2026-08-08T10:00:00.000Z",
      endAt: "2026-08-15T10:00:00.000Z",
    });

    const found = await driverAt(
      prisma,
      organisationId,
      PLATE,
      new Date("2026-08-08T10:00:00.000Z")
    );
    expect(found?.lastName).toBe("Weber");
  });

  it("names nobody for an unknown plate", async () => {
    const organisationId = await ready();
    expect(
      await driverAt(
        prisma,
        organisationId,
        "ZH 000 000",
        new Date("2026-08-10T14:30:00.000Z")
      )
    ).toBeNull();
  });

  it("ignores a cancelled rental", async () => {
    const organisationId = await ready();
    const rental = await aRental({
      organisationId,
      lastName: "Meier",
      startAt: "2026-08-08T10:00:00.000Z",
      endAt: "2026-08-12T10:00:00.000Z",
    });
    await prisma.rental.update({
      where: { id: rental.id },
      data: { status: "CANCELLED" },
    });

    expect(
      await driverAt(
        prisma,
        organisationId,
        PLATE,
        new Date("2026-08-10T14:30:00.000Z")
      )
    ).toBeNull();
  });
});
