import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import {
  chargeOfficeOnlyPass,
  chargeOverduePass,
  chargeReminderPass,
  mailRetryPass,
  mfkDuePass,
  mfkNoticePass,
  preEndReminderPass,
  rentalOverduePass,
} from "@/lib/rental/scheduler";
import type { LifecycleMailConfig } from "@/lib/rental/lifecycleMail";
import { ensureOrganisation } from "@/prisma/seed";
import { RETURN_CLOSE_EVENT } from "@/lib/rental/closeRental";

/**
 * Multi-company phase C (16.11.2026): the daily run per company. A partner's
 * renters hear from the partner (its name, replies to its office), and its
 * office alerts go to its office. ZURIAUTO's office hears nothing of a
 * partner's rentals, and ZURIAUTO's own mail is exactly as before.
 */

const sent: { config: LifecycleMailConfig; to: string; subject: string; replyTo?: string }[] = [];

vi.mock("@/lib/rental/lifecycleMail", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/rental/lifecycleMail")>();
  return {
    ...original,
    sendMail: async (config: LifecycleMailConfig, message: { to: string; subject: string; replyTo?: string }) => {
      sent.push({ config, to: message.to, subject: message.subject, replyTo: message.replyTo });
    },
  };
});

const mail: LifecycleMailConfig = {
  host: "localhost",
  port: 587,
  user: "u",
  pass: "p",
  from: "ZURIAUTO <noreply@zuriauto.ch>",
  office: "office@zuriauto.ch",
};
const deps = (now: Date) => ({ client: prisma, now, baseUrl: "https://zuriauto.ch", mail });

const MEIER_OFFICE = "office@meier.test";
const MEIER_FROM = '"MEIER CARS" <noreply@zuriauto.ch>';

beforeEach(() => {
  sent.length = 0;
});

async function company(kind: "zuri" | "meier") {
  if (kind === "zuri") return ensureOrganisation(prisma);
  // ZURIAUTO first, as in production: the oldest company is the site company.
  await ensureOrganisation(prisma);
  return prisma.organisation.create({
    data: {
      name: "MEIER CARS",
      brandName: "MEIER CARS",
      legalName: "Meier Mietwagen GmbH",
      slug: "meier",
      officeEmail: MEIER_OFFICE,
    },
  });
}

/** A weekly rental with one car and renter, in the given company. */
async function rentalOf(organisationId: string, tag: string, opts: { startAt: Date; endAt: Date; mfkDate?: Date }) {
  const car = await prisma.car.create({
    data: {
      organisationId,
      slug: `car-${tag}`,
      model: "Toyota Prius",
      plate: `ZH ${tag}`,
      status: "rented",
      mfkDate: opts.mfkDate,
    },
  });
  const customer = await prisma.customer.create({
    data: {
      organisationId,
      firstName: "Rita",
      lastName: tag,
      email: `rita-${tag}@example.ch`,
      phone: "+41790000000",
      birthDate: new Date("1990-01-01T00:00:00Z"),
      street: "Weg 1",
      postalCode: "8000",
      city: "Zürich",
      country: "Switzerland",
    },
  });
  const rental = await prisma.rental.create({
    data: {
      organisationId,
      carId: car.id,
      customerId: customer.id,
      createdBy: "office",
      type: "WEEKLY",
      status: "ACTIVE",
      startAt: opts.startAt,
      endAt: opts.endAt,
      totalWeeks: 4,
      weeklyAmountCents: 45_000,
      billingWeekday: 2,
    },
  });
  await prisma.contract.create({
    data: {
      organisationId,
      rentalId: rental.id,
      contractNumber: `ZA-${tag}`,
      createdBy: "office",
      kind: "PICKUP",
      mileageKm: 1000,
      fuelLevel: "full",
      gtcVersion: "2026-07-31",
      gtcLanguage: "de",
      acceptedAt: opts.startAt,
    },
  });
  return { car, customer, rental };
}

const late = { startAt: new Date("2026-07-21T09:00:00Z"), endAt: new Date("2026-08-18T09:00:00Z") };
const afterLate = new Date("2026-08-20T09:00:00Z");

