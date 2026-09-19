import { beforeEach, describe, expect, it } from "vitest";
import { PATCH as patchCar } from "@/app/api/admin/cars/[id]/route";
import { POST as postRepair } from "@/app/api/admin/cars/[id]/repairs/route";
import {
  DELETE as deleteRepair,
  PATCH as patchRepair,
} from "@/app/api/admin/cars/[id]/repairs/[repairId]/route";
import { GET as overview } from "@/app/api/admin/overview/route";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/admin/password";
import { ADMIN_COOKIE, issueAdminSession } from "@/lib/admin/session";
import { ensureOrganisation, seedFleet } from "@/prisma/seed";

/**
 * The service book and the repair list.
 *
 * What is worth asserting here is not that a column can be written — Prisma
 * does that — but the three rules that live in the handlers and would be
 * silently wrong if they broke: the mileage read stamp only moves when the
 * reading does, a repair marked done is dated, and a repair cannot be reached
 * through another car's URL.
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

const params = (id: string) => ({ params: Promise.resolve({ id }) });
const repairParams = (id: string, repairId: string) => ({
  params: Promise.resolve({ id, repairId }),
});

async function aCar(slug = "prius-zh513925"): Promise<string> {
  const org = await ensureOrganisation(prisma);
  await seedFleet(prisma, org.id);
  const car = await prisma.car.findFirstOrThrow({
    where: { organisationId: org.id, slug },
    select: { id: true },
  });
  return car.id;
}

async function patchCarWith(id: string, body: unknown) {
  return patchCar(
    new Request(`https://zuriauto.ch/api/admin/cars/${id}/`, {
      method: "PATCH",
      headers: { "content-type": "application/json", ...(await cookie()) },
      body: JSON.stringify(body),
    }),
    params(id)
  );
}

async function addRepairTo(id: string, body: unknown) {
  return postRepair(
    new Request(`https://zuriauto.ch/api/admin/cars/${id}/repairs/`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(await cookie()) },
      body: JSON.stringify(body),
    }),
    params(id)
  );
}

beforeEach(() => {
  process.env.ADMIN_SECRET = SECRET;
});

describe("the service book", () => {
  it("records the figures the fleet screen warns on", async () => {
    const id = await aCar();

    const response = await patchCarWith(id, {
      currentMileageKm: "100'000",
      serviceDoneKm: "97000",
      serviceDueKm: "107000",
      serviceDoneOn: "2026-03-14",
    });

    expect(response.status).toBe(200);
    const car = await prisma.car.findUniqueOrThrow({ where: { id } });
    expect(car.currentMileageKm).toBe(100_000);
    expect(car.serviceDoneKm).toBe(97_000);
    expect(car.serviceDueKm).toBe(107_000);
    expect(car.serviceDoneOn?.toISOString().slice(0, 10)).toBe("2026-03-14");
  });

  it("stamps the read time when the odometer moves", async () => {
    const id = await aCar();
    await patchCarWith(id, { currentMileageKm: "100000" });

    const car = await prisma.car.findUniqueOrThrow({ where: { id } });
    expect(car.mileageReadAt).not.toBeNull();
  });

  it("does not re-date an untouched reading when something else is saved", async () => {
    // The failure this guards: the maintenance dialog posts every field it
    // holds, so correcting an MFK date would otherwise claim a figure read in
    // March was read this morning — the exact lie the column exists to
    // prevent.
    const id = await aCar();
    await patchCarWith(id, { currentMileageKm: "100000" });
    const first = await prisma.car.findUniqueOrThrow({ where: { id } });

    await patchCarWith(id, { currentMileageKm: "100000", mfkDate: "2026-11-30" });
    const second = await prisma.car.findUniqueOrThrow({ where: { id } });

    expect(second.mileageReadAt).toEqual(first.mileageReadAt);
    expect(second.mfkDate?.toISOString().slice(0, 10)).toBe("2026-11-30");
  });

  it("clears the stamp along with the reading", async () => {
    // A read time with no reading describes nothing.
    const id = await aCar();
    await patchCarWith(id, { currentMileageKm: "100000" });
    await patchCarWith(id, { currentMileageKm: "" });

    const car = await prisma.car.findUniqueOrThrow({ where: { id } });
    expect(car.currentMileageKm).toBeNull();
    expect(car.mileageReadAt).toBeNull();
  });

  it("refuses a reading that is not one, without writing anything", async () => {
    const id = await aCar();
    const response = await patchCarWith(id, { currentMileageKm: "about 100k" });

    expect(response.status).toBe(400);
    const car = await prisma.car.findUniqueOrThrow({ where: { id } });
    expect(car.currentMileageKm).toBeNull();
  });
});

describe("repairs", () => {
  it("records a planned repair against the car", async () => {
    const id = await aCar();
    const response = await addRepairTo(id, {
      details: "Windschutzscheibe ersetzen",
    });

    expect(response.status).toBe(201);
    const repair = await prisma.carRepair.findFirstOrThrow();
    expect(repair.carId).toBe(id);
    expect(repair.status).toBe("planned");
    expect(repair.doneOn).toBeNull();
    // Attribution, so a note outlives the account that wrote it.
    expect(repair.createdBy).toBe("ahmed");
  });

  it("dates a repair entered as already done", async () => {
    const id = await aCar();
    await addRepairTo(id, {
      details: "Stossstange, hinten rechts",
      status: "done",
    });

    const repair = await prisma.carRepair.findFirstOrThrow();
    expect(repair.status).toBe("done");
    expect(repair.doneOn).not.toBeNull();
  });

  it("still dates it when the form leaves the date box empty", async () => {
    // What the add form actually sends. An empty string means "clear this",
    // and a cleared date would beat the rule that dates a done repair today —
    // leaving a done repair with no date, which is invisible in a history read
    // as a chronology. The form omits the key instead; this asserts the
    // outcome rather than the mechanism, so either fix keeps it passing.
    const id = await aCar();
    await addRepairTo(id, {
      details: "Bremsen vorne",
      status: "done",
      mileageKm: "",
      costChf: "",
    });

    const repair = await prisma.carRepair.findFirstOrThrow();
    expect(repair.doneOn).not.toBeNull();
  });

  it("dates a planned repair when it is ticked off", async () => {
    // Otherwise a done row with no date is invisible in a history read as a
    // chronology.
    const id = await aCar();
    await addRepairTo(id, { details: "Windschutzscheibe" });
    const before = await prisma.carRepair.findFirstOrThrow();

    const response = await patchRepair(
      new Request("https://zuriauto.ch/", {
        method: "PATCH",
        headers: { "content-type": "application/json", ...(await cookie()) },
        body: JSON.stringify({ status: "done" }),
      }),
      repairParams(id, before.id)
    );

    expect(response.status).toBe(200);
    const after = await prisma.carRepair.findUniqueOrThrow({ where: { id: before.id } });
    expect(after.doneOn).not.toBeNull();
  });

  it("clears the completion date when a repair goes back to planned", async () => {
    const id = await aCar();
    await addRepairTo(id, { details: "Bremsen", status: "done" });
    const repair = await prisma.carRepair.findFirstOrThrow();

    await patchRepair(
      new Request("https://zuriauto.ch/", {
        method: "PATCH",
        headers: { "content-type": "application/json", ...(await cookie()) },
        body: JSON.stringify({ status: "planned" }),
      }),
      repairParams(id, repair.id)
    );

    const after = await prisma.carRepair.findUniqueOrThrow({ where: { id: repair.id } });
    expect(after.status).toBe("planned");
    expect(after.doneOn).toBeNull();
  });

  it("refuses a repair reached through another car's URL", async () => {
    // Harmless today, and the kind of gap that stops being harmless the
    // moment a second organisation exists.
    const mine = await aCar("prius-zh513925");
    const other = await aCar("octavia-zh886530");
    await addRepairTo(mine, { details: "Windschutzscheibe" });
    const repair = await prisma.carRepair.findFirstOrThrow();

    const response = await patchRepair(
      new Request("https://zuriauto.ch/", {
        method: "PATCH",
        headers: { "content-type": "application/json", ...(await cookie()) },
        body: JSON.stringify({ details: "Etwas anderes" }),
      }),
      repairParams(other, repair.id)
    );

    expect(response.status).toBe(404);
    const after = await prisma.carRepair.findUniqueOrThrow({ where: { id: repair.id } });
    expect(after.details).toBe("Windschutzscheibe");
  });

  it("deletes a repair, and says so again if asked twice", async () => {
    const id = await aCar();
    await addRepairTo(id, { details: "Falsches Auto" });
    const repair = await prisma.carRepair.findFirstOrThrow();

    const request = async () =>
      deleteRepair(
        new Request("https://zuriauto.ch/", {
          method: "DELETE",
          headers: await cookie(),
        }),
        repairParams(id, repair.id)
      );

    expect((await request()).status).toBe(200);
    expect(await prisma.carRepair.count()).toBe(0);
    // The second click has nothing to delete. The row is gone either way, but
    // the URL no longer resolves, so 404 is the honest answer.
    expect((await request()).status).toBe(404);
  });

  it("refuses an unsigned caller", async () => {
    const id = await aCar();
    const response = await postRepair(
      new Request("https://zuriauto.ch/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ details: "Windschutzscheibe" }),
      }),
      params(id)
    );

    expect(response.status).toBe(401);
    expect(await prisma.carRepair.count()).toBe(0);
  });
});

describe("the overview payload", () => {
  it("carries each car's repairs, outstanding work first", async () => {
    // Carried with the car rather than fetched per row: ten cars would
    // otherwise mean ten more requests to fill in two lines each.
    const id = await aCar();
    await addRepairTo(id, { details: "Erledigt", status: "done" });
    await addRepairTo(id, { details: "Noch offen" });

    const response = await overview(
      new Request("https://zuriauto.ch/api/admin/overview/", {
        headers: await cookie(),
      })
    );
    const payload = await response.json();
    const car = payload.cars.find((row: { id: string }) => row.id === id);

    expect(car.repairs).toHaveLength(2);
    expect(car.repairs[0].details).toBe("Noch offen");
    expect(car.repairs[0].status).toBe("planned");
  });

  it("reports the service figures as plain numbers", async () => {
    const id = await aCar();
    await patchCarWith(id, { currentMileageKm: "100000", serviceDueKm: "107000" });

    const response = await overview(
      new Request("https://zuriauto.ch/api/admin/overview/", {
        headers: await cookie(),
      })
    );
    const payload = await response.json();
    const car = payload.cars.find((row: { id: string }) => row.id === id);

    expect(car.currentMileageKm).toBe(100_000);
    expect(car.serviceDueKm).toBe(107_000);
    expect(car.mileageReadAt).not.toBeNull();
  });

  it("counts the people waiting for a car", async () => {
    const org = await ensureOrganisation(prisma);
    await prisma.availabilityAlert.create({
      data: {
        organisationId: org.id,
        email: "waiting@example.ch",
        unsubscribeToken: "t".repeat(40),
      },
    });

    const response = await overview(
      new Request("https://zuriauto.ch/api/admin/overview/", {
        headers: await cookie(),
      })
    );
    const payload = await response.json();
    expect(payload.counts.waitingForCar).toBe(1);
  });
});
