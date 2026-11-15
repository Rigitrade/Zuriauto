import { beforeEach, describe, expect, it } from "vitest";
import { GET, PATCH } from "@/app/api/admin/company/route";
import { ADMIN_COOKIE, issueAdminSession } from "@/lib/admin/session";
import { prisma } from "@/lib/db";
import { buildCompany, type CompanyFixture } from "./companyFixture";

/**
 * Multi-company phase B (15.11.2026): a company's owner keeps its details,
 * which every document and mail of the company carries. Its own company only;
 * staff can neither read nor change them.
 */

let a: CompanyFixture;

beforeEach(async () => {
  a = await buildCompany("A");
});

function request(method: "GET" | "PATCH", headers: Record<string, string>, body?: unknown): Request {
  return new Request("https://zuriauto.ch/api/admin/company/", {
    method,
    headers: { ...headers, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function staffHeaders(): Promise<Record<string, string>> {
  const staff = await prisma.adminUser.create({
    data: {
      organisationId: a.organisationId,
      username: "staff-a",
      displayName: "Staff A",
      role: "staff",
      passwordHash: "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAA",
    },
  });
  return { cookie: `${ADMIN_COOKIE}=${issueAdminSession(staff.id)}` };
}

describe("GET /api/admin/company", () => {
  it("shows the owner the company's details and its short name", async () => {
    const response = await GET(request("GET", a.headers));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      name: "Company A",
      slug: "co-a",
      settings: { phone: a.companyPhone, officeEmail: "office-a@example.ch", brandName: null },
    });
  });

  it("is the owner's only", async () => {
    expect((await GET(request("GET", await staffHeaders()))).status).toBe(403);
    expect((await GET(request("GET", {}))).status).toBe(401);
  });
});

describe("PATCH /api/admin/company", () => {
  it("saves the details, trimmed, with blanks as not set", async () => {
    const response = await PATCH(
      request("PATCH", a.headers, {
        brandName: "  MEIER CARS ",
        website: "https://www.Meier-Cars.ch/",
        officeEmail: "Office@Meier.ch ,  buero@meier.ch",
        paymentUrl: "https://pay.example/meier",
        phone: "",
      })
    );

    expect(response.status).toBe(200);
    const row = await prisma.organisation.findUniqueOrThrow({ where: { id: a.organisationId } });
    expect(row).toMatchObject({
      brandName: "MEIER CARS",
      website: "www.meier-cars.ch",
      officeEmail: "office@meier.ch, buero@meier.ch",
      paymentUrl: "https://pay.example/meier",
      phone: null,
    });
  });

  it.each([
    ["a bad office address", { officeEmail: "office@" }],
    ["a payment link that is not https", { paymentUrl: "http://pay.example" }],
    ["a line break in the name", { brandName: "MEIER\r\nBcc: x@evil" }],
    ["a name that is too long", { legalName: "x".repeat(121) }],
    ["the short name, which is Ahmed's to set", { slug: "other" }],
    ["the company name", { name: "Other" }],
  ])("refuses %s and changes nothing", async (_name, body) => {
    const before = await prisma.organisation.findUniqueOrThrow({ where: { id: a.organisationId } });

    const response = await PATCH(request("PATCH", a.headers, body));

    expect(response.status).toBe(400);
    expect(await prisma.organisation.findUniqueOrThrow({ where: { id: a.organisationId } })).toEqual(before);
  });

  it("is the owner's only", async () => {
    const response = await PATCH(request("PATCH", await staffHeaders(), { phone: "+41 1" }));
    expect(response.status).toBe(403);
    expect((await prisma.organisation.findUniqueOrThrow({ where: { id: a.organisationId } })).phone).toBe(a.companyPhone);
  });
});

describe("a partner without an office address (review fix)", () => {
  it("is told on the settings page that it is not the site company", async () => {
    await prisma.organisation.create({ data: { name: "ZURIAUTO", slug: "zuriauto" } });
    const body = await (await GET(request("GET", a.headers))).json();
    expect(body.isSite).toBe(false);
  });

  it("gets its own answer when a contract mail cannot go out for want of one", async () => {
    const env = { SMTP_HOST: "smtp.test", SMTP_USER: "u", SMTP_PASS: "p", MAIL_OFFICE: "info@zuriauto.ch" };
    const saved = Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]]));
    Object.assign(process.env, env);
    try {
      await prisma.organisation.create({ data: { name: "ZURIAUTO", slug: "zuriauto" } });
      await prisma.organisation.update({ where: { id: a.organisationId }, data: { officeEmail: null } });
      const { POST } = await import("@/app/api/admin/contracts/[id]/resend/route");

      const response = await POST(
        new Request("https://zuriauto.ch/api/admin/contracts/x/resend/", {
          method: "POST",
          headers: { ...a.headers, "content-type": "application/json" },
          body: "{}",
        }),
        { params: Promise.resolve({ id: a.contractId }) }
      );

      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ code: "company-office-missing" });
    } finally {
      for (const [key, value] of Object.entries(saved)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });
});
