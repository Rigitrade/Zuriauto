import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { VIEW_COOKIE } from "@/lib/admin/view";
import { CASES, ROUTES, call } from "./adminRoutes";
import { buildCompany, snapshot, type CompanyFixture } from "./companyFixture";

/**
 * Multi-company phase D (16.11.2026): ZURIAUTO's owner looks inside a partner
 * company, read-only (Ahmed's decision of 15.11). While viewing, every office
 * screen reads the partner's records, and every write is refused, whatever
 * route it goes to. A is the oldest company, so the site company (ZURIAUTO);
 * B is the partner.
 */

const viewing = (target: CompanyFixture) => `${VIEW_COOKIE}=${target.organisationId}`;

/** Strings that would only appear if A's own records showed while viewing B. */
function markersOf(f: CompanyFixture): string[] {
  return [f.plate, f.renterLastName, f.carId, f.rentalId, f.contractId, f.fineId, f.paymentId, f.companyPhone];
}

const reading = ROUTES.filter((r) => r.method === "GET" && r.route !== "view");
const writing = ROUTES.filter((r) => r.method !== "GET" && r.route !== "view");

async function startView(as: CompanyFixture, organisationId: string) {
  const { POST } = await import("@/app/api/admin/view/route");
  return POST(
    new Request("https://zuriauto.ch/api/admin/view/", {
      method: "POST",
      headers: { ...as.headers, "content-type": "application/json", origin: "https://zuriauto.ch" },
      body: JSON.stringify({ organisationId }),
    })
  );
}

async function overview(headers: Record<string, string>) {
  const { GET } = await import("@/app/api/admin/overview/route");
  return GET(new Request("https://zuriauto.ch/api/admin/overview/", { headers }));
}

describe("ZURIAUTO views a partner, read-only", () => {
  let a: CompanyFixture;
  let b: CompanyFixture;
  beforeEach(async () => {
    a = await buildCompany("A");
    b = await buildCompany("B");
  });

  it("starts a view: sets the view cookie for the partner", async () => {
    const response = await startView(a, b.organisationId);
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain(`${VIEW_COOKIE}=${b.organisationId}`);
  });

  it.each(reading.map((r) => [`${r.method} ${r.route}`, r] as const))(
    "%s reads the partner's records, never ZURIAUTO's",
    async (_name, route) => {
      const c = CASES[route.route]![route.method]!;
      const response = await call(route, c, a, b, viewing(b));
      // Read, not refused: the partner's record is reached. "partners" is
      // ZURIAUTO's own list, which inside a partner's view is not offered.
      if (route.route === "partners") expect(response.status).toBe(403);
      else expect(response.status, response.text.slice(0, 200)).toBe(200);
      for (const marker of markersOf(a)) {
        expect(response.text.includes(marker), `showed A's ${marker}`).toBe(false);
      }
    }
  );

  it.each(writing.map((r) => [`${r.method} ${r.route}`, r] as const))(
    "%s is refused while viewing, and nothing of either company changes",
    async (_name, route) => {
      const c = CASES[route.route]![route.method]!;
      const beforeA = await snapshot(a);
      const beforeB = await snapshot(b);

      const response = await call(route, c, a, b, viewing(b));

      // 401 from requireAdmin: the view's own refusal, not a validation error
      // or a state conflict that would have refused it anyway.
      expect(response.status, response.text.slice(0, 200)).toBe(401);
      expect(await snapshot(a)).toBe(beforeA);
      expect(await snapshot(b)).toBe(beforeB);
    }
  );

  it("the shell learns it is a view: the partner's name, ZURIAUTO's to go back to", async () => {
    await prisma.organisation.update({ where: { id: a.organisationId }, data: { brandName: "ZURIAUTO" } });
    await prisma.organisation.update({ where: { id: b.organisationId }, data: { brandName: "MEIER CARS" } });

    const response = await overview({ cookie: `${a.headers.cookie}; ${viewing(b)}` });
    const body = (await response.json()) as {
      me: { companyName: string; canManagePartners: boolean; viewing: { ownCompanyName: string } | null };
      cars: { plate: string }[];
    };

    expect(body.me.companyName).toBe("MEIER CARS");
    expect(body.me.viewing).toEqual({ ownCompanyName: "ZURIAUTO" });
    expect(body.me.canManagePartners).toBe(false);
    expect(body.cars.map((car) => car.plate)).toEqual([b.plate]);

    // Without the cookie: ZURIAUTO's own console, as before.
    const own = (await (await overview(a.headers)).json()) as { me: { viewing: unknown; canManagePartners: boolean } };
    expect(own.me.viewing).toBeNull();
    expect(own.me.canManagePartners).toBe(true);
  });

  it("leaving the view clears the cookie", async () => {
    const { DELETE } = await import("@/app/api/admin/view/route");
    const response = await DELETE();
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toMatch(new RegExp(`${VIEW_COOKIE}=;`));
  });

  it("a partner's owner cannot view another company, and a forged view cookie is ignored", async () => {
    expect((await startView(b, a.organisationId)).status).toBe(403);

    const response = await overview({ cookie: `${b.headers.cookie}; ${viewing(a)}` });
    const text = await response.text();
    expect(response.status).toBe(200);
    // And the useless cookie is cleared, so the read-only guard in front of
    // the routes does not keep refusing this account's own saves.
    expect(response.headers.get("set-cookie")).toMatch(new RegExp(`${VIEW_COOKIE}=;`));
    for (const marker of markersOf(a)) expect(text.includes(marker), `leaked ${marker}`).toBe(false);
    expect(text).toContain(b.plate);
  });

  it("ZURIAUTO itself and unknown companies cannot be 'viewed'", async () => {
    expect((await startView(a, a.organisationId)).status).toBe(404);
    expect((await startView(a, "no-such-company")).status).toBe(404);

    // A cookie naming ZURIAUTO or nothing real is ignored: ZURIAUTO's own console.
    for (const target of [a.organisationId, "no-such-company"]) {
      const body = (await (await overview({ cookie: `${a.headers.cookie}; ${VIEW_COOKIE}=${target}` })).json()) as {
        me: { viewing: unknown };
      };
      expect(body.me.viewing).toBeNull();
    }
  });

  it("a damaged view cookie is ignored, not a broken console", async () => {
    const response = await overview({ cookie: `${a.headers.cookie}; ${VIEW_COOKIE}=%E0%A4%A` });
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toMatch(new RegExp(`${VIEW_COOKIE}=;`));
  });

  it("ZURIAUTO staff (not an owner) cannot view a partner", async () => {
    const staff = await prisma.adminUser.create({
      data: { organisationId: a.organisationId, username: "staff-a", displayName: "Staff A", role: "staff", passwordHash: "x" },
    });
    const { ADMIN_COOKIE, issueAdminSession } = await import("@/lib/admin/session");
    const headers = { cookie: `${ADMIN_COOKIE}=${issueAdminSession(staff.id)}` };
    expect((await startView({ ...a, headers }, b.organisationId)).status).toBe(403);
    const text = await (await overview({ cookie: `${headers.cookie}; ${viewing(b)}` })).text();
    expect(text.includes(b.plate)).toBe(false);
  });
});
