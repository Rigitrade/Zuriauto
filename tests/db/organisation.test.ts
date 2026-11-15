import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { organisationBySlug, siteOrganisation } from "@/lib/organisation";

afterEach(() => {
  delete process.env.SITE_ORGANISATION_ID;
});

async function org(name: string, slug: string | null, createdAt: string) {
  return prisma.organisation.create({
    data: { name, slug, createdAt: new Date(createdAt) },
    select: { id: true },
  });
}

describe("siteOrganisation", () => {
  it("takes SITE_ORGANISATION_ID when it is set", async () => {
    await org("ZURIAUTO", "zuriauto", "2026-01-01T00:00:00Z");
    const other = await org("Meier AG", "meier", "2026-02-01T00:00:00Z");
    process.env.SITE_ORGANISATION_ID = other.id;

    expect((await siteOrganisation()).id).toBe(other.id);
  });

  it("otherwise the company with slug zuriauto, though it is not the oldest", async () => {
    await org("Meier AG", "meier", "2025-01-01T00:00:00Z");
    const zuri = await org("ZURIAUTO", "zuriauto", "2026-01-01T00:00:00Z");

    expect((await siteOrganisation()).id).toBe(zuri.id);
  });

  it("otherwise the oldest company", async () => {
    await org("Later", null, "2026-03-01T00:00:00Z");
    const first = await org("First", null, "2026-01-01T00:00:00Z");

    expect((await siteOrganisation()).id).toBe(first.id);
  });
});

describe("organisationBySlug", () => {
  it("finds a company by its slug and returns null for an unknown one", async () => {
    const meier = await org("Meier AG", "meier", "2026-01-01T00:00:00Z");

    expect(await organisationBySlug("meier")).toEqual({ id: meier.id, slug: "meier" });
    expect(await organisationBySlug("nobody")).toBeNull();
  });
});
