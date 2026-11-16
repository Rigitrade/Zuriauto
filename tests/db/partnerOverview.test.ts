import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { VIEW_COOKIE } from "@/lib/admin/view";
import { buildCompany, type CompanyFixture } from "./companyFixture";

/**
 * The "Partner" page (16.11.2026): ZURIAUTO's owner sees every company side
 * by side (cars and money), and one fleet list across all of them. Read-only,
 * ZURIAUTO's owner only. A is the site company (oldest), B the partner.
 *
 * Each fixture company has one rented car, a running weekly rental with a
 * week of CHF 400 asked for on 02.11, and a fine waiting for review.
 */

interface CompanyRow {
  id: string;
  name: string;
  slug: string | null;
  isSite: boolean;
  disabled: boolean;
  cars: { total: number; available: number; rented: number; maintenance: number; retired: number };
  activeRentals: number;
  returnsToCheck: number;
  owedCents: number;
  owingRentals: number;
  fines: { open: number; overdue: number };
  mfk: { due: number; expired: number };
  service: { due: number; overdue: number };
}

interface FleetCar {
  id: string;
  companyId: string;
  companyName: string;
  model: string;
  plate: string;
  status: string;
  renterName: string | null;
  rentalEndAt: string | null;
  mfkDate: string | null;
}

async function overview(headers: Record<string, string>) {
  const { GET } = await import("@/app/api/admin/partners/overview/route");
  const response = await GET(new Request("https://zuriauto.ch/api/admin/partners/overview/", { headers }));
  return { status: response.status, body: (await response.json()) as { companies: CompanyRow[]; cars: FleetCar[] } };
}

describe("the Partner page: every company side by side", () => {
  let a: CompanyFixture;
  let b: CompanyFixture;
  beforeEach(async () => {
    a = await buildCompany("A");
    b = await buildCompany("B");
    const cutover = new Date("2026-11-01T00:00:00Z");
    await prisma.organisation.updateMany({ data: { paymentsCutoverAt: cutover } });
    await prisma.organisation.update({ where: { id: b.organisationId }, data: { brandName: "MEIER CARS" } });
  });

  it("lists ZURIAUTO first, then each partner, with its cars and money", async () => {
    // B gets a second car: free, with its MFK past, and one retired car.
    await prisma.car.create({
      data: { organisationId: b.organisationId, slug: "b-free", model: "VW Golf", plate: "ZH 9200B3", status: "available", mfkDate: new Date("2026-11-01T00:00:00Z") },
    });
    await prisma.car.create({
      data: { organisationId: b.organisationId, slug: "b-old", model: "Fiat Panda", plate: "ZH 9200B4", status: "retired" },
    });

    const { status, body } = await overview(a.headers);
    expect(status).toBe(200);
    expect(body.companies.map((c) => [c.id, c.isSite])).toEqual([
      [a.organisationId, true],
      [b.organisationId, false],
    ]);

    const meier = body.companies[1];
    expect(meier.name).toBe("MEIER CARS");
    expect(meier.cars).toEqual({ total: 3, available: 1, rented: 1, maintenance: 0, retired: 1 });
    expect(meier.activeRentals).toBe(1);
    expect(meier.owedCents).toBe(40_000);
    expect(meier.owingRentals).toBe(1);
    expect(meier.fines.open).toBe(1);
    // The retired car's MFK does not count; the free car's past one does.
    expect(meier.mfk).toEqual({ due: 0, expired: 1 });
  });

  it("one fleet list across all companies: whose car, who has it", async () => {
    const { body } = await overview(a.headers);
    const meierCar = body.cars.find((car) => car.plate === b.plate)!;
    expect(meierCar.companyId).toBe(b.organisationId);
    expect(meierCar.companyName).toBe("MEIER CARS");
    expect(meierCar.status).toBe("rented");
    expect(meierCar.renterName).toBe(`Bertram ${b.renterLastName}`);
    expect(body.cars.some((car) => car.plate === a.plate)).toBe(true);
  });

  it("a switched-off partner is listed, marked off", async () => {
    await prisma.organisation.update({ where: { id: b.organisationId }, data: { disabledAt: new Date() } });
    const { body } = await overview(a.headers);
    expect(body.companies.find((c) => c.id === b.organisationId)!.disabled).toBe(true);
  });

  it("is ZURIAUTO's owner's alone: a partner's owner, and a view of a partner, are refused", async () => {
    expect((await overview(b.headers)).status).toBe(403);
    expect((await overview({ cookie: `${a.headers.cookie}; ${VIEW_COOKIE}=${b.organisationId}` })).status).toBe(403);
    // ZURIAUTO's own staff, who are not owners, neither.
    const staff = await prisma.adminUser.create({
      data: { organisationId: a.organisationId, username: "staff-a", displayName: "Staff A", role: "staff", passwordHash: "x" },
    });
    const { ADMIN_COOKIE, issueAdminSession } = await import("@/lib/admin/session");
    expect((await overview({ cookie: `${ADMIN_COOKIE}=${issueAdminSession(staff.id)}` })).status).toBe(403);
  });

  it("lists each company's cars in the order its own fleet page shows them", async () => {
    await prisma.car.create({
      data: { organisationId: b.organisationId, slug: "a-first", model: "Mini", plate: "ZH 9200B9", status: "retired" },
    });
    const { body } = await overview(a.headers);
    const meier = body.cars.filter((car) => car.companyId === b.organisationId).map((car) => car.plate);
    // No order set: by slug, as on the fleet page ("a-first" before "car-b").
    expect(meier).toEqual(["ZH 9200B9", b.plate]);
  });
});

describe("a new partner's payments are tracked from its first day", () => {
  it("is created with its payment start set, so what its renters owe shows up", async () => {
    const a = await buildCompany("A");
    const { POST } = await import("@/app/api/admin/partners/route");
    const response = await POST(
      new Request("https://zuriauto.ch/api/admin/partners/", {
        method: "POST",
        headers: { ...a.headers, "content-type": "application/json", origin: "https://zuriauto.ch" },
        body: JSON.stringify({
          brandName: "NEU CARS",
          legalName: "Neu GmbH",
          slug: "neu-cars",
          officeEmail: "office@neu.test",
          owner: { displayName: "Neu", username: "neu-owner", password: "lang-genug-123" },
        }),
      })
    );
    expect(response.status).toBe(201);
    const created = await prisma.organisation.findUniqueOrThrow({ where: { slug: "neu-cars" } });
    expect(created.paymentsCutoverAt).not.toBeNull();
  });
});
