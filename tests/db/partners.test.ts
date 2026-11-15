import { beforeEach, describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/admin/partners/route";
import { POST as SIGN_IN } from "@/app/api/admin/session/route";
import { GET as COMPANY } from "@/app/api/admin/company/route";
import { GET as OVERVIEW } from "@/app/api/admin/overview/route";
import { ADMIN_COOKIE, issueAdminSession } from "@/lib/admin/session";
import { prisma } from "@/lib/db";

/**
 * Creating a partner company from Konten (15.11.2026). Only ZURIAUTO's owner
 * may; the new company gets its owner account and the minimum its documents
 * and mails need, and its owner fills in the rest under Firma.
 */

const HASH = "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAA";

let site: { id: string };
let siteOwner: Record<string, string>;
let siteStaff: Record<string, string>;

async function account(organisationId: string, username: string, role: "owner" | "staff") {
  const user = await prisma.adminUser.create({
    data: { organisationId, username, displayName: username, role, passwordHash: HASH },
  });
  return { cookie: `${ADMIN_COOKIE}=${issueAdminSession(user.id)}` };
}

beforeEach(async () => {
  site = await prisma.organisation.create({ data: { name: "ZURIAUTO", slug: "zuriauto" } });
  siteOwner = await account(site.id, "chef", "owner");
  siteStaff = await account(site.id, "office", "staff");
});

const meier = {
  brandName: "MEIER CARS",
  legalName: "Meier Mietwagen GmbH",
  slug: "meier",
  officeEmail: "office@meier-cars.ch",
  owner: { displayName: "Hans Meier", username: "meier", password: "lang-genug-123" },
};

function post(headers: Record<string, string>, body: unknown): Request {
  return new Request("https://zuriauto.ch/api/admin/partners/", {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const get = (headers: Record<string, string>) =>
  new Request("https://zuriauto.ch/api/admin/partners/", { headers });

describe("POST /api/admin/partners", () => {
  it("creates the company with its minimum details and its owner, who can sign in", async () => {
    const response = await POST(post(siteOwner, meier));

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toMatchObject({ partner: { name: "MEIER CARS", slug: "meier" }, owner: { username: "meier" } });

    const org = await prisma.organisation.findUniqueOrThrow({ where: { slug: "meier" } });
    expect(org).toMatchObject({
      name: "MEIER CARS",
      brandName: "MEIER CARS",
      legalName: "Meier Mietwagen GmbH",
      officeEmail: "office@meier-cars.ch",
    });
    const owner = await prisma.adminUser.findUniqueOrThrow({ where: { username: "meier" } });
    expect(owner).toMatchObject({ organisationId: org.id, role: "owner", displayName: "Hans Meier" });
    expect(owner.passwordHash).not.toContain("lang-genug-123");

    const signIn = await SIGN_IN(
      new Request("https://zuriauto.ch/api/admin/session/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "meier", password: "lang-genug-123" }),
      })
    );
    expect(signIn.status).toBe(200);
    const cookie = signIn.headers.get("set-cookie")!.split(";")[0];

    // The new owner lands in its own company, which is not the site company.
    const company = await (await COMPANY(new Request("https://zuriauto.ch/api/admin/company/", { headers: { cookie } }))).json();
    expect(company).toMatchObject({ name: "MEIER CARS", slug: "meier", isSite: false });
  });

  it("is ZURIAUTO's owner's only: not its staff, not a partner's owner, not signed out", async () => {
    await POST(post(siteOwner, meier));
    const partnerOwner = await account(
      (await prisma.organisation.findUniqueOrThrow({ where: { slug: "meier" } })).id,
      "meier-2",
      "owner"
    );
    const other = { ...meier, slug: "other", owner: { ...meier.owner, username: "other-owner" } };

    expect((await POST(post(siteStaff, other))).status).toBe(403);
    expect((await POST(post(partnerOwner, other))).status).toBe(403);
    expect((await POST(post({}, other))).status).toBe(401);
    expect(await prisma.organisation.count({ where: { slug: "other" } })).toBe(0);
  });

  it("refuses a short name another company has, and creates nothing", async () => {
    const response = await POST(post(siteOwner, { ...meier, slug: "zuriauto" }));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ code: "slug-taken" });
    expect(await prisma.organisation.count()).toBe(1);
    expect(await prisma.adminUser.count({ where: { username: "meier" } })).toBe(0);
  });

  it("refuses a username any company has, and leaves no company without an owner", async () => {
    const response = await POST(post(siteOwner, { ...meier, owner: { ...meier.owner, username: "chef" } }));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ code: "username-taken" });
    expect(await prisma.organisation.count({ where: { slug: "meier" } })).toBe(0);
  });

  it("names the fields that are missing or wrong", async () => {
    const response = await POST(post(siteOwner, { ...meier, officeEmail: "", owner: { ...meier.owner, password: "kurz" } }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe("invalid");
    expect(body.fields.sort()).toEqual(["officeEmail", "owner.password"]);
  });
});

describe("GET /api/admin/partners", () => {
  it("lists the partner companies with their owners, without ZURIAUTO itself", async () => {
    await POST(post(siteOwner, meier));

    const response = await GET(get(siteOwner));

    expect(response.status).toBe(200);
    const { partners } = await response.json();
    expect(partners).toHaveLength(1);
    expect(partners[0]).toMatchObject({
      name: "MEIER CARS",
      slug: "meier",
      legalName: "Meier Mietwagen GmbH",
      officeEmail: "office@meier-cars.ch",
      owners: [{ username: "meier", displayName: "Hans Meier" }],
      cars: 0,
    });
    expect(JSON.stringify(partners)).not.toContain("passwordHash");
  });

  it("is ZURIAUTO's owner's only", async () => {
    await POST(post(siteOwner, meier));
    const partnerOwner = await account(
      (await prisma.organisation.findUniqueOrThrow({ where: { slug: "meier" } })).id,
      "meier-2",
      "owner"
    );
    expect((await GET(get(siteStaff))).status).toBe(403);
    expect((await GET(get(partnerOwner))).status).toBe(403);
    expect((await GET(get({}))).status).toBe(401);
  });
});

describe("the console knows who may create partners", () => {
  const me = async (headers: Record<string, string>) =>
    (await (await OVERVIEW(new Request("https://zuriauto.ch/api/admin/overview/", { headers }))).json()).me;

  it("only ZURIAUTO's owner", async () => {
    await POST(post(siteOwner, meier));
    const partnerOwner = await account(
      (await prisma.organisation.findUniqueOrThrow({ where: { slug: "meier" } })).id,
      "meier-2",
      "owner"
    );

    expect((await me(siteOwner)).canManagePartners).toBe(true);
    expect((await me(siteStaff)).canManagePartners).toBe(false);
    expect((await me(partnerOwner)).canManagePartners).toBe(false);
  });
});
