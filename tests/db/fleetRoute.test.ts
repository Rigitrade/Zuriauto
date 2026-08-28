import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/fleet/route";
import { prisma } from "@/lib/db";
import { ensureOrganisation, seedFleet } from "@/prisma/seed";

/**
 * The picker's two questions, which are not the same question.
 *
 * A pickup offers cars that are free. A return offers the car being handed
 * back, which is by definition *not* free — so the return form asking for the
 * available list would offer every car except the one the customer is
 * standing next to.
 *
 * The bug this pins: the return wizard used to render the hard-coded list in
 * lib/rental/fleet.ts instead of asking at all, so a car added through /admin
 * could never be selected — and since persistReturn finds the rental from the
 * car, it could never be returned either.
 */

function request(url: string): Request {
  return new Request(url);
}

async function seedOrg() {
  const org = await ensureOrganisation(prisma);
  await seedFleet(prisma, org.id);
  return org;
}

describe("GET /api/fleet", () => {
  it("offers only available cars by default", async () => {
    const org = await seedOrg();
    await prisma.car.updateMany({
      where: { organisationId: org.id, slug: "octavia-zh886530" },
      data: { status: "rented" },
    });

    const body = await (await GET(request("https://zuriauto.ch/api/fleet/"))).json();
    const slugs = body.vehicles.map((v: { id: string }) => v.id);

    expect(slugs).toContain("prius-zh513925");
    expect(slugs).not.toContain("octavia-zh886530");
  });

  it("offers the rented cars, and only those, for a return", async () => {
    const org = await seedOrg();
    await prisma.car.updateMany({
      where: { organisationId: org.id, slug: "octavia-zh886530" },
      data: { status: "rented" },
    });

    const body = await (
      await GET(request("https://zuriauto.ch/api/fleet/?scope=return"))
    ).json();
    const slugs = body.vehicles.map((v: { id: string }) => v.id);

    expect(slugs).toEqual(["octavia-zh886530"]);
  });

  it("offers a car added through /admin, in both scopes", async () => {
    // The Mercedes. Not in lib/rental/fleet.ts, so the old return picker
    // could never show it however the fleet was configured.
    const org = await seedOrg();
    await prisma.car.create({
      data: {
        organisationId: org.id,
        slug: "mercedes-zh700100",
        model: "Mercedes A 180",
        plate: "ZH 700 100",
        status: "available",
      },
    });

    const available = await (
      await GET(request("https://zuriauto.ch/api/fleet/"))
    ).json();
    expect(available.vehicles.map((v: { id: string }) => v.id)).toContain(
      "mercedes-zh700100"
    );

    await prisma.car.updateMany({
      where: { organisationId: org.id, slug: "mercedes-zh700100" },
      data: { status: "rented" },
    });

    const returning = await (
      await GET(request("https://zuriauto.ch/api/fleet/?scope=return"))
    ).json();
    expect(returning.vehicles.map((v: { id: string }) => v.id)).toContain(
      "mercedes-zh700100"
    );
  });

  it("never offers a retired car to either scope", async () => {
    const org = await seedOrg();
    await prisma.car.updateMany({
      where: { organisationId: org.id, slug: "prius-zh401859" },
      data: { status: "retired" },
    });

    for (const url of [
      "https://zuriauto.ch/api/fleet/",
      "https://zuriauto.ch/api/fleet/?scope=return",
    ]) {
      const body = await (await GET(request(url))).json();
      expect(body.vehicles.map((v: { id: string }) => v.id)).not.toContain(
        "prius-zh401859"
      );
    }
  });
});
