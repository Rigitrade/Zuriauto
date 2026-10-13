import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { MARKED_OUT_BY } from "@/lib/admin/markOut";
import type { NotifyDeps, SentMail } from "@/lib/fines/notify";
import { sendFinesFromReturn } from "@/lib/fines/renter";
import { persistPickup } from "@/lib/rental/persistPickup";
import { persistReturn } from "@/lib/rental/persistReturn";
import { placeholderEmail, UNKNOWN_BIRTH_DATE } from "@/lib/rental/placeholder";
import type { ReturnDetails } from "@/lib/rental/returnSchema";
import { createMemoryStore, type MemoryStore } from "@/lib/storage";
import { ensureOrganisation, seedFleet } from "@/prisma/seed";
import { pickupDetails, UPLOADS } from "./fineHelpers";

/**
 * A car the office marked as out has a placeholder renter: a name at most,
 * and an address nobody can receive. The return form is the first time the
 * renter says who they are — the 30.09.2026 return of ZH 918 474 named
 * Hazem El-Khenany, while his fine sat on "no email for the renter".
 */

const VEHICLE = "prius-zh513925";

const returnDetails: ReturnDetails = {
  vehicleId: VEHICLE,
  mileageKm: 121_450,
  papersInside: "yes",
  keyReturned: "yes",
  fuelLevel: "1/2",
  cleanliness: "clean",
  damages: "",
  tickets: "no",
  ticketsNote: "",
  fullyPaid: "yes",
  paymentMethods: ["twint"],
  paidOn: "2026-09-14",
  hasDuePayment: "no",
  dueDate: "",
  depositBack: "yes",
  lastName: "Meier",
  firstName: "Anna",
  email: "Anna@Example.CH",
  place: "Zurich",
};

async function ready() {
  const org = await ensureOrganisation(prisma);
  await seedFleet(prisma, org.id);
  return org.id;
}

/** What the office's "mark as out" button writes (app/api/admin/cars/[id]/mark-out). */
async function markedOut(organisationId: string) {
  const car = await prisma.car.findFirstOrThrow({ where: { slug: VEHICLE } });
  const customer = await prisma.customer.create({
    data: {
      organisationId,
      firstName: "",
      lastName: "Anna",
      email: placeholderEmail(randomUUID()),
      phone: "",
      birthDate: UNKNOWN_BIRTH_DATE,
      street: "",
      postalCode: "",
      city: "",
      country: "",
    },
  });
  const rental = await prisma.rental.create({
    data: {
      organisationId,
      carId: car.id,
      customerId: customer.id,
      createdBy: MARKED_OUT_BY,
      type: "FIXED_TERM",
      status: "ACTIVE",
      startAt: new Date("2026-08-20T22:00:00Z"),
      endAt: new Date("2026-10-01T21:59:59Z"),
    },
  });
  await prisma.car.update({ where: { id: car.id }, data: { status: "rented" } });
  return { rental, placeholder: customer };
}

function returnCar(organisationId: string, overrides: Partial<ReturnDetails> = {}) {
  return persistReturn({
    organisationId,
    details: { ...returnDetails, ...overrides },
    vehicleSlug: VEHICLE,
    returnNumber: `ZR-20260930-513925-${randomUUID().slice(0, 4).toUpperCase()}`,
    uploads: [{ kind: "SIGNATURE", body: new Uint8Array([10]), contentType: "image/png" }],
    pdf: { body: new Uint8Array([11]) },
    store: createMemoryStore(),
    now: new Date("2026-09-30T16:06:00Z"),
  });
}

async function fineOn(organisationId: string, rentalId: string, customerId: string, status: "NEEDS_REVIEW" | "NOTIFIED") {
  const car = await prisma.car.findFirstOrThrow({ where: { slug: VEHICLE } });
  return prisma.fine.create({
    data: {
      organisationId,
      carId: car.id,
      rentalId,
      customerId,
      issuerName: "Stadtpolizei Zürich",
      fineNumber: "260605407 059 8",
      status,
      reviewReason: status === "NEEDS_REVIEW" ? "NO_CUSTOMER_EMAIL" : null,
      violationAt: new Date("2026-09-20T10:17:00Z"),
      amountCents: 25_000,
    },
  });
}

