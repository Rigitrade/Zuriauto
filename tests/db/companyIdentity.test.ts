import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { publicCompany, ZURIAUTO_IDENTITY } from "@/lib/company/identity";
import { loadCompanyIdentity } from "@/lib/company/load";
import { prisma } from "@/lib/db";

/** Multi-company phase B (15.11.2026): each company's identity from its row. */

describe("loadCompanyIdentity", () => {
  it("gives the site company ZURIAUTO's identity, even before its settings are filled", async () => {
    const zuri = await prisma.organisation.create({ data: { name: "ZURIAUTO", slug: "zuriauto" } });

    expect(await loadCompanyIdentity(prisma, zuri.id)).toEqual(ZURIAUTO_IDENTITY);
  });

  it("gives a partner its own values and powered by ZURIAUTO", async () => {
    await prisma.organisation.create({ data: { name: "ZURIAUTO", slug: "zuriauto" } });
    const meier = await prisma.organisation.create({
      data: {
        name: "Meier Mietwagen GmbH",
        slug: "meier",
        brandName: "MEIER CARS",
        city: "Winterthur",
        officeEmail: "office@meier.example",
      },
    });

    const id = await loadCompanyIdentity(prisma, meier.id);

    expect(id).toMatchObject({
      brandName: "MEIER CARS",
      legalName: "Meier Mietwagen GmbH",
      signingPlace: "Winterthur",
      officeEmail: "office@meier.example",
      paymentUrl: null,
      poweredBy: true,
    });
  });

  it("the migration fills ZURIAUTO's row with exactly the values the code falls back to", async () => {
    const zuri = await prisma.organisation.create({ data: { name: "ZURIAUTO", slug: "zuriauto" } });
    const sql = readFileSync("prisma/migrations/20261115140000_company_identity/migration.sql", "utf8");
    const update = sql.slice(sql.indexOf("UPDATE"));

    await prisma.$executeRawUnsafe(update);

    const row = await prisma.organisation.findUniqueOrThrow({ where: { id: zuri.id } });
    expect(row.brandName).toBe("ZURIAUTO");
    expect(row.officeEmail).toBeNull();
    expect(await loadCompanyIdentity(prisma, zuri.id)).toEqual(ZURIAUTO_IDENTITY);
  });

  it("refuses an unknown company rather than printing ZURIAUTO for it", async () => {
    await expect(loadCompanyIdentity(prisma, "missing")).rejects.toThrow(/missing/);
  });
});

describe("GET /api/fleet", () => {
  it("tells the forms which company they serve, and nothing more than they print", async () => {
    await prisma.organisation.create({ data: { name: "ZURIAUTO", slug: "zuriauto", phone: "+41 1" } });
    const { GET } = await import("@/app/api/fleet/route");

    const body = await (await GET(new Request("https://zuriauto.ch/api/fleet/"))).json();

    expect(body.company).toEqual(publicCompany(ZURIAUTO_IDENTITY));
  });
});
