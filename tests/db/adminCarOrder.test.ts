import { beforeEach, describe, expect, it } from "vitest";
import { PUT } from "@/app/api/admin/cars/order/route";
import { GET as overviewGet } from "@/app/api/admin/overview/route";
import { GET as fleetGet } from "@/app/api/fleet/route";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/admin/password";
import { ADMIN_COOKIE, issueAdminSession } from "@/lib/admin/session";
import { ensureOrganisation, seedFleet } from "@/prisma/seed";

/**
 * The office's order of the fleet (owner, 16.10.2026): dragged into place on
 * the vehicles screen, and the order the pickup form's car list follows.
 */

const SECRET = "test-admin-secret";

async function cookie(): Promise<Record<string, string>> {
  const org = await ensureOrganisation(prisma);
  const user = await prisma.adminUser.upsert({
    where: { organisationId_username: { organisationId: org.id, username: "ahmed" } },
    update: {},
    create: {
      organisationId: org.id,
      username: "ahmed",
      displayName: "Eng Ahmed",
      role: "staff",
      passwordHash: await hashPassword("Sommer2026!"),
    },
    select: { id: true },
  });
  return { cookie: `${ADMIN_COOKIE}=${issueAdminSession(user.id)}` };
}

async function orderRequest(body: unknown, signed = true): Promise<Request> {
  return new Request("https://zuriauto.ch/api/admin/cars/order/", {
    method: "PUT",
    headers: { "content-type": "application/json", ...(signed ? await cookie() : {}) },
    body: JSON.stringify(body),
  });
}

async function seeded() {
  const org = await ensureOrganisation(prisma);
  await seedFleet(prisma, org.id);
  const cars = await prisma.car.findMany({
    orderBy: { slug: "asc" },
    select: { id: true, slug: true },
  });
  return { org, cars };
}

/** The pickup form's list, as it arrives. */
async function pickupSlugs(): Promise<string[]> {
  const body = await (await fleetGet(new Request("https://zuriauto.ch/api/fleet/"))).json();
  return body.vehicles.map((v: { id: string }) => v.id);
}

describe("PUT /api/admin/cars/order", () => {
  beforeEach(() => {
    process.env.ADMIN_SECRET = SECRET;
  });

  it("refuses a request with no session", async () => {
    const { cars } = await seeded();
    const response = await PUT(await orderRequest({ ids: cars.map((c) => c.id) }, false));
    expect(response.status).toBe(401);
  });

  it("puts the pickup form's car list in the office's order", async () => {
    const { cars } = await seeded();
    // The last car first, then the rest: an order no sort by slug or plate gives.
    const wanted = [cars[cars.length - 1], ...cars.slice(0, -1)];

    const response = await PUT(await orderRequest({ ids: wanted.map((c) => c.id) }));

    expect(response.status).toBe(200);
    expect(await pickupSlugs()).toEqual(wanted.map((c) => c.slug));
  });

  it("shows the vehicles screen in the same order", async () => {
    const { cars } = await seeded();
    const wanted = [...cars].reverse();
    await PUT(await orderRequest({ ids: wanted.map((c) => c.id) }));

    const signed = new Request("https://zuriauto.ch/api/admin/overview/", {
      headers: await cookie(),
    });
    const body = await (await overviewGet(signed)).json();
    expect(body.cars.map((c: { id: string }) => c.id)).toEqual(wanted.map((c) => c.id));
  });

  it("keeps the order for the cars it offers, skipping the ones it does not", async () => {
    const { cars } = await seeded();
    const wanted = [...cars].reverse();
    await PUT(await orderRequest({ ids: wanted.map((c) => c.id) }));
    await prisma.car.update({ where: { id: wanted[1].id }, data: { status: "maintenance" } });

    expect(await pickupSlugs()).toEqual(
      wanted.filter((_, i) => i !== 1).map((c) => c.slug)
    );
  });

  it("puts a car added after the ordering at the end", async () => {
    const { org, cars } = await seeded();
    await PUT(await orderRequest({ ids: cars.map((c) => c.id) }));
    // A slug that sorts first, so only the order can put it last.
    await prisma.car.create({
      data: { organisationId: org.id, slug: "aaa-new", model: "Toyota Prius", plate: "ZH 1" },
    });

    const slugs = await pickupSlugs();
    expect(slugs[slugs.length - 1]).toBe("aaa-new");
    expect(slugs.slice(0, -1)).toEqual(cars.map((c) => c.slug));
  });

  it("refuses a list that is not the whole fleet once each, and changes nothing", async () => {
    const { cars } = await seeded();
    const ids = cars.map((c) => c.id);
    for (const wrong of [
      ids.slice(1), // one car left out
      [...ids, ids[0]], // one car twice
      [...ids.slice(1), "not-a-car"], // a car that does not exist
    ]) {
      const response = await PUT(await orderRequest({ ids: wrong }));
      expect(response.status).toBe(409);
    }
    for (const malformed of [{}, { ids: "x" }, { ids: [1, 2] }]) {
      expect((await PUT(await orderRequest(malformed))).status).toBe(400);
    }
    const ordered = await prisma.car.count({ where: { sortOrder: { not: null } } });
    expect(ordered).toBe(0);
  });
});
