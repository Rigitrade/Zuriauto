import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/admin/password";
import { loadCompanyIdentity } from "@/lib/company/load";
import { companyMail } from "@/lib/company/mailEnvelope";
import { partnerForPage } from "@/lib/company/partnerPage";
import { issueFinePaymentToken, resolveFinePaymentToken } from "@/lib/fines/token";
import { generateToken, hashToken } from "@/lib/rental/actionToken";
import { resolveManageToken } from "@/lib/rental/manage";
import { buildCompany, type CompanyFixture } from "./companyFixture";

/**
 * Multi-company phase D (16.11.2026): ZURIAUTO's owner switches a partner off
 * and on, and corrects its details. Switched off: its logins, its renter links
 * and its mails stop; its records stay. Allowed with cars still out (the
 * user's decision of 16.11): the screen warns, the server does not refuse.
 * A is the site company (oldest), B the partner.
 */

const MAIL = { host: "h", port: 587, user: "u", pass: "p", from: "ZURIAUTO <noreply@zuriauto.ch>", office: "office@zuriauto.ch" };

async function patchPartner(as: CompanyFixture, id: string, body: unknown) {
  const { PATCH } = await import("@/app/api/admin/partners/[id]/route");
  return PATCH(
    new Request(`https://zuriauto.ch/api/admin/partners/${id}/`, {
      method: "PATCH",
      headers: { ...as.headers, "content-type": "application/json", origin: "https://zuriauto.ch" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) }
  );
}

async function listPartners(as: CompanyFixture) {
  const { GET } = await import("@/app/api/admin/partners/route");
  const response = await GET(new Request("https://zuriauto.ch/api/admin/partners/", { headers: as.headers }));
  return (await response.json()) as {
    partners: { id: string; slug: string; disabled: boolean; activeRentals: number; name: string; brandName: string | null }[];
  };
}

async function overviewStatus(headers: Record<string, string>) {
  const { GET } = await import("@/app/api/admin/overview/route");
  return (await GET(new Request("https://zuriauto.ch/api/admin/overview/", { headers }))).status;
}

async function fleetStatus(slug: string) {
  const { GET } = await import("@/app/api/fleet/route");
  return (await GET(new Request(`https://zuriauto.ch/api/fleet/?company=${slug}`))).status;
}

async function signIn(username: string, password: string) {
  const { POST } = await import("@/app/api/admin/session/route");
  const response = await POST(
    new Request("https://zuriauto.ch/api/admin/session/", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `10.9.${Math.floor(Math.random() * 250)}.1` },
      body: JSON.stringify({ username, password }),
    })
  );
  return response.status;
}

