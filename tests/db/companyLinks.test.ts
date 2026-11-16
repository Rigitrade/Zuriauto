import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as fleetGet } from "@/app/api/fleet/route";
import { POST as prefillPost } from "@/app/api/rental-return/prefill/route";
import { POST as lookupPost } from "@/app/api/customers/lookup/route";
import { GET as photoGet } from "@/app/api/cars/[slug]/photo/route";
import { POST as contractPost } from "@/app/api/rental-contract/route";
import { POST as returnPost } from "@/app/api/rental-return/route";
import { prisma } from "@/lib/db";
import { ensureOrganisation, seedFleet } from "@/prisma/seed";
import { buildCompany, type CompanyFixture } from "./companyFixture";

/**
 * Multi-company phase C (16.11.2026): each partner's own pickup and return
 * links, `zuriauto.ch/<slug>/pickup`. The forms name their company to the
 * public endpoints as `?company=<slug>`; without it they serve ZURIAUTO as
 * before. An unknown name finds nothing and creates nothing.
 */

const ORIGIN = "https://zuriauto.ch";
let b: CompanyFixture;
let bSlug: string;

beforeEach(async () => {
  process.env.RATE_LIMIT_SALT = "test-salt";
  const zuri = await ensureOrganisation(prisma);
  await seedFleet(prisma, zuri.id);
  b = await buildCompany("B");
  bSlug = (await prisma.organisation.findUniqueOrThrow({ where: { id: b.organisationId } })).slug!;
});

afterEach(() => {
  delete process.env.SITE_ORGANISATION_ID;
  for (const key of ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "MAIL_OFFICE"]) delete process.env[key];
});

