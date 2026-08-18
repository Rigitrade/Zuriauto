import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { normaliseEmail, upsertCustomer } from "@/lib/rental/customers";
import type { ContractDetails } from "@/lib/rental/schema";

const base: ContractDetails = {
  vehicleId: "prius-zh513925",
  mileageKm: 120_000,
  fuelLevel: "full",
  existingDamage: "",
  terms: {
    type: "WEEKLY",
    startAt: "2026-08-17T08:00:00.000Z",
    totalWeeks: 4,
    weeklyAmountCents: 45_000,
    depositCents: 0,
  },
  lastName: "Meier",
  firstName: "Anna",
  birthDate: "1990-04-12",
  street: "Bahnhofstrasse 1",
  postalCode: "8001",
  city: "Zürich",
  country: "Switzerland",
  mobile: "+41791234567",
  email: "anna@example.ch",
  gtcAccepted: true,
  gtcVersion: "2026-07-31",
  gtcLanguage: "de",
  acceptedAt: "2026-08-17T08:00:00.000Z",
  place: "Zurich",
};

async function anOrganisation() {
  return prisma.organisation.create({ data: { name: "ZURIAUTO" } });
}

describe("normaliseEmail", () => {
  it("lowercases and trims", () => {
    expect(normaliseEmail("  Anna@Example.CH ")).toBe("anna@example.ch");
  });
});

describe("upsertCustomer", () => {
  it("creates a customer the first time", async () => {
    const org = await anOrganisation();
    const customer = await upsertCustomer(prisma, org.id, base);
    expect(customer.id).toBeTruthy();
    expect(await prisma.customer.count()).toBe(1);
  });

  it("reuses the record when the same person returns", async () => {
    const org = await anOrganisation();
    const first = await upsertCustomer(prisma, org.id, base);
    const second = await upsertCustomer(prisma, org.id, base);
    expect(second.id).toBe(first.id);
    expect(await prisma.customer.count()).toBe(1);
  });

  it("matches regardless of case and surrounding whitespace", async () => {
    const org = await anOrganisation();
    const first = await upsertCustomer(prisma, org.id, base);
    const again = await upsertCustomer(prisma, org.id, {
      ...base,
      email: "  ANNA@Example.ch  ",
    });
    expect(again.id).toBe(first.id);
    expect(await prisma.customer.count()).toBe(1);
  });

  it("updates the name and address from the newest contract", async () => {
    const org = await anOrganisation();
    await upsertCustomer(prisma, org.id, base);
    await upsertCustomer(prisma, org.id, {
      ...base,
      lastName: "Meier-Huber",
      street: "Langstrasse 9",
    });

    const stored = await prisma.customer.findFirstOrThrow();
    expect(stored.lastName).toBe("Meier-Huber");
    expect(stored.street).toBe("Langstrasse 9");
  });

  it("keeps two organisations' customers apart", async () => {
    const a = await anOrganisation();
    const b = await prisma.organisation.create({ data: { name: "OTHER" } });
    const inA = await upsertCustomer(prisma, a.id, base);
    const inB = await upsertCustomer(prisma, b.id, base);
    expect(inB.id).not.toBe(inA.id);
    expect(await prisma.customer.count()).toBe(2);
  });

  it("stores the birth date as the day that was typed", async () => {
    const org = await anOrganisation();
    await upsertCustomer(prisma, org.id, base);
    const stored = await prisma.customer.findFirstOrThrow();
    expect(stored.birthDate.toISOString().slice(0, 10)).toBe("1990-04-12");
  });
});