describe("switching a partner off and on", () => {
  let a: CompanyFixture;
  let b: CompanyFixture;
  beforeEach(async () => {
    a = await buildCompany("A");
    b = await buildCompany("B");
    await prisma.adminUser.update({ where: { id: b.ownerId }, data: { passwordHash: await hashPassword("Partner-Pass-2026") } });
  });

  it("is listed with its running rentals, for the warning before switching off", async () => {
    const listed = (await listPartners(a)).partners.find((p) => p.id === b.organisationId)!;
    expect(listed.disabled).toBe(false);
    expect(listed.activeRentals).toBe(1);
  });

  it("switched off: its sessions, its sign-in, its links and its mails stop; its records stay", async () => {
    expect(await fleetStatus("co-b")).toBe(200);

    const response = await patchPartner(a, b.organisationId, { disabled: true });
    expect(response.status).toBe(200);

    expect(await overviewStatus(b.headers)).toBe(401);
    expect(await signIn("owner-b", "Partner-Pass-2026")).toBe(401);
    expect(await fleetStatus("co-b")).toBe(404);
    expect(await partnerForPage("co-b")).toBeNull();
    const identity = await loadCompanyIdentity(prisma, b.organisationId);
    expect(companyMail({ ...MAIL }, identity)).toBeNull();

    // Records kept, and still listed for ZURIAUTO, marked off.
    expect(await prisma.rental.count({ where: { organisationId: b.organisationId } })).toBe(1);
    expect((await listPartners(a)).partners.find((p) => p.id === b.organisationId)!.disabled).toBe(true);

    // ZURIAUTO is untouched.
    expect(await overviewStatus(a.headers)).toBe(200);
    expect(await fleetStatus("co-a")).toBe(200);
  });

  it("switched off: the links its renters got by email stop working too (manage rental, pay a fine)", async () => {
    const now = new Date("2026-11-16T10:00:00Z");
    await prisma.rental.update({ where: { id: b.rentalId }, data: { endAt: new Date("2026-11-18T09:00:00Z") } });
    const manage = generateToken();
    await prisma.actionToken.create({
      data: {
        organisationId: b.organisationId,
        rentalId: b.rentalId,
        purpose: "MANAGE_RENTAL",
        tokenHash: hashToken(manage),
        expiresAt: new Date("2026-11-30T00:00:00Z"),
      },
    });
    const fine = await prisma.fine.update({
      where: { id: b.fineId },
      data: { status: "NOTIFIED", dueDate: new Date("2026-11-30T00:00:00Z") },
    });
    const pay = await issueFinePaymentToken(prisma, { ...fine, rentalId: b.rentalId }, now);

    // On: both links work (the control).
    expect((await resolveManageToken(prisma, manage, now)).ok).toBe(true);
    expect((await resolveFinePaymentToken(prisma, pay, now)).ok).toBe(true);

    await patchPartner(a, b.organisationId, { disabled: true });

    expect((await resolveManageToken(prisma, manage, now)).ok).toBe(false);
    expect((await resolveFinePaymentToken(prisma, pay, now)).ok).toBe(false);
  });

  it("switched on again: everything works as before", async () => {
    await patchPartner(a, b.organisationId, { disabled: true });
    expect((await patchPartner(a, b.organisationId, { disabled: false })).status).toBe(200);

    expect(await overviewStatus(b.headers)).toBe(200);
    expect(await signIn("owner-b", "Partner-Pass-2026")).toBe(200);
    expect(await fleetStatus("co-b")).toBe(200);
    expect(companyMail({ ...MAIL }, await loadCompanyIdentity(prisma, b.organisationId))).not.toBeNull();
  });

  it("switching off twice keeps the day it was first switched off", async () => {
    await patchPartner(a, b.organisationId, { disabled: true });
    const first = (await prisma.organisation.findUniqueOrThrow({ where: { id: b.organisationId } })).disabledAt;
    await new Promise((resolve) => setTimeout(resolve, 20));
    await patchPartner(a, b.organisationId, { disabled: true });
    const second = (await prisma.organisation.findUniqueOrThrow({ where: { id: b.organisationId } })).disabledAt;
    expect(second?.getTime()).toBe(first?.getTime());
  });

  it("an empty change is refused", async () => {
    expect((await patchPartner(a, b.organisationId, {})).status).toBe(400);
  });

  it("ZURIAUTO itself can never be switched off or changed here", async () => {
    const response = await patchPartner(a, a.organisationId, { disabled: true });
    expect(response.status).toBe(403);
    expect((await prisma.organisation.findUnique({ where: { id: a.organisationId } }))!.disabledAt).toBeNull();
    expect((await patchPartner(a, a.organisationId, { slug: "anders" })).status).toBe(403);
  });

  it("only ZURIAUTO's owner may do it: anyone else gets 'not found'", async () => {
    const response = await patchPartner(b, b.organisationId, { disabled: true });
    expect(response.status).toBe(404);
    expect((await prisma.organisation.findUnique({ where: { id: b.organisationId } }))!.disabledAt).toBeNull();
    expect((await patchPartner(a, "no-such-company", { disabled: true })).status).toBe(404);
  });
});

describe("correcting a partner's details", () => {
  let a: CompanyFixture;
  let b: CompanyFixture;
  beforeEach(async () => {
    a = await buildCompany("A");
    b = await buildCompany("B");
  });

  it("a new short name: the new links work, the old ones answer 'not found'", async () => {
    const response = await patchPartner(a, b.organisationId, { slug: "meier-neu" });
    expect(response.status).toBe(200);
    expect(await fleetStatus("meier-neu")).toBe(200);
    expect(await fleetStatus("co-b")).toBe(404);
    expect((await listPartners(a)).partners.find((p) => p.id === b.organisationId)!.slug).toBe("meier-neu");
  });

  it("the list shows the brand name the partner set itself under Firma", async () => {
    await prisma.organisation.update({ where: { id: b.organisationId }, data: { brandName: "MEIER CARS AG" } });
    const row = (await listPartners(a)).partners.find((p) => p.id === b.organisationId)!;
    expect(row.brandName).toBe("MEIER CARS AG");
  });

  it("names and office email are corrected; the list shows the new brand name", async () => {
    const response = await patchPartner(a, b.organisationId, {
      brandName: "MEIER CARS",
      legalName: "Meier Mietwagen GmbH",
      officeEmail: "buero@meier.test",
    });
    expect(response.status).toBe(200);
    const row = await prisma.organisation.findUniqueOrThrow({ where: { id: b.organisationId } });
    expect([row.name, row.brandName, row.legalName, row.officeEmail]).toEqual([
      "MEIER CARS", "MEIER CARS", "Meier Mietwagen GmbH", "buero@meier.test",
    ]);
  });

  it("a short name already in use, or not allowed, is refused and nothing changes", async () => {
    expect((await patchPartner(a, b.organisationId, { slug: "co-a" })).status).toBe(409);
    expect((await patchPartner(a, b.organisationId, { slug: "admin" })).status).toBe(400);
    expect((await patchPartner(a, b.organisationId, { slug: "Not Valid!" })).status).toBe(400);
    expect((await patchPartner(a, b.organisationId, { officeEmail: "not-an-email" })).status).toBe(400);
    expect((await patchPartner(a, b.organisationId, { brandName: "  " })).status).toBe(400);
    const row = await prisma.organisation.findUniqueOrThrow({ where: { id: b.organisationId } });
    expect(row.slug).toBe("co-b");
    expect(row.officeEmail).toBe("office-b@example.ch");
  });
});