describe("returning a car the office marked as out", () => {
  it("names the placeholder renter from the return form", async () => {
    const organisationId = await ready();
    const { rental, placeholder } = await markedOut(organisationId);

    expect(await returnCar(organisationId)).toMatchObject({ recorded: true });

    const after = await prisma.rental.findUniqueOrThrow({ where: { id: rental.id }, include: { customer: true } });
    expect(after.customerId).toBe(placeholder.id);
    expect(after.customer).toMatchObject({ firstName: "Anna", lastName: "Meier", email: "anna@example.ch" });
    const event = await prisma.rentalEvent.findFirstOrThrow({ where: { rentalId: rental.id, type: "rental.renter.from-return" } });
    expect(event.payload).toMatchObject({ customerId: placeholder.id, matchedExisting: false });
  });

  it("points the rental at the customer who already has that email", async () => {
    const organisationId = await ready();
    await persistPickup({
      organisationId,
      details: pickupDetails({ vehicleId: "octavia-zh886530", email: "anna@example.ch" }),
      vehicleSlug: "octavia-zh886530",
      uploads: UPLOADS,
      pdf: { body: new Uint8Array([7]) },
      store: createMemoryStore(),
      now: new Date("2026-08-21T08:00:00Z"),
    });
    const anna = await prisma.customer.findFirstOrThrow({ where: { email: "anna@example.ch" } });
    const { rental, placeholder } = await markedOut(organisationId);

    await returnCar(organisationId);

    expect((await prisma.rental.findUniqueOrThrow({ where: { id: rental.id } })).customerId).toBe(anna.id);
    // The placeholder is left as it was: it names nobody, and a real row
    // already has the address the unique index would refuse twice.
    expect(await prisma.customer.findUniqueOrThrow({ where: { id: placeholder.id } })).toMatchObject({ lastName: "Anna" });
  });

  it("gives its open fines the renter, and clears the no-email warning without sending anything", async () => {
    const organisationId = await ready();
    const { rental, placeholder } = await markedOut(organisationId);
    const fine = await fineOn(organisationId, rental.id, placeholder.id, "NEEDS_REVIEW");

    await returnCar(organisationId);

    const after = await prisma.fine.findUniqueOrThrow({ where: { id: fine.id }, include: { customer: true } });
    expect(after).toMatchObject({ status: "NEEDS_REVIEW", reviewReason: null, notifiedAt: null });
    expect(after.customer?.email).toBe("anna@example.ch");
    expect(await prisma.fineEvent.count({ where: { fineId: fine.id, type: "system.renter-from-rental" } })).toBe(1);
  });

  it("leaves a fine that already went out alone", async () => {
    const organisationId = await ready();
    const { rental, placeholder } = await markedOut(organisationId);
    const sent = await fineOn(organisationId, rental.id, placeholder.id, "NOTIFIED");
    await prisma.customer.create({
      data: {
        organisationId, firstName: "Anna", lastName: "Meier", email: "anna@example.ch", phone: "",
        birthDate: UNKNOWN_BIRTH_DATE, street: "", postalCode: "", city: "", country: "",
      },
    });

    await returnCar(organisationId);

    expect((await prisma.fine.findUniqueOrThrow({ where: { id: sent.id } })).customerId).toBe(placeholder.id);
  });
});

describe("sending the fines a return made ready", () => {
  it("emails the renter the fine, as an upload would have", async () => {
    const organisationId = await ready();
    const { rental, placeholder } = await markedOut(organisationId);
    const fine = await fineOn(organisationId, rental.id, placeholder.id, "NEEDS_REVIEW");
    const store: MemoryStore = createMemoryStore();
    await store.put("fines/d/letter-0000000000000001.pdf", new Uint8Array([37, 80, 68, 70, 1]), "application/pdf");
    await prisma.fineDocument.create({
      data: {
        organisationId, storageKey: "fines/d/letter-0000000000000001.pdf", sha256: "1".repeat(64), bytes: 5,
        pages: 1, uploadedById: "u1", uploadedByName: "Eng Ahmed", status: "PROCESSED", fineId: fine.id,
      },
    });

    const result = await returnCar(organisationId);
    expect(result).toMatchObject({ recorded: true, finesReady: [fine.id] });

    const sent: SentMail[] = [];
    const deps: NotifyDeps = {
      client: prisma,
      store,
      now: new Date("2026-09-30T16:07:00Z"),
      mail: { host: "smtp.test", port: 587, user: "u", pass: "p", from: "office@zuriauto.ch", office: "office@zuriauto.ch" },
      baseUrl: "https://www.zuriauto.ch",
      send: async (_config, message) => {
        sent.push(message);
      },
    };
    await sendFinesFromReturn(deps, result.recorded ? result.finesReady : []);

    expect(sent.map((m) => m.to)).toContain("anna@example.ch");
    expect(await prisma.fine.findUniqueOrThrow({ where: { id: fine.id } })).toMatchObject({ status: "NOTIFIED" });
  });

  it("reports nothing to send for a return on a rental with a recorded renter", async () => {
    const organisationId = await ready();
    await persistPickup({
      organisationId,
      details: pickupDetails({ vehicleId: VEHICLE }),
      vehicleSlug: VEHICLE,
      uploads: UPLOADS,
      pdf: { body: new Uint8Array([7]) },
      store: createMemoryStore(),
      now: new Date("2026-08-21T08:00:00Z"),
    });
    expect(await returnCar(organisationId)).toMatchObject({ recorded: true, finesReady: [] });
  });
});

describe("returning a car with a recorded renter", () => {
  it("never changes who the renter is, whatever the form says", async () => {
    const organisationId = await ready();
    await persistPickup({
      organisationId,
      details: pickupDetails({ vehicleId: VEHICLE }),
      vehicleSlug: VEHICLE,
      uploads: UPLOADS,
      pdf: { body: new Uint8Array([7]) },
      store: createMemoryStore(),
      now: new Date("2026-08-21T08:00:00Z"),
    });
    const rental = await prisma.rental.findFirstOrThrow({ include: { customer: true } });

    await returnCar(organisationId, { firstName: "Someone", lastName: "Else", email: "someone@example.ch" });

    const after = await prisma.rental.findUniqueOrThrow({ where: { id: rental.id }, include: { customer: true } });
    expect(after.customerId).toBe(rental.customerId);
    expect(after.customer.email).toBe(rental.customer.email);
  });
});
