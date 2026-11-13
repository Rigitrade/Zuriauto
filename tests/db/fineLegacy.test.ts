import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { GET as list } from "@/app/api/admin/fines/route";
import { GET as detail } from "@/app/api/admin/fines/[id]/route";
import { GET as history } from "@/app/api/admin/cars/[id]/history/route";
import { matchFine } from "@/lib/fines/match";
import type { Extraction } from "@/lib/fines/types";
import { adminCookie, seedOrganisation } from "./fineHelpers";

/**
 * The office's fines list from before the system, written by the data
 * migration 20261113210000_legacy_fines_list_history. On the test database
 * the migration ran before any organisation or car existed, so it wrote
 * nothing; here it is run again over the seeded fleet, as production runs it.
 */

const MIGRATION = readFileSync(
  join(process.cwd(), "prisma/migrations/20261113210000_legacy_fines_list_history/migration.sql"),
  "utf8"
);

async function runMigration() {
  const statements = MIGRATION.split(/;\s*\r?\n/)
    .map((s) => s.replace(/^(\s*--[^\n]*\n)+/g, "").trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));
  for (const statement of statements) await prisma.$executeRawUnsafe(statement);
}

const get = (url: string, cookie: string) => new Request(`https://www.zuriauto.ch${url}`, { headers: { cookie } });
const params = (id: string) => ({ params: Promise.resolve({ id }) });

/** A letter as the reader would hand it to matching. */
function letter(plate: string, date: string, time: string): Extraction {
  const field = <T,>(value: T) => ({ value, status: "READ", source: "ocr", snippet: null });
  const missing = { value: null, status: "MISSING", source: null, snippet: null };
  return {
    language: "de",
    kind: "NOTICE",
    issuerKind: "POLICE",
    issuerName: field("Stadtpolizei Zürich"),
    issuerIban: missing,
    fineNumber: field("1"),
    paymentReference: missing,
    amountCents: field(4000),
    printedAmountCents: 4000,
    plateText: field(plate),
    violationDate: field(date),
    violationTime: field(time),
    location: field("Zürich"),
    offenceCode: missing,
    offenceText: field("Parkieren"),
    speedMeasuredKmh: missing,
    speedLimitKmh: missing,
    letterDate: missing,
    dueDate: missing,
    checks: [],
  } as unknown as Extraction;
}

describe("the old fines list, as the migration writes it", () => {
  it("writes nothing on a database with no fleet", async () => {
    await runMigration();
    expect(await prisma.customer.count()).toBe(0);
    expect(await prisma.rental.count()).toBe(0);
    expect(await prisma.fine.count()).toBe(0);
  });

  it("writes a renter per driver, a rental per driver and car, and every fine on it", async () => {
    await seedOrganisation();
    await runMigration();

    expect(await prisma.customer.count()).toBe(19);
    expect(await prisma.rental.count({ where: { createdBy: "import:fines-list" } })).toBe(21);
    expect(await prisma.fine.count({ where: { legacySource: { not: null } } })).toBe(37);
    // Every fine found its car, its rental and its renter.
    expect(await prisma.fine.count({ where: { OR: [{ carId: null }, { rentalId: null }, { customerId: null }] } })).toBe(0);

    const ibo = await prisma.rental.findFirstOrThrow({
      where: { customer: { firstName: "Ibo" } },
      include: { car: true, customer: true, fines: true, events: true },
    });
    expect(ibo.car.plate).toBe("ZH 615 132");
    expect(ibo.customer).toMatchObject({ lastName: "(Altdaten)", birthDate: new Date("1900-01-01T00:00:00Z") });
    expect(ibo.customer.email).toMatch(/@unrecorded\.invalid$/);
    expect(ibo).toMatchObject({
      status: "COMPLETED",
      type: "FIXED_TERM",
      // 14.06.2026 00:00 to 09.08.2026 23:59, Zurich summer time.
      startAt: new Date("2026-06-13T22:00:00Z"),
      endAt: new Date("2026-08-09T21:59:00Z"),
    });
    expect(ibo.fines).toHaveLength(7);
    expect(ibo.events.map((e) => e.type)).toEqual(["import.fines-list"]);

    // One renter across two cars, as the list has Teddy.
    const teddy = await prisma.customer.findFirstOrThrow({ where: { firstName: "Teddy" }, include: { rentals: { include: { car: true } } } });
    expect(teddy.rentals.map((r) => r.car.plate).sort()).toEqual(["ZH 589 864", "ZH 919 906"]);

    const sinisa = await prisma.customer.findFirstOrThrow({ where: { firstName: "Sinisa" } });
    expect(sinisa.lastName).toBe("Dzonic (Altdaten)");

    const odd = await prisma.fine.findFirstOrThrow({ where: { legacyDriverName: "Teddy", fineNumber: "ST.2026.5418/DK" } });
    expect(odd).toMatchObject({ amountCents: null, speedMeasuredKmh: 55, speedLimitKmh: 50, status: "HANDLED_OTHERWISE" });
    expect(odd.closedNote).toContain("Betrag laut Liste: 40+90");

    // Nothing went out and nothing waits for the office.
    expect(await prisma.fineNotification.count()).toBe(0);
    expect(await prisma.fine.count({ where: { status: { not: "HANDLED_OTHERWISE" } } })).toBe(0);
  });

  it("lets a new letter from those months find its renter", async () => {
    const org = await seedOrganisation();
    await runMigration();
    const text = "Kontrollschild ZH 615 132";
    const inside = await matchFine(prisma, org.id, letter("ZH 615 132", "2026-07-20", "14:00"), text);
    expect(inside.reviewReason).toBe("NO_CUSTOMER_EMAIL");
    const renter = await prisma.customer.findUniqueOrThrow({ where: { id: inside.customerId! } });
    expect(renter.firstName).toBe("Ibo");

    // Laszlo's one fine falls inside Ibo's span: two renters, the office decides.
    const both = await matchFine(prisma, org.id, letter("ZH 615 132", "2026-06-30", "16:30"), text);
    expect(both.reviewReason).toBe("OVERLAPPING_RENTALS");
  });

  it("shows the old drivers in the fines list and on the car's history", async () => {
    await seedOrganisation();
    await runMigration();
    const cookie = await adminCookie();

    const fines = (await (await list(get("/api/admin/fines/?tab=all", cookie))).json()).fines;
    expect(fines).toHaveLength(37);
    expect(fines.every((f: { legacy: boolean }) => f.legacy)).toBe(true);
    expect((await (await list(get("/api/admin/fines/?tab=review", cookie))).json()).fines).toEqual([]);

    const car = await prisma.car.findFirstOrThrow({ where: { plate: "ZH 919 906" } });
    const body = await (await history(get(`/api/admin/cars/${car.id}/history/`, cookie), params(car.id))).json();
    expect(body.periods.map((p: { customerName: string }) => p.customerName)).toEqual(["Teddy (Altdaten)", "Krazimir (Altdaten)"]);
    expect(body.sightings.map((s: { driver: string }) => s.driver)).toEqual(["Teddy", "Krazimir"]);
  });

  it("offers the old list's drivers on a fine nobody could be found for", async () => {
    const org = await seedOrganisation();
    await runMigration();
    const cookie = await adminCookie();
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
    expect(body.legacyDrivers.map((d: { legacyDriverName: string }) => d.legacyDriverName)).toEqual(["Teddy"]);
  });
});
