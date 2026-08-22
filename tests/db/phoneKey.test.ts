import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { upsertCustomer } from "@/lib/rental/customers";
import type { ContractDetails } from "@/lib/rental/schema";
import { backfillPhoneKeys } from "@/scripts/backfill-phone-keys";
import { ensureOrganisation } from "@/prisma/seed";

const details = {
  firstName: "Anna",
  lastName: "Meier",
  birthDate: "1990-04-12",
  street: "Bahnhofstrasse 1",
  postalCode: "8001",
  city: "Zürich",
  country: "Switzerland",
  mobile: "079 123 45 67",
  email: "anna@example.ch",
} as unknown as ContractDetails;

describe("phoneKey", () => {
  it("is written normalised when a customer is upserted", async () => {
    const org = await ensureOrganisation(prisma);
    await upsertCustomer(prisma, org.id, details);

    const customer = await prisma.customer.findFirstOrThrow();
    // Stored as typed, keyed as normalised — both, because the contract has to
    // print what the customer gave and the lookup has to match across spellings.
    expect(customer.phone).toBe("079 123 45 67");
    expect(customer.phoneKey).toBe("+41791234567");
  });

  it("finds one customer however the returning number is typed", async () => {
    const org = await ensureOrganisation(prisma);
    await upsertCustomer(prisma, org.id, details);

    const found = await prisma.customer.findMany({
      where: { organisationId: org.id, phoneKey: "+41791234567" },
    });
    expect(found).toHaveLength(1);
  });

  it("allows two customers to share one number", async () => {
    // A couple renting on one mobile. The lookup returns both and the staff
    // member picks; a unique constraint here would make that state impossible
    // to record at all.
    const org = await ensureOrganisation(prisma);
    await upsertCustomer(prisma, org.id, details);
    await upsertCustomer(prisma, org.id, {
      ...details,
      firstName: "Peter",
      email: "peter@example.ch",
    } as ContractDetails);

    const found = await prisma.customer.findMany({
      where: { organisationId: org.id, phoneKey: "+41791234567" },
    });
    expect(found).toHaveLength(2);
  });

  it("leaves the key null when the number cannot be normalised", async () => {
    const org = await ensureOrganisation(prisma);
    await upsertCustomer(prisma, org.id, {
      ...details,
      mobile: "ask at the desk",
    } as ContractDetails);

    const customer = await prisma.customer.findFirstOrThrow();
    expect(customer.phoneKey).toBeNull();
  });

  it("backfills rows written before the column existed", async () => {
    const org = await ensureOrganisation(prisma);
    // Simulates a pre-migration row: phone present, key absent.
    await prisma.customer.create({
      data: {
        organisationId: org.id,
        firstName: "Old",
        lastName: "Record",
        email: "old@example.ch",
        phone: "+41 79 999 88 77",
        birthDate: new Date("1980-01-01T00:00:00.000Z"),
        street: "Alte Gasse 2",
        postalCode: "8000",
        city: "Zürich",
        country: "Switzerland",
      },
    });

    expect(await backfillPhoneKeys(prisma)).toBe(1);
    const customer = await prisma.customer.findFirstOrThrow();
    expect(customer.phoneKey).toBe("+41799998877");

    // Idempotent: a second run has nothing left to do.
    expect(await backfillPhoneKeys(prisma)).toBe(0);
  });

  it("records a lookup as a hash, never as a number", async () => {
    await prisma.customerLookup.create({
      data: { phoneHash: "deadbeef", matches: 2 },
    });
    const row = await prisma.customerLookup.findFirstOrThrow();
    expect(row.matches).toBe(2);
    expect(row.phoneHash).toBe("deadbeef");
  });
});
