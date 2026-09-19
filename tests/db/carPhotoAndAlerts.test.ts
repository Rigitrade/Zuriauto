import { beforeEach, describe, expect, it } from "vitest";
import {
  DELETE as deletePhoto,
  PUT as putPhoto,
} from "@/app/api/admin/cars/[id]/photo/route";
import { GET as getPhoto } from "@/app/api/cars/[slug]/photo/route";
import { GET as fleetGet } from "@/app/api/fleet/route";
import { POST as subscribe } from "@/app/api/availability-alerts/route";
import { POST as unsubscribe } from "@/app/api/availability-alerts/unsubscribe/route";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/admin/password";
import { ADMIN_COOKIE, issueAdminSession } from "@/lib/admin/session";
import { ensureOrganisation, seedFleet } from "@/prisma/seed";

/**
 * Car photographs, and the waiting list.
 *
 * Two features that meet in one place: when the fleet endpoint returns
 * nothing, the page shows the waiting-list form instead of the picker, and
 * when it returns something the picker needs each car's photograph URL.
 */

const SECRET = "test-admin-secret";
/** A one-pixel PNG. Enough to be real bytes with a real content type. */
const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);

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

const params = (id: string) => ({ params: Promise.resolve({ id }) });
const slugParams = (slug: string) => ({ params: Promise.resolve({ slug }) });

async function aCar(): Promise<{ id: string; slug: string }> {
  const org = await ensureOrganisation(prisma);
  await seedFleet(prisma, org.id);
  return prisma.car.findFirstOrThrow({
    where: { organisationId: org.id, slug: "prius-zh513925" },
    select: { id: true, slug: true },
  });
}

async function upload(id: string, contentType = "image/png", body = PNG) {
  return putPhoto(
    new Request(`https://zuriauto.ch/api/admin/cars/${id}/photo/`, {
      method: "PUT",
      headers: { "content-type": contentType, ...(await cookie()) },
      body,
    }),
    params(id)
  );
}

beforeEach(() => {
  process.env.ADMIN_SECRET = SECRET;
});

describe("a car's photograph", () => {
  it("is stored and then served to anybody", async () => {
    // Public on purpose, unlike an identity document: the pickup form is
    // filled in by a customer signed into nothing.
    const car = await aCar();
    expect((await upload(car.id)).status).toBe(200);

    const served = await getPhoto(
      new Request(`https://zuriauto.ch/api/cars/${car.slug}/photo/`),
      slugParams(car.slug)
    );
    expect(served.status).toBe(200);
    expect(served.headers.get("content-type")).toBe("image/png");
  });

  it("refuses a format this endpoint will not serve back", async () => {
    // An SVG is a document that can carry script, and these bytes are served
    // from the company's own origin.
    const car = await aCar();
    const response = await upload(car.id, "image/svg+xml");

    expect(response.status).toBe(415);
    const row = await prisma.car.findUniqueOrThrow({ where: { id: car.id } });
    expect(row.photoKey).toBeNull();
  });

  it("refuses an unsigned upload", async () => {
    const car = await aCar();
    const response = await putPhoto(
      new Request("https://zuriauto.ch/", {
        method: "PUT",
        headers: { "content-type": "image/png" },
        body: PNG,
      }),
      params(car.id)
    );
    expect(response.status).toBe(401);
  });

  it("gets a new key on replacement, so no cache can hold the old one", async () => {
    const car = await aCar();
    await upload(car.id);
    const first = await prisma.car.findUniqueOrThrow({ where: { id: car.id } });

    await upload(car.id, "image/jpeg");
    const second = await prisma.car.findUniqueOrThrow({ where: { id: car.id } });

    expect(second.photoKey).not.toBe(first.photoKey);
    expect(second.photoContentType).toBe("image/jpeg");
  });

  it("answers 304 when the browser already holds that version", async () => {
    const car = await aCar();
    await upload(car.id);
    const row = await prisma.car.findUniqueOrThrow({ where: { id: car.id } });
    const etag = `"${row.photoUpdatedAt?.getTime()}"`;

    const response = await getPhoto(
      new Request(`https://zuriauto.ch/api/cars/${car.slug}/photo/`, {
        headers: { "if-none-match": etag },
      }),
      slugParams(car.slug)
    );
    expect(response.status).toBe(304);
  });

  it("is removable, and is then simply not there", async () => {
    const car = await aCar();
    await upload(car.id);

    const removed = await deletePhoto(
      new Request("https://zuriauto.ch/", { method: "DELETE", headers: await cookie() }),
      params(car.id)
    );
    expect(removed.status).toBe(200);

    const served = await getPhoto(
      new Request(`https://zuriauto.ch/api/cars/${car.slug}/photo/`),
      slugParams(car.slug)
    );
    expect(served.status).toBe(404);
  });

  it("says nothing about a car that has none, or one that does not exist", async () => {
    const car = await aCar();
    // One answer for both: enumerating slugs should not report which exist.
    for (const slug of [car.slug, "no-such-car-zh000000"]) {
      const response = await getPhoto(
        new Request(`https://zuriauto.ch/api/cars/${slug}/photo/`),
        slugParams(slug)
      );
      expect(response.status).toBe(404);
    }
  });

  it("reaches the picker through the fleet listing", async () => {
    const car = await aCar();
    await upload(car.id);

    const response = await fleetGet(new Request("https://zuriauto.ch/api/fleet/"));
    const { vehicles } = await response.json();
    const entry = vehicles.find((v: { id: string }) => v.id === car.slug);

    // Version-stamped, which is what lets the photo endpoint cache for a year.
    expect(entry.photoUrl).toContain(`/api/cars/${car.slug}/photo/?v=`);
    // A car without one carries no field at all, rather than a URL that 404s.
    const other = vehicles.find((v: { id: string }) => v.id !== car.slug);
    expect(other.photoUrl).toBeUndefined();
  });
});

