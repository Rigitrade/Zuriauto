import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { seedOrganisation } from "./fineHelpers";

/**
 * The two uniqueness rules the fines flow leans on, held by the database
 * rather than by a check-then-insert that two requests can both pass.
 */

async function document(organisationId: string, sha256: string, storageKey: string) {
  return prisma.fineDocument.create({
    data: {
      organisationId,
      storageKey,
      sha256,
      bytes: 1000,
      pages: 1,
      uploadedById: "u1",
      uploadedByName: "Office",
    },
  });
}

function code(error: unknown): string | undefined {
  return (error as { code?: string }).code;
}

describe("fines schema", () => {
  it("refuses the same scan twice in one organisation", async () => {
    const org = await seedOrganisation();
    await document(org.id, "abc", "fines/1/letter.pdf");
    const second = await document(org.id, "abc", "fines/2/letter.pdf").catch((e) => e);
    expect(code(second)).toBe("P2002");
  });

  it("refuses two fines with the same issuer and number", async () => {
    const org = await seedOrganisation();
    const data = { organisationId: org.id, issuerIban: "CH2430000001800000803", fineNumber: "830557506 017 4" };
    await prisma.fine.create({ data });
    const second = await prisma.fine.create({ data }).catch((e) => e);
    expect(code(second)).toBe("P2002");
  });

  it("allows any number of fines whose number is unknown", async () => {
    const org = await seedOrganisation();
    await prisma.fine.create({ data: { organisationId: org.id, issuerIban: "CH24", fineNumber: null } });
    await prisma.fine.create({ data: { organisationId: org.id, issuerIban: "CH24", fineNumber: null } });
    await prisma.fine.create({ data: { organisationId: org.id, issuerIban: null, fineNumber: "1" } });
    await prisma.fine.create({ data: { organisationId: org.id, issuerIban: null, fineNumber: "1" } });
    expect(await prisma.fine.count()).toBe(4);
  });
});