describe("office alerts go to each company's own office", () => {
  it("a partner's late car is reported to the partner, ZURIAUTO's to ZURIAUTO", async () => {
    const zuri = await company("zuri");
    const meier = await company("meier");
    await rentalOf(zuri.id, "Z1", late);
    await rentalOf(meier.id, "M1", late);

    expect(await rentalOverduePass(deps(afterLate))).toBe(2);

    const toZuri = sent.filter((m) => m.to === "office@zuriauto.ch");
    const toMeier = sent.filter((m) => m.to === MEIER_OFFICE);
    expect(toZuri).toHaveLength(1);
    expect(toMeier).toHaveLength(1);
    expect(toZuri[0].config.from).toBe(mail.from);
    expect(toMeier[0].config.from).toBe(MEIER_FROM);
    expect(toMeier[0].subject).toContain("ZH M1");
    expect(toZuri[0].subject).not.toContain("ZH M1");
  });

  it("an unpaid week of a partner's renter: reminder in the partner's name, alert to its office", async () => {
    const meier = await company("meier");
    const { rental } = await rentalOf(meier.id, "M2", {
      startAt: new Date("2026-08-18T08:00:00Z"),
      endAt: new Date("2026-09-15T08:00:00Z"),
    });
    await prisma.charge.create({
      data: {
        organisationId: meier.id,
        rentalId: rental.id,
        weekNumber: 1,
        dueDate: new Date("2026-08-18T08:00:00Z"),
        amountCents: 45_000,
        status: "REQUESTED",
        requestedAt: new Date("2026-08-18T09:00:00Z"),
      },
    });

    expect(await chargeReminderPass(deps(new Date("2026-08-21T10:00:00Z")))).toBe(1);
    expect(await chargeOverduePass(deps(new Date("2026-08-23T11:00:00Z")))).toBe(1);

    const [reminder, alert] = sent;
    expect(reminder.to).toBe("rita-M2@example.ch");
    expect(reminder.config.from).toBe(MEIER_FROM);
    expect(reminder.config.replyTo).toBe(MEIER_OFFICE);
    expect(alert.to).toBe(MEIER_OFFICE);
    expect(sent.map((m) => m.to)).not.toContain("office@zuriauto.ch");
  });

  it("a week only the office may chase goes to the partner's office", async () => {
    const meier = await company("meier");
    const { rental } = await rentalOf(meier.id, "M3", late);
    await prisma.rental.update({ where: { id: rental.id }, data: { status: "COMPLETED" } });
    await prisma.rentalEvent.create({
      data: { rentalId: rental.id, type: RETURN_CLOSE_EVENT, createdAt: new Date("2026-08-11T10:00:00Z") },
    });
    await prisma.charge.create({
      data: {
        organisationId: meier.id,
        rentalId: rental.id,
        weekNumber: 4,
        dueDate: new Date("2026-08-11T08:00:00Z"),
        amountCents: 45_000,
        status: "SCHEDULED",
      },
    });

    await chargeOfficeOnlyPass(deps(new Date("2026-08-12T09:00:00Z")));

    expect(sent.map((m) => m.to)).toEqual([MEIER_OFFICE]);
  });

  it("the MFK of a partner's car: the renter hears from the partner, the office alerts go to the partner", async () => {
    const meier = await company("meier");
    await rentalOf(meier.id, "M4", {
      startAt: new Date("2026-08-01T08:00:00Z"),
      endAt: new Date("2026-10-01T08:00:00Z"),
      mfkDate: new Date("2026-08-25T00:00:00Z"),
    });

    await mfkNoticePass(deps(new Date("2026-08-12T09:00:00Z")));
    await mfkDuePass(deps(new Date("2026-08-20T09:00:00Z")));

    expect(sent.length).toBeGreaterThanOrEqual(2);
    for (const message of sent) {
      expect(message.config.from).toBe(MEIER_FROM);
      expect([MEIER_OFFICE, "rita-M4@example.ch"]).toContain(message.to);
    }
    const renter = sent.find((m) => m.to === "rita-M4@example.ch");
    expect(renter?.replyTo ?? renter?.config.replyTo).toBe(MEIER_OFFICE);
  });

  it("a partner's undelivered message is escalated to the partner's office", async () => {
    const meier = await company("meier");
    const { rental } = await rentalOf(meier.id, "M5", late);
    await prisma.notification.create({
      data: {
        organisationId: meier.id,
        rentalId: rental.id,
        kind: "RENTAL_ENDING",
        dedupeKey: "x",
        to: "rita-M5@example.ch",
        attempts: 1,
        error: "smtp",
        createdAt: new Date("2026-08-10T09:00:00Z"),
      },
    });

    expect(await mailRetryPass(deps(afterLate))).toBe(1);

    expect(sent.map((m) => m.to)).toEqual([MEIER_OFFICE]);
  });
});

describe("renter mail in the partner's name", () => {
  it("the end-of-rental reminder", async () => {
    const meier = await company("meier");
    const now = new Date("2026-08-17T09:00:00Z");
    await rentalOf(meier.id, "M6", { startAt: new Date("2026-08-01T09:00:00Z"), endAt: new Date(now.getTime() + 36 * 3_600_000) });

    expect(await preEndReminderPass(deps(now))).toBe(1);

    expect(sent[0].to).toBe("rita-M6@example.ch");
    expect(sent[0].config.from).toBe(MEIER_FROM);
    expect(sent[0].config.replyTo).toBe(MEIER_OFFICE);
  });

  it("ZURIAUTO's renter mail keeps ZURIAUTO's sender and no reply-to", async () => {
    const zuri = await company("zuri");
    const now = new Date("2026-08-17T09:00:00Z");
    await rentalOf(zuri.id, "Z6", { startAt: new Date("2026-08-01T09:00:00Z"), endAt: new Date(now.getTime() + 36 * 3_600_000) });

    expect(await preEndReminderPass(deps(now))).toBe(1);

    expect(sent[0].config).toEqual(mail);
  });
});

describe("a partner with no office address", () => {
  it("gets nothing sent in its name, and ZURIAUTO's office gets nothing of it", async () => {
    const meier = await company("meier");
    await prisma.organisation.update({ where: { id: meier.id }, data: { officeEmail: null } });
    await rentalOf(meier.id, "M7", late);

    await rentalOverduePass(deps(afterLate));
    await mailRetryPass(deps(new Date("2026-08-25T09:00:00Z")));

    expect(sent).toEqual([]);
    const row = await prisma.notification.findFirstOrThrow({ where: { organisationId: meier.id } });
    expect(row.sentAt).toBeNull();
    expect(row.error).toBeTruthy();
  });
});

describe("ZURIAUTO's office address in Firma", () => {
  it("empty: the server setting, as before; filled: its alerts go there, sender unchanged", async () => {
    const zuri = await company("zuri");
    await rentalOf(zuri.id, "Z8", late);
    await prisma.organisation.update({ where: { id: zuri.id }, data: { officeEmail: "buero@zuriauto.ch" } });

    await rentalOverduePass(deps(afterLate));

    expect(sent.map((m) => m.to)).toEqual(["buero@zuriauto.ch"]);
    expect(sent[0].config.from).toBe(mail.from);
    expect(sent[0].config.replyTo).toBeUndefined();
  });
});
