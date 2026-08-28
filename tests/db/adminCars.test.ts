import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/admin/cars/route";
import { PATCH } from "@/app/api/admin/cars/[id]/route";
import { GET as fleetGet } from "@/app/api/fleet/route";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/admin/password";
import { ADMIN_COOKIE, issueAdminSession } from "@/lib/admin/session";
import { persistPickup, type PickupUpload } from "@/lib/rental/persistPickup";
import type { ContractDetails } from "@/lib/rental/schema";
import { createMemoryStore } from "@/lib/storage";
import { ensureOrganisation, seedFleet } from "@/prisma/seed";

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

async function addRequest(body: unknown, signed = true): Promise<Request> {
  return new Request("https://zuriauto.ch/api/admin/cars/", {
    method: "POST",
    headers: { "content-type": "application/json", ...(signed ? await cookie() : {}) },
    body: JSON.stringify(body),
  });
}

async function patchRequest(body: unknown, signed = true): Promise<Request> {
  return new Request("https://zuriauto.ch/api/admin/cars/x/", {
    method: "PATCH",
    headers: { "content-type": "application/json", ...(signed ? await cookie() : {}) },
    body: JSON.stringify(body),
  });
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

const details: ContractDetails = {
  vehicleId: "prius-zh513925",
  mileageKm: 120_000,
  fuelLevel: "3/4",
  existingDamage: "",
  terms: {
    type: "WEEKLY",
    startAt: "2026-08-17T08:00:00.000Z",
    totalWeeks: 4,
    weeklyAmountCents: 45_000,
    depositCents: 50_000,
  },
  lastName: "Meier",
  firstName: "Anna",
  birthDate: "1990-04-12",
  street: "Bahnhofstrasse 1",
  postalCode: "8001",
  city: "Zürich",
  country: "Switzerland",
  mobile: "079 123 45 67",
  email: "anna@example.ch",
  gtcAccepted: true,
  gtcVersion: "2026-07-31",
  gtcLanguage: "de",
  acceptedAt: "2026-08-17T08:00:00.000Z",
  place: "Zurich",
};

const uploads: PickupUpload[] = [
  { kind: "SIGNATURE", body: new Uint8Array([6]), contentType: "image/png" },
];

async function org() {
  return (await ensureOrganisation(prisma)).id;
}

async function fleetSlugs(): Promise<string[]> {
  // The public picker's default scope: available cars only.
  const body = await (
    await fleetGet(new Request("https://zuriauto.ch/api/fleet/"))
  ).json();
  return body.vehicles.map((v: { id: string }) => v.id);
}

describe("POST /api/admin/cars", () => {
  beforeEach(() => {
    process.env.ADMIN_SECRET = SECRET;
  });

  it("refuses an unfenced request", async () => {
    const response = await POST(
      await addRequest({ model: "Toyota Prius", plate: "ZH 1" }, false)
    );
    expect(response.status).toBe(401);
    expect(await prisma.car.count()).toBe(0);
  });

  it("adds a car with a derived slug, available", async () => {
    await org();
    const response = await POST(
      await addRequest({ model: "Toyota Prius Hybrid", plate: "zh 777 111" })
    );
    expect(response.status).toBe(201);

    const car = await prisma.car.findFirstOrThrow();
    expect(car.slug).toBe("toyota-prius-hybrid-zh777111");
    // Stored as it is worn, not as it was typed.
    expect(car.plate).toBe("ZH 777 111");
    expect(car.status).toBe("available");
    expect(car.vin).toBeNull();
  });

  it("makes the new car offerable at the desk immediately", async () => {
    await org();
    await POST(await addRequest({ model: "VW Golf", plate: "ZH 777 222" }));
    // No deploy, no seed change — the picker reads the table.
    expect(await fleetSlugs()).toContain("vw-golf-zh777222");
  });

  it("answers 409 for a plate already on the fleet", async () => {
    await org();
    await POST(await addRequest({ model: "Toyota Prius", plate: "ZH 777 333" }));
    const again = await POST(
      await addRequest({ model: "Something Else", plate: "ZH 777 333" })
    );
    // A conflict the page can explain, not a 500 from the constraint.
    expect(again.status).toBe(409);
    expect(await prisma.car.count()).toBe(1);
  });

  it("rejects a car with no plate", async () => {
    await org();
    const response = await POST(await addRequest({ model: "Toyota Prius", plate: "" }));
    expect(response.status).toBe(400);
    expect(await prisma.car.count()).toBe(0);
  });
});

describe("PATCH /api/admin/cars/[id]", () => {
  beforeEach(() => {
    process.env.ADMIN_SECRET = SECRET;
  });

  it("refuses an unfenced request", async () => {
    const id = await org();
    await seedFleet(prisma, id);
    const car = await prisma.car.findFirstOrThrow();
    const response = await PATCH(
      await patchRequest({ model: "Hacked" }, false),
      params(car.id)
    );
    expect(response.status).toBe(401);
  });

  it("edits the plate without changing the slug", async () => {
    const id = await org();
    await seedFleet(prisma, id);
    const before = await prisma.car.findFirstOrThrow({
      where: { slug: "prius-zh513925" },
    });

    const response = await PATCH(
      await patchRequest({ plate: "ZH 999 888", vin: "JTDKB20U" }),
      params(before.id)
    );
    expect(response.status).toBe(200);

    const after = await prisma.car.findUniqueOrThrow({ where: { id: before.id } });
    expect(after.plate).toBe("ZH 999 888");
    expect(after.vin).toBe("JTDKB20U");
    // The slug is what a pickup submits as vehicleId, so correcting a typo in
    // a plate must not break contracts in flight.
    expect(after.slug).toBe("prius-zh513925");
  });

  it("takes a car off the road and puts it back", async () => {
    const id = await org();
    await seedFleet(prisma, id);
    const car = await prisma.car.findFirstOrThrow({
      where: { slug: "prius-zh513925" },
    });

    await PATCH(await patchRequest({ status: "retired" }), params(car.id));
    expect(await fleetSlugs()).not.toContain("prius-zh513925");

    await PATCH(await patchRequest({ status: "available" }), params(car.id));
    expect(await fleetSlugs()).toContain("prius-zh513925");
  });

  it("refuses to retire a car that is out on rental", async () => {
    const id = await org();
    await seedFleet(prisma, id);
    await persistPickup({
      organisationId: id,
      details,
      vehicleSlug: details.vehicleId,
      uploads,
      pdf: { body: new Uint8Array([7]) },
      store: createMemoryStore(),
    });
    const car = await prisma.car.findFirstOrThrow({
      where: { slug: "prius-zh513925" },
    });
    expect(car.status).toBe("rented");

    const response = await PATCH(
      await patchRequest({ status: "retired" }),
      params(car.id)
    );
    expect(response.status).toBe(409);
    expect(
      (await prisma.car.findUniqueOrThrow({ where: { id: car.id } })).status
    ).toBe("rented");
  });

  it("refuses to free a rented car by editing its status", async () => {
    const id = await org();
    await seedFleet(prisma, id);
    await persistPickup({
      organisationId: id,
      details,
      vehicleSlug: details.vehicleId,
      uploads,
      pdf: { body: new Uint8Array([7]) },
      store: createMemoryStore(),
    });
    const car = await prisma.car.findFirstOrThrow({
      where: { slug: "prius-zh513925" },
    });

    const response = await PATCH(
      await patchRequest({ status: "available" }),
      params(car.id)
    );
    // Otherwise the picker would offer a car someone is driving.
    expect(response.status).toBe(409);
    expect(await fleetSlugs()).not.toContain("prius-zh513925");
  });

  it("answers 404 for a car that does not exist", async () => {
    await org();
    const response = await PATCH(
      await patchRequest({ model: "Ghost" }),
      params("ckdoesnotexist")
    );
    expect(response.status).toBe(404);
  });

  it("rejects an empty update", async () => {
    const id = await org();
    await seedFleet(prisma, id);
    const car = await prisma.car.findFirstOrThrow();
    const response = await PATCH(await patchRequest({}), params(car.id));
    expect(response.status).toBe(400);
  });
});