function json(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function contractSubmission(url: string, carSlug: string, plate: string): Request {
  const body = new FormData();
  body.append("pdf", new File([new Uint8Array([37, 80, 68, 70])], "c.pdf", { type: "application/pdf" }));
  for (const kind of ["PORTRAIT", "ID_FRONT", "ID_BACK", "LICENCE_FRONT", "LICENCE_BACK", "SIGNATURE"]) {
    body.append(`asset:${kind}`, new File([new Uint8Array([0xff, 0xd8, 0xff])], `${kind}.jpg`, { type: "image/jpeg" }));
  }
  body.append(
    "meta",
    JSON.stringify({
      contractNumber: "ZA-20261116-0001",
      customerName: "Carla Neu",
      customerEmail: "carla@example.ch",
      vehicleLabel: "Toyota Prius",
      plate,
      mileageKm: 100_500,
      language: "de",
      details: {
        vehicleId: carSlug,
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
  return new Request(url, { method: "POST", body });
}

/** A return of B's car, as the return form sends it. */
function returnSubmission(url: string): Request {
  const body = new FormData();
  body.append("pdf", new File([new Uint8Array([37, 80, 68, 70])], "r.pdf", { type: "application/pdf" }));
  body.append("asset:SIGNATURE", new File([new Uint8Array([0x89, 0x50])], "s.png", { type: "image/png" }));
  body.append(
    "meta",
    JSON.stringify({
      returnNumber: "ZR-20261116-0001",
      vehicleId: b.carSlug,
      customerName: "Rita Yyxw",
      customerEmail: "rita@example.ch",
      vehicleLabel: "Toyota Prius",
      plate: b.plate,
      mileageKm: 120_000,
      language: "de",
    })
  );
  body.append(
    "details",
    JSON.stringify({
      vehicleId: b.carSlug, mileageKm: 120_000, papersInside: "yes", keyReturned: "yes",
      fuelLevel: "1/2", cleanliness: "clean", damages: "", tickets: "no", ticketsNote: "",
      fullyPaid: "yes", paymentMethods: ["cash"], paidOn: "", hasDuePayment: "no", dueDate: "",
      depositBack: "yes", lastName: "Yyxw", firstName: "Rita", email: "rita@example.ch", place: "Zurich",
    })
  );
  return new Request(url, { method: "POST", body });
}

/** Mail that is configured but cannot connect: the return is recorded before the send. */
function unreachableMail() {
  Object.assign(process.env, {
    SMTP_HOST: "127.0.0.1", SMTP_PORT: "9", SMTP_USER: "u", SMTP_PASS: "p", MAIL_OFFICE: "office@zuriauto.test",
  });
}


async function freeCarB() {
  await prisma.rental.update({ where: { id: b.rentalId }, data: { status: "COMPLETED" } });
  await prisma.car.update({ where: { id: b.carId }, data: { status: "available" } });
}

describe("a partner's link reaches that partner only", () => {
  it("the fleet lists the partner's cars, in its name, with photos it can load", async () => {
    const body = await (await fleetGet(new Request(`${ORIGIN}/api/fleet/?scope=return&company=${bSlug}`))).json();

    expect(body.vehicles.map((v: { id: string }) => v.id)).toEqual([b.carSlug]);
    expect(body.company.brandName).toBe("Company B");
    expect(body.company.poweredBy).toBe(true);

    const photo = new URL(body.vehicles[0].photoUrl, ORIGIN);
    expect(photo.searchParams.get("company")).toBe(bSlug);
    const served = await photoGet(new Request(photo), { params: Promise.resolve({ slug: b.carSlug }) });
    expect(served.status).toBe(200);
  });

  it("ZURIAUTO's own forms are unchanged: no company named, or its own name", async () => {
    for (const query of ["", "&company=zuriauto"]) {
      const body = await (await fleetGet(new Request(`${ORIGIN}/api/fleet/?scope=available${query}`))).json();
      expect(body.company.poweredBy, query).toBe(false);
      expect(JSON.stringify(body.vehicles), query).not.toContain(b.carSlug);
      expect(body.vehicles.length, query).toBeGreaterThan(0);
    }
  });

  it("the return prefill and the renter lookup find the partner's renter", async () => {
    const prefill = await (
      await prefillPost(json(`${ORIGIN}/api/rental-return/prefill/?company=${bSlug}`, { vehicleId: b.carSlug }))
    ).json();
    expect(prefill.prefill?.lastName).toBe(b.renterLastName);

    const lookup = await lookupPost(json(`${ORIGIN}/api/customers/lookup/?company=${bSlug}`, { phone: "079 000 00 02" }));
    expect(await lookup.text()).toContain(b.renterLastName);
  });

  it("a contract signed on the partner's link belongs to the partner", async () => {
    await freeCarB();
    const before = await prisma.rental.count({ where: { carId: b.carId } });

    const response = await contractPost(
      contractSubmission(`${ORIGIN}/api/rental-contract/?company=${bSlug}`, b.carSlug, b.plate)
    );

    expect(response.status, await response.clone().text()).toBe(200);
    const rental = await prisma.rental.findFirstOrThrow({
      where: { carId: b.carId, status: { not: "COMPLETED" } },
      include: { customer: true },
    });
    expect(await prisma.rental.count({ where: { carId: b.carId } })).toBe(before + 1);
    expect(rental.organisationId).toBe(b.organisationId);
    expect(rental.customer.organisationId).toBe(b.organisationId);
  });

  it("a return sent from the partner's link is recorded on the partner's rental", async () => {
    unreachableMail();
    const before = await prisma.contract.count({ where: { rentalId: b.rentalId } });

    await returnPost(returnSubmission(`${ORIGIN}/api/rental-return/?company=${bSlug}`));

    expect(await prisma.contract.count({ where: { rentalId: b.rentalId } })).toBe(before + 1);
  });

  it("a return from a partner with no office address is still recorded", async () => {
    unreachableMail();
    await prisma.organisation.update({ where: { id: b.organisationId }, data: { officeEmail: null } });
    const before = await prisma.contract.count({ where: { rentalId: b.rentalId } });

    const response = await returnPost(returnSubmission(`${ORIGIN}/api/rental-return/?company=${bSlug}`));

    // Nothing can be mailed in its name; the form falls back to download.
    expect(response.status).toBe(503);
    expect(await prisma.contract.count({ where: { rentalId: b.rentalId } })).toBe(before + 1);
  });

  it("the partner's link cannot rent out ZURIAUTO's car", async () => {
    const zuriCar = await prisma.car.findFirstOrThrow({ where: { organisationId: { not: b.organisationId }, status: "available" } });
    const before = await prisma.rental.count({ where: { carId: zuriCar.id } });

    const response = await contractPost(
      contractSubmission(`${ORIGIN}/api/rental-contract/?company=${bSlug}`, zuriCar.slug, zuriCar.plate)
    );

    expect(response.status).not.toBe(200);
    expect(await prisma.rental.count({ where: { carId: zuriCar.id } })).toBe(before);
  });
});

describe("an unknown company name", () => {
  it("is not found on every form endpoint, and creates nothing", async () => {
    await freeCarB();
    const rentals = await prisma.rental.count();
    const lookups = await prisma.customerLookup.count();
    const q = "?company=no-such-co";

    const answers = [
      await fleetGet(new Request(`${ORIGIN}/api/fleet/${q}`)),
      await prefillPost(json(`${ORIGIN}/api/rental-return/prefill/${q}`, { vehicleId: b.carSlug })),
      await lookupPost(json(`${ORIGIN}/api/customers/lookup/${q}`, { phone: "079 000 00 02" })),
      await photoGet(new Request(`${ORIGIN}/api/cars/${b.carSlug}/photo/${q}`), {
        params: Promise.resolve({ slug: b.carSlug }),
      }),
      await contractPost(contractSubmission(`${ORIGIN}/api/rental-contract/${q}`, b.carSlug, b.plate)),
    ];

    for (const answer of answers) {
      expect(answer.status, answer.url).toBe(404);
      expect(await answer.text()).not.toContain(b.renterLastName);
    }
    unreachableMail();
    const contracts = await prisma.contract.count();
    const returned = await returnPost(returnSubmission(`${ORIGIN}/api/rental-return/${q}`));
    expect(returned.status).toBe(404);
    expect(await prisma.contract.count()).toBe(contracts);

    expect(await prisma.rental.count()).toBe(rentals);
    expect(await prisma.customerLookup.count()).toBe(lookups);
  });
});

describe("the partner pages' address", () => {
  it("names the partner, sends ZURIAUTO's own name to its pages, and finds nothing else", async () => {
    const { partnerForPage } = await import("@/lib/company/partnerPage");

    const partner = await partnerForPage(bSlug.toUpperCase());
    expect(partner).toMatchObject({ slug: bSlug, identity: { brandName: "Company B", poweredBy: true } });
    expect(await partnerForPage("zuriauto")).toBe("site");
    expect(await partnerForPage("no-such-co")).toBeNull();
  });
});

describe("the renter's pages behind an email link", () => {
  it("frame a partner's rental in the partner's name, and ZURIAUTO's in ZURIAUTO's site", async () => {
    const { CompanyFrame } = await import("@/components/company/CompanyFrame");
    const { PartnerLayout } = await import("@/components/company/PartnerLayout");
    const { MainLayout } = await import("@/components/MainLayout");
    const zuri = await prisma.organisation.findUniqueOrThrow({ where: { slug: "zuriauto" } });

    const partner = await CompanyFrame({ organisationId: b.organisationId, children: null });
    expect(partner.type).toBe(PartnerLayout);
    expect(partner.props.company.brandName).toBe("Company B");

    expect((await CompanyFrame({ organisationId: zuri.id, children: null })).type).toBe(MainLayout);
    expect((await CompanyFrame({ organisationId: null, children: null })).type).toBe(MainLayout);
  });
});

describe("a partner link shared in WhatsApp", () => {
  it("previews with the partner's name, not ZURIAUTO's", async () => {
    const { generateMetadata: pickupMeta } = await import("@/app/[company]/pickup/page");
    const { generateMetadata: returnMeta } = await import("@/app/[company]/return/page");

    for (const meta of [pickupMeta, returnMeta]) {
      const m = await meta({ params: Promise.resolve({ company: bSlug }) });
      const preview = JSON.stringify({ openGraph: m.openGraph, twitter: m.twitter });
      expect(preview).toContain("Company B");
      expect(preview).not.toMatch(/zuriauto/i);
      expect(m.openGraph).toMatchObject({ images: [] });
      expect(JSON.stringify(m.alternates ?? {})).not.toMatch(/zuriauto\.ch\/?"/);
    }
  });
});
