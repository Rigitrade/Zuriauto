import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { POST as importList } from "@/app/api/admin/fines/legacy/route";
import { GET as list } from "@/app/api/admin/fines/route";
import { GET as detail } from "@/app/api/admin/fines/[id]/route";
import { GET as history } from "@/app/api/admin/cars/[id]/history/route";
import { adminCookie, seedOrganisation } from "./fineHelpers";

/**
 * The office's fines list from before the system, taken over as closed
 * history (lib/fines/legacy.ts), and where it then answers "who drove".
 * Names made up; rows shaped like the real list of 13.11.2026.
 */

const LIST = [
  "Kennzeichen;Datum;Zeit;Betrag;Ort;Fahrer;Nummer;Vergehen;Telefon",
  "ZH 919 906;15.07.2026;21.55;40;Kaiserstuhlstr. Oberglatt;Ted;8205323060121;55/50 kmh;044 411 76 76",
  "ZH 919 906;27.05.2026;01.59;40;Sihlquai Wipkingerbrücke;Kraz;2603266070678;37/30 kmh;044 411 76 76",
  "ZH 589 864;10.05.2026;02.06;40+90;Buchs ZH Zürcherstrasse;Ted;ST.2026.5418/DK;55/50 kmh;043 258 16 40",
].join("\n");

function send(body: unknown, cookie?: string) {
  return importList(
    new Request("https://www.zuriauto.ch/api/admin/fines/legacy/", {
      method: "POST",
      headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
      body: JSON.stringify(body),
    })
  );
}

const get = (url: string, cookie: string) => new Request(`https://www.zuriauto.ch${url}`, { headers: { cookie } });
const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe("POST /api/admin/fines/legacy", () => {
  it("is for the office only", async () => {
    await seedOrganisation();
    expect((await send({ text: LIST, dry: false })).status).toBe(401);
  });

  it("checks without writing, then writes closed fines with the driver", async () => {
    await seedOrganisation();
    const cookie = await adminCookie();

    const checked = await (await send({ text: LIST, name: "Bussenliste.csv", dry: true }, cookie)).json();
    expect(checked).toMatchObject({ imported: 3, already: 0, problems: [] });
    expect(checked.preview.map((r: { driver: string }) => r.driver)).toEqual(["Ted", "Kraz", "Ted"]);
    expect(await prisma.fine.count()).toBe(0);

    const done = await (await send({ text: LIST, name: "Bussenliste.csv", dry: false }, cookie)).json();
    expect(done).toMatchObject({ imported: 3, problems: [] });

    const fines = await prisma.fine.findMany({ orderBy: { violationAt: "asc" }, include: { car: true } });
    expect(fines.map((f) => [f.car?.plate, f.legacyDriverName, f.status, f.amountCents])).toEqual([
      ["ZH 589 864", "Ted", "HANDLED_OTHERWISE", null],
      ["ZH 919 906", "Kraz", "HANDLED_OTHERWISE", 4000],
      ["ZH 919 906", "Ted", "HANDLED_OTHERWISE", 4000],
    ]);
    expect(fines[0]).toMatchObject({ legacySource: "list:Bussenliste.csv", speedMeasuredKmh: 55, speedLimitKmh: 50 });
    expect(fines[0].closedNote).toContain("Betrag laut Liste: 40+90");
    // Nothing that counts as a letter, and nothing sent.
    expect(await prisma.fineEvent.count({ where: { type: "fine.created" } })).toBe(0);
    expect(await prisma.fineNotification.count()).toBe(0);
  });

  it("adds nothing the second time", async () => {
    await seedOrganisation();
    const cookie = await adminCookie();
    await send({ text: LIST, dry: false }, cookie);
    const again = await (await send({ text: LIST, dry: false }, cookie)).json();
    expect(again).toMatchObject({ imported: 0, already: 3 });
    expect(await prisma.fine.count()).toBe(3);
  });

  it("writes nothing while a row names a car not in the fleet", async () => {
    await seedOrganisation();
    const cookie = await adminCookie();
    const result = await (await send({ text: `${LIST}\nZH 111 111;01.07.2026;10:00;40;x;Al;1;x;`, dry: false }, cookie)).json();
    expect(result.problems).toEqual([{ line: 5, reason: "unknown-plate", value: "ZH 111 111" }]);
    expect(result.imported).toBe(0);
    expect(await prisma.fine.count()).toBe(0);
  });
});

describe("where the old list answers who drove", () => {
  it("names the driver in the fines list, marked as old data", async () => {
    await seedOrganisation();
    const cookie = await adminCookie();
    await send({ text: LIST, dry: false }, cookie);
    const body = await (await list(get("/api/admin/fines/?tab=all", cookie))).json();
    expect(body.fines).toHaveLength(3);
    expect(body.fines.every((f: { legacy: boolean }) => f.legacy)).toBe(true);
    expect(body.fines.map((f: { renterName: string }) => f.renterName)).toContain("Kraz");
    // Closed history is not something to review.
    expect((await (await list(get("/api/admin/fines/?tab=review", cookie))).json()).fines).toEqual([]);
  });

  it("shows who drove on the car's history, inside the window asked", async () => {
    await seedOrganisation();
    const cookie = await adminCookie();
    await send({ text: LIST, dry: false }, cookie);
    const car = await prisma.car.findFirstOrThrow({ where: { plate: "ZH 919 906" } });

    const all = await (await history(get(`/api/admin/cars/${car.id}/history/`, cookie), params(car.id))).json();
    expect(all.sightings.map((s: { driver: string }) => s.driver)).toEqual(["Ted", "Kraz"]);

    const july = await (
      await history(get(`/api/admin/cars/${car.id}/history/?from=2026-07-01&to=2026-07-31`, cookie), params(car.id))
    ).json();
    expect(july.sightings).toHaveLength(1);
    expect(july.sightings[0]).toMatchObject({ driver: "Ted", location: "Kaiserstuhlstr. Oberglatt", amountCents: 4000 });
  });

  it("offers the old list's drivers on a new fine nobody could be found for", async () => {
    const org = await seedOrganisation();
    const cookie = await adminCookie();
    await send({ text: LIST, dry: false }, cookie);
    const car = await prisma.car.findFirstOrThrow({ where: { plate: "ZH 919 906" } });
    const fine = await prisma.fine.create({
      data: {
        organisationId: org.id,
        carId: car.id,
        violationAt: new Date("2026-08-20T09:00:00Z"),
        status: "NEEDS_REVIEW",
        reviewReason: "NO_RENTAL_AT_TIME",
      },
    });
    const body = await (await detail(get(`/api/admin/fines/${fine.id}/`, cookie), params(fine.id))).json();
    // Within sixty days: July's driver, not May's.
    expect(body.legacyDrivers.map((d: { legacyDriverName: string }) => d.legacyDriverName)).toEqual(["Ted"]);
  });
});
