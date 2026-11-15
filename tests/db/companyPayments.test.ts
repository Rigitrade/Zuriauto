import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { PAYMENT_URL } from "@/lib/payment";
import type { LifecycleMailConfig } from "@/lib/rental/lifecycleMail";
import { chargeReminderPass, weeklyChargePass } from "@/lib/rental/scheduler";
import { ensureOrganisation } from "@/prisma/seed";

/**
 * Multi-company phase B (15.11.2026): a partner's renter is asked to pay in
 * the partner's name, on the partner's own payment page or none — never
 * through ZURIAUTO's payment provider (partner payments deferred by Ahmed).
 */

const sent: { to: string; subject: string; text: string }[] = [];

vi.mock("@/lib/rental/lifecycleMail", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/rental/lifecycleMail")>();
  return {
    ...original,
    sendMail: async (_config: unknown, message: { to: string; subject: string; text: string }) => {
      sent.push(message);
    },
  };
});

const mail: LifecycleMailConfig = {
  host: "localhost",
  port: 587,
  user: "u",
  pass: "p",
  from: "noreply@zuriauto.ch",
  office: "office@zuriauto.ch",
};
const TODAY = new Date("2026-11-10T09:00:00Z");
const DUE_TODAY = new Date("2026-11-10T07:00:00Z");

beforeEach(() => {
  sent.length = 0;
});

/** A partner company with one weekly rental whose first week is due today. */
async function partnerWeek(paymentUrl: string | null) {
  await ensureOrganisation(prisma);
  const org = await prisma.organisation.create({
    data: { name: "Meier Mietwagen GmbH", slug: "meier", brandName: "MEIER CARS", paymentUrl, officeEmail: "o@meier.example" },
  });
  const car = await prisma.car.create({
    data: { organisationId: org.id, slug: "meier-golf", model: "VW Golf", plate: "ZH 777777", status: "rented" },
  });
  const customer = await prisma.customer.create({
    data: {
      organisationId: org.id,
      firstName: "Anna",
      lastName: "Test",
      email: "anna@example.ch",
      phone: "+41791234567",
      birthDate: new Date("1990-04-12T00:00:00.000Z"),
      street: "Bahnhofstrasse 1",
      postalCode: "8001",
      city: "Zürich",
      country: "Switzerland",
    },
  });
  const rental = await prisma.rental.create({
    data: {
      organisationId: org.id,
      carId: car.id,
      customerId: customer.id,
      createdBy: "office",
      type: "WEEKLY",
      status: "ACTIVE",
      startAt: DUE_TODAY,
      endAt: new Date(DUE_TODAY.getTime() + 8 * 7 * 86_400_000),
      totalWeeks: 8,
      weeklyAmountCents: 25_000,
      billingWeekday: 2,
    },
  });
  await prisma.contract.create({
    data: {
      organisationId: org.id,
      rentalId: rental.id,
      contractNumber: "ZA-MEIER-1",
      createdBy: "office",
      kind: "PICKUP",
      mileageKm: 1000,
      fuelLevel: "full",
      gtcVersion: "2026-07-31",
      gtcLanguage: "de",
      acceptedAt: DUE_TODAY,
    },
  });
  const charge = await prisma.charge.create({
    data: { organisationId: org.id, rentalId: rental.id, weekNumber: 1, dueDate: DUE_TODAY, amountCents: 25_000 },
  });
  return { charge };
}

const deps = (now: Date) => ({ client: prisma, now, baseUrl: "https://zuriauto.ch", mail });

describe("a partner's weekly payment request", () => {
  it("is signed by the partner and has no payment link when it has no page", async () => {
    const { charge } = await partnerWeek(null);

    expect(await weeklyChargePass(deps(TODAY))).toBe(1);

    expect(sent).toHaveLength(1);
    expect(sent[0].text).toMatch(/\nMEIER CARS\npowered by ZURIAUTO$/);
    expect(sent[0].text).not.toContain(PAYMENT_URL);
    expect(sent[0].text).not.toMatch(/https?:/);
    expect((await prisma.charge.findUniqueOrThrow({ where: { id: charge.id } })).paymentUrl).toBeNull();
  });

  it("points at the partner's own page, on the reminder too", async () => {
    const { charge } = await partnerWeek("https://pay.meier.example");

    await weeklyChargePass(deps(TODAY));
    expect(sent[0].text).toContain("https://pay.meier.example");
    expect((await prisma.charge.findUniqueOrThrow({ where: { id: charge.id } })).paymentUrl).toBe(
      "https://pay.meier.example"
    );

    sent.length = 0;
    expect(await chargeReminderPass(deps(new Date("2026-11-13T10:00:00Z")))).toBe(1);
    expect(sent[0].text).toContain("https://pay.meier.example");
    expect(sent[0].text).not.toContain(PAYMENT_URL);
  });
});