describe("the waiting list", () => {
  async function post(body: unknown) {
    return subscribe(
      new Request("https://zuriauto.ch/api/availability-alerts/", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "10.0.0.1" },
        body: JSON.stringify(body),
      })
    );
  }

  it("records an address", async () => {
    await ensureOrganisation(prisma);
    expect((await post({ email: "Hopeful@Example.CH" })).status).toBe(200);

    const row = await prisma.availabilityAlert.findFirstOrThrow();
    // Lowercased, so the casing somebody typed cannot open a second row.
    expect(row.email).toBe("hopeful@example.ch");
    expect(row.notifiedAt).toBeNull();
    expect(row.unsubscribeToken.length).toBeGreaterThan(20);
  });

  it("treats asking twice as asking once", async () => {
    await ensureOrganisation(prisma);
    await post({ email: "hopeful@example.ch" });
    await post({ email: "hopeful@example.ch" });

    expect(await prisma.availabilityAlert.count()).toBe(1);
  });

  it("stores nothing a crafted request adds", async () => {
    await ensureOrganisation(prisma);
    await post({ email: "hopeful@example.ch", notifiedAt: "2020-01-01T00:00:00Z" });

    const row = await prisma.availabilityAlert.findFirstOrThrow();
    expect(row.notifiedAt).toBeNull();
  });

  it("refuses something that is not an address", async () => {
    await ensureOrganisation(prisma);
    expect((await post({ email: "not-an-address" })).status).toBe(400);
    expect(await prisma.availabilityAlert.count()).toBe(0);
  });

  it("revives a cancelled row rather than leaving it silent", async () => {
    // Somebody who unsubscribed in March and asks again in September is
    // making a new request. A row left cancelled would never be written to,
    // having just promised them it would be.
    await ensureOrganisation(prisma);
    await post({ email: "hopeful@example.ch" });
    await prisma.availabilityAlert.updateMany({ data: { cancelledAt: new Date() } });

    await post({ email: "hopeful@example.ch" });
    const row = await prisma.availabilityAlert.findFirstOrThrow();
    expect(row.cancelledAt).toBeNull();
  });

  it("unsubscribes on the token, and says yes again on a second click", async () => {
    await ensureOrganisation(prisma);
    await post({ email: "hopeful@example.ch" });
    const row = await prisma.availabilityAlert.findFirstOrThrow();

    const click = async () =>
      unsubscribe(
        new Request("https://zuriauto.ch/api/availability-alerts/unsubscribe/", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token: row.unsubscribeToken }),
        })
      );

    expect((await click()).status).toBe(200);
    expect(
      (await prisma.availabilityAlert.findUniqueOrThrow({ where: { id: row.id } }))
        .cancelledAt
    ).not.toBeNull();
    // Clicking twice got them what they wanted both times.
    expect((await click()).status).toBe(200);
  });

  it("refuses an unknown token", async () => {
    await ensureOrganisation(prisma);
    const response = await unsubscribe(
      new Request("https://zuriauto.ch/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: "x".repeat(40) }),
      })
    );
    expect(response.status).toBe(404);
  });
});
