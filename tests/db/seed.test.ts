import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { fleet } from "@/lib/rental/fleet";
import { ensureOrganisation, seedFleet } from "@/prisma/seed";

describe("ensureOrganisation", () => {
  it("creates exactly one organisation, however often it runs", async () => {
    await ensureOrganisation(prisma);
    await ensureOrganisation(prisma);
    expect(await prisma.organisation.count()).toBe(1);
  });
});

describe("seedFleet", () => {
  it("puts every vehicle from the file in the table", async () => {
    const org = await ensureOrganisation(prisma);
    await seedFleet(prisma, org.id);
    expect(await prisma.car.count()).toBe(fleet.length);
  });

  it("is safe to run twice", async () => {
    const org = await ensureOrganisation(prisma);
    await seedFleet(prisma, org.id);
    await seedFleet(prisma, org.id);
    expect(await prisma.car.count()).toBe(fleet.length);
  });

  it("refreshes identity from the file", async () => {
    const org = await ensureOrganisation(prisma);
    await seedFleet(prisma, org.id);
    await prisma.car.updateMany({ data: { model: "WRONG" } });
    await seedFleet(prisma, org.id);
    expect(await prisma.car.count({ where: { model: "WRONG" } })).toBe(0);
  });

  it("never touches status, so a car taken out of service stays out", async () => {
    // This is the whole point of the split: identity is reviewed in code,
    // availability is changed by the office without a deploy.
    const org = await ensureOrganisation(prisma);
    await seedFleet(prisma, org.id);
    const car = await prisma.car.findFirstOrThrow();
    await prisma.car.update({
      where: { id: car.id },
      data: { status: "maintenance" },
    });

    await seedFleet(prisma, org.id);

    const after = await prisma.car.findUniqueOrThrow({ where: { id: car.id } });
    expect(after.status).toBe("maintenance");
  });

  it("carries the chassis number across when the file has one", async () => {
    const org = await ensureOrganisation(prisma);
    await seedFleet(prisma, org.id);
    const withVin = fleet.find((v) => v.vin);
    const stored = await prisma.car.findFirstOrThrow({
      where: { slug: withVin!.id },
    });
    expect(stored.vin).toBe(withVin!.vin);
  });
});
