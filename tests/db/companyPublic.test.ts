import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as fleetGet } from "@/app/api/fleet/route";
import { POST as prefillPost } from "@/app/api/rental-return/prefill/route";
import { POST as lookupPost } from "@/app/api/customers/lookup/route";
import { GET as photoGet } from "@/app/api/cars/[slug]/photo/route";
import { POST as contractPost } from "@/app/api/rental-contract/route";
import { prisma } from "@/lib/db";
import { ensureOrganisation, seedFleet } from "@/prisma/seed";
import { buildCompany, type CompanyFixture } from "./companyFixture";

/**
 * Multi-company phase A (15.11.2026): the public site serves one company,
 * `siteOrganisation()` (ZURIAUTO). Another company's cars, rentals and
 * renters are invisible to it. Each case also runs the same request with the
 * site switched to company B, which must then find B's record: that proves
 * the request was able to reach it, so the empty answer is the wall.
 */

const ORIGIN = "https://zuriauto.ch";
let b: CompanyFixture;

beforeEach(async () => {
  process.env.RATE_LIMIT_SALT = "test-salt";
  const zuri = await ensureOrganisation(prisma);
  await seedFleet(prisma, zuri.id);
  b = await buildCompany("B");
});

afterEach(() => {
  delete process.env.SITE_ORGANISATION_ID;
});

function asSiteB() {
  process.env.SITE_ORGANISATION_ID = b.organisationId;
}

function json(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("the public site serves one company", () => {
  it("the public fleet lists only the site company's cars", async () => {
    const scope = `${ORIGIN}/api/fleet/?scope=return`;
    const text = await (await fleetGet(new Request(scope))).text();
    expect(text).not.toContain(b.carSlug);

    asSiteB();
    expect(await (await fleetGet(new Request(scope))).text()).toContain(b.carSlug);
  });

  it("the return form's prefill does not see another company's rental", async () => {
    const url = `${ORIGIN}/api/rental-return/prefill/`;
    const body = await (await prefillPost(json(url, { vehicleId: b.carSlug }))).json();
    expect(body.prefill ?? null).toBeNull();

    asSiteB();
    const control = await (await prefillPost(json(url, { vehicleId: b.carSlug }))).json();
    expect(control.prefill?.lastName).toBe(b.renterLastName);
  });

  it("customer lookup does not find another company's renter", async () => {
    const url = `${ORIGIN}/api/customers/lookup/`;
    const text = await (await lookupPost(json(url, { phone: "079 000 00 02" }))).text();
    expect(text).not.toContain(b.renterLastName);

    asSiteB();
    expect(await (await lookupPost(json(url, { phone: "079 000 00 02" }))).text()).toContain(
      b.renterLastName
    );
  });

  it("a car photo of another company is not served by slug", async () => {
    const call = () =>
      photoGet(new Request(`${ORIGIN}/api/cars/${b.carSlug}/photo/`), {
        params: Promise.resolve({ slug: b.carSlug }),
      });
    expect((await call()).status).toBe(404);

    asSiteB();
    expect((await call()).status).toBe(200);
  });

  it("the pickup form does not rent out another company's car", async () => {
    const submission = () => {
      const body = new FormData();
      body.append("pdf", new File([new Uint8Array([37, 80, 68, 70])], "c.pdf", { type: "application/pdf" }));
      for (const kind of ["PORTRAIT", "ID_FRONT", "ID_BACK", "LICENCE_FRONT", "LICENCE_BACK", "SIGNATURE"]) {
        body.append(`asset:${kind}`, new File([new Uint8Array([0xff, 0xd8, 0xff])], `${kind}.jpg`, { type: "image/jpeg" }));
      }
      body.append(
        "meta",
        JSON.stringify({
          contractNumber: "ZA-20261115-0001",
          customerName: "Carla Neu",
          customerEmail: "carla@example.ch",
          vehicleLabel: "Toyota Prius",
          plate: b.plate,
          mileageKm: 100_500,
          language: "de",
          details: {
            vehicleId: b.carSlug,
            mileageKm: 100_500,
            fuelLevel: "full",
            existingDamage: "",
            terms: {
              type: "FIXED_TERM",
              startAt: "2026-11-16T08:00:00.000Z",
              endAt: "2026-11-18T08:00:00.000Z",
              dailyAmountCents: 8_000,
              depositCents: 0,
              paymentMethod: "card",
            },
            lastName: "Neu",
            firstName: "Carla",
            birthDate: "1991-02-03",
            street: "Seestrasse 2",
            postalCode: "8002",
            city: "Zürich",
            country: "Switzerland",
            mobile: "079 555 55 55",
            email: "carla@example.ch",
            gtcAccepted: true,
            gtcVersion: "2026-10-22",
            gtcLanguage: "de",
            acceptedAt: "2026-11-16T08:00:00.000Z",
            truthfulInfoConfirmedAt: "2026-11-16T08:00:10.000Z",
            deceptionNoticeConfirmedAt: "2026-11-16T08:00:20.000Z",
            place: "Zurich",
          },
        })
      );
      body.append("company", "");
      return new Request(`${ORIGIN}/api/rental-contract/`, {
        method: "POST",
        body,
      });
    };
    // B's car is already out on a rental, so the control frees it first.
    await prisma.rental.update({ where: { id: b.rentalId }, data: { status: "COMPLETED" } });
    await prisma.car.update({ where: { id: b.carId }, data: { status: "available" } });
    const before = await prisma.rental.count({ where: { carId: b.carId } });

    const refused = await contractPost(submission());
    expect(refused.status).not.toBe(200);
    expect(await prisma.rental.count({ where: { carId: b.carId } })).toBe(before);

    asSiteB();
    const control = await contractPost(submission());
    expect(control.status, await control.clone().text()).toBe(200);
    expect(await prisma.rental.count({ where: { carId: b.carId } })).toBe(before + 1);
  });
});
