import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import {
  chargeOfficeOnlyPass,
  chargeReminderPass,
  planPaymentMails,
  runDailyPasses,
  weeklyChargePass,
} from "@/lib/rental/scheduler";
import { RETURN_CLOSE_EVENT } from "@/lib/rental/closeRental";
import type { LifecycleMailConfig } from "@/lib/rental/lifecycleMail";
import { reviewPaymentMail, sentPaymentMails, waiveCharge } from "@/lib/payments/mails";
import { ensureOrganisation, seedFleet } from "@/prisma/seed";

/**
 * The rules written after 05.11.2026, when the first daily run in weeks asked
 * 23 renters for weeks long paid or never owed: payment emails go to the
 * office, not the renter, when the car is back or the week is old; a run that
 * would send too many sends none; every payment email says "already paid?
 * ignore this"; and the office can answer a wrong one with a correction.
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
const OFFICE = mail.office;
const deps = (now: Date, extra: { releaseHoldFor?: string } = {}) => ({
  client: prisma,
  now,
  baseUrl: "https://zuriauto.ch",
  mail,
  ...extra,
});
const actor = { id: "admin-1", displayName: "Büro Test" };

beforeEach(() => {
  sent.length = 0;
});

let seq = 0;

/** A weekly rental with one week falling due on `dueDate`. */
async function aRentalWithWeek(opts: {
  dueDate: Date;
  status?: "ACTIVE" | "COMPLETED";
  returnedAt?: Date;
  email?: string;
  gtcLanguage?: string;
  weekNumber?: number;
}) {
  seq += 1;
  const org = await ensureOrganisation(prisma);
  await seedFleet(prisma, org.id);
  const car = await prisma.car.findFirstOrThrow({ where: { status: "available" } });
  const customer = await prisma.customer.create({
    data: {
      organisationId: org.id,
      firstName: `Renter${seq}`,
      lastName: "Test",
      email: opts.email ?? `renter${seq}@example.ch`,
      phone: "+41791234567",
      birthDate: new Date("1990-04-12T00:00:00.000Z"),
      street: "Bahnhofstrasse 1",
      postalCode: "8001",
      city: "Zürich",
      country: "Switzerland",
    },
  });
  const weekNumber = opts.weekNumber ?? 1;
  const startAt = new Date(opts.dueDate.getTime() - (weekNumber - 1) * 7 * 86_400_000);
  const rental = await prisma.rental.create({
    data: {
      organisationId: org.id,
      carId: car.id,
      customerId: customer.id,
      createdBy: "office",
      type: "WEEKLY",
      status: opts.status ?? "ACTIVE",
      startAt,
      endAt: new Date(startAt.getTime() + 8 * 7 * 86_400_000),
      totalWeeks: 8,
      weeklyAmountCents: 25_000,
      billingWeekday: 2,
    },
  });
  await prisma.contract.create({
    data: {
      organisationId: org.id,
      rentalId: rental.id,
      contractNumber: `ZA-SAFE-${rental.id.slice(-6)}`,
      createdBy: "office",
      kind: "PICKUP",
      mileageKm: 1000,
      fuelLevel: "full",
      gtcVersion: "2026-07-31",
      gtcLanguage: opts.gtcLanguage ?? "de",
      acceptedAt: startAt,
    },
  });
  if (opts.returnedAt) {
    await prisma.rentalEvent.create({
      data: { rentalId: rental.id, type: RETURN_CLOSE_EVENT, createdAt: opts.returnedAt },
    });
  }
  const charge = await prisma.charge.create({
    data: {
      organisationId: org.id,
      rentalId: rental.id,
      weekNumber,
      dueDate: opts.dueDate,
      amountCents: 25_000,
    },
  });
  return { organisationId: org.id, rental, customer, charge };
}

const TODAY = new Date("2026-11-10T09:00:00Z");
const DUE_TODAY = new Date("2026-11-10T07:00:00Z");

describe("every payment email says: already paid? ignore it", () => {
  it("in German, near the top, with the due date", async () => {
    const { customer } = await aRentalWithWeek({ dueDate: DUE_TODAY });
    expect(await weeklyChargePass(deps(TODAY))).toBe(1);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe(customer.email);
    const lines = sent[0].text.split("\n");
    const ignore = lines.findIndex((l) => l.startsWith("Bereits bezahlt"));
    expect(ignore).toBeGreaterThan(0);
    expect(ignore).toBeLessThan(lines.findIndex((l) => l.startsWith("Betrag:")));
    expect(sent[0].text).toContain("als gegenstandslos");
    expect(sent[0].text).toContain("Fällig am: 10.11.2026");
  });

  it("in English for a renter who signed in English, on the reminder too", async () => {
    const { charge } = await aRentalWithWeek({ dueDate: DUE_TODAY, gtcLanguage: "en" });
    await weeklyChargePass(deps(TODAY));
    expect(sent[0].text).toContain("Already paid");
    expect(sent[0].text).toContain("please ignore this message");

    sent.length = 0;
    await prisma.charge.update({ where: { id: charge.id }, data: { requestedAt: new Date("2026-11-10T09:00:00Z") } });
    expect(await chargeReminderPass(deps(new Date("2026-11-13T10:00:00Z")))).toBe(1);
    expect(sent[0].subject).toContain("Reminder");
    expect(sent[0].text).toContain("Already paid");
  });
});

describe("office only, never the renter", () => {
  it("for a renter who has returned the car", async () => {
    const { customer, charge } = await aRentalWithWeek({
      dueDate: new Date("2026-11-08T07:00:00Z"),
      status: "COMPLETED",
      returnedAt: new Date("2026-11-09T10:00:00Z"),
    });

    expect(await weeklyChargePass(deps(TODAY))).toBe(0);
    expect(sent).toHaveLength(0);

    expect(await chargeOfficeOnlyPass(deps(TODAY))).toBe(1);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe(OFFICE);
    expect(sent[0].subject).toContain("nicht an Mieter gesendet");
    expect(sent[0].text).toContain("bereits zurück");
    expect(sent.map((m) => m.to)).not.toContain(customer.email);
    expect(await prisma.charge.findUniqueOrThrow({ where: { id: charge.id } })).toMatchObject({ status: "OVERDUE" });

    // Once: a second run finds nothing to do.
    expect(await chargeOfficeOnlyPass(deps(TODAY))).toBe(0);
    expect(await weeklyChargePass(deps(TODAY))).toBe(0);
    expect(sent).toHaveLength(1);
  });

  it("for a week that fell due more than 14 days ago", async () => {
    await aRentalWithWeek({ dueDate: new Date("2026-10-26T07:00:00Z") });
    const summary = await runDailyPasses({ ...deps(TODAY), fineSend: async () => {} });
    expect(summary.charged).toBe(0);
    expect(summary.chargeOfficeOnly).toBe(1);
    expect(sent.filter((m) => m.to !== OFFICE)).toHaveLength(0);
    expect(sent.some((m) => m.text.includes("älter als die Frist"))).toBe(true);
  });

  it("still writes to the renter about a week 14 days old", async () => {
    await aRentalWithWeek({ dueDate: new Date("2026-10-27T07:00:00Z") });
    expect(await weeklyChargePass(deps(TODAY))).toBe(1);
  });

  it("for a renter without a real email address", async () => {
    await aRentalWithWeek({ dueDate: DUE_TODAY, email: "renter-abc@unrecorded.invalid" });
    expect(await weeklyChargePass(deps(TODAY))).toBe(0);
    expect(await chargeOfficeOnlyPass(deps(TODAY))).toBe(1);
    expect(sent[0].to).toBe(OFFICE);
  });
});

describe("the safety stop", () => {
  it("sends nothing when a run would send more than 10, and tells the office once", async () => {
    for (let i = 0; i < 11; i += 1) await aRentalWithWeek({ dueDate: DUE_TODAY });

    const plan = await planPaymentMails(prisma, TODAY);
    expect(plan.rows).toHaveLength(11);
    expect(plan.held).toHaveLength(1);

    expect(await weeklyChargePass(deps(TODAY))).toBe(0);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe(OFFICE);
    expect(sent[0].subject).toContain("angehalten");
    expect(sent[0].text.match(/^- /gm)).toHaveLength(11);

    // The same day again: still nothing, and no second notice.
    const summary = await runDailyPasses({ ...deps(TODAY), fineSend: async () => {} });
    expect(summary.paymentMailHeld).toBe(11);
    expect(summary.charged).toBe(0);
    expect(sent).toHaveLength(1);
    expect(await prisma.charge.count({ where: { status: "SCHEDULED" } })).toBe(11);
  });

  it("lets the office release what it held", async () => {
    let organisationId = "";
    for (let i = 0; i < 11; i += 1) ({ organisationId } = await aRentalWithWeek({ dueDate: DUE_TODAY }));
    await weeklyChargePass(deps(TODAY));
    sent.length = 0;

    expect(await weeklyChargePass(deps(TODAY, { releaseHoldFor: organisationId }))).toBe(11);
    expect(sent.filter((m) => m.to !== OFFICE)).toHaveLength(11);
  });

  it("sends 10 as normal", async () => {
    for (let i = 0; i < 10; i += 1) await aRentalWithWeek({ dueDate: DUE_TODAY });
    expect(await weeklyChargePass(deps(TODAY))).toBe(10);
    expect(sent.every((m) => m.to !== OFFICE)).toBe(true);
  });
});

describe("the office answers a wrong payment email", () => {
  it("lists one about a week paid before it went out, and sends a correction once", async () => {
    const { organisationId, customer, charge } = await aRentalWithWeek({ dueDate: DUE_TODAY });
    await weeklyChargePass(deps(TODAY));
    // Paid in cash that morning; the office recorded it after the email.
    await prisma.charge.update({
      where: { id: charge.id },
      data: { status: "PAID", paidAt: new Date("2026-11-10T08:00:00Z") },
    });

    const [row] = await sentPaymentMails(prisma, organisationId, TODAY);
    expect(row).toMatchObject({ kind: "CHARGE_REQUESTED", problem: "paidBefore", correctable: true, weekNumber: 1 });

    sent.length = 0;
    const answer = { organisationId, notificationId: row.notificationId, action: "correction" as const, actor, mail, now: TODAY };
    expect(await reviewPaymentMail(prisma, answer)).toEqual({ ok: true });
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe(customer.email);
    expect(sent[0].subject).toContain("Bitte ignorieren");
    expect(sent[0].text).toContain("gegenstandslos");

    // Pressed again: answered, nothing sent twice.
    expect(await reviewPaymentMail(prisma, answer)).toEqual({ ok: true });
    expect(sent).toHaveLength(1);

    const rows = await sentPaymentMails(prisma, organisationId, TODAY);
    const original = rows.find((r) => r.kind === "CHARGE_REQUESTED")!;
    expect(original).toMatchObject({ reviewOutcome: "correction", reviewedByName: "Büro Test" });
    expect(original.correctionSentAt).not.toBeNull();
  });

  it("refuses a correction for a week still owed", async () => {
    const { organisationId } = await aRentalWithWeek({ dueDate: DUE_TODAY });
    await weeklyChargePass(deps(TODAY));
    const [row] = await sentPaymentMails(prisma, organisationId, TODAY);
    expect(row.problem).toBeNull();
    expect(row.correctable).toBe(false);
    sent.length = 0;
    expect(
      await reviewPaymentMail(prisma, { organisationId, notificationId: row.notificationId, action: "correction", actor, mail, now: TODAY })
    ).toEqual({ ok: false, code: "conflict" });
    expect(sent).toHaveLength(0);
  });

  it("waives a week, which then is a problem email to answer", async () => {
    const { organisationId, charge } = await aRentalWithWeek({ dueDate: DUE_TODAY });
    await weeklyChargePass(deps(TODAY));
    expect(await waiveCharge(prisma, { organisationId, chargeId: charge.id, note: "Gratiswoche", actor })).toEqual({ ok: true });
    expect(await prisma.charge.findUniqueOrThrow({ where: { id: charge.id } })).toMatchObject({ status: "VOID" });
    const event = await prisma.rentalEvent.findFirstOrThrow({ where: { type: "charge.waived" } });
    expect(event.payload).toMatchObject({ note: "Gratiswoche", actorName: "Büro Test" });
    const [row] = await sentPaymentMails(prisma, organisationId, TODAY);
    expect(row.problem).toBe("voided");

    // A paid week cannot be waived.
    await prisma.charge.update({ where: { id: charge.id }, data: { status: "PAID" } });
    expect(await waiveCharge(prisma, { organisationId, chargeId: charge.id, note: "x", actor })).toEqual({ ok: false, code: "conflict" });
  });
});

describe("the 05.11.2026 cut-over migration", () => {
  const sql = readFileSync(
    path.join(process.cwd(), "prisma/migrations/20261105120000_payments_cutover_2026_11_05/migration.sql"),
    "utf8"
  );

  it("settles the open weeks due before 05.11 and nothing else, once", async () => {
    const { organisationId, rental } = await aRentalWithWeek({ dueDate: new Date("2026-10-20T07:00:00Z") });
    const week = (weekNumber: number, dueDate: string, status: string) =>
      prisma.charge.create({
        data: { organisationId, rentalId: rental.id, weekNumber, dueDate: new Date(dueDate), amountCents: 25_000, status: status as never },
      });
    await prisma.charge.update({ where: { rentalId_weekNumber: { rentalId: rental.id, weekNumber: 1 } }, data: { status: "REQUESTED" } });
    await week(2, "2026-10-27T07:00:00Z", "PAID");
    await week(3, "2026-11-03T07:00:00Z", "SCHEDULED");
    // 04.11 23:30 UTC is 05.11 in Zurich: on the start day, so left open.
    await week(4, "2026-11-04T23:30:00Z", "REQUESTED");
    await week(0, "2026-10-30T07:00:00Z", "SCHEDULED");

    await prisma.$executeRawUnsafe(sql);

    const statuses = Object.fromEntries(
      (await prisma.charge.findMany({ where: { rentalId: rental.id } })).map((c) => [c.weekNumber, c.status])
    );
    expect(statuses).toEqual({ 0: "SCHEDULED", 1: "SETTLED", 2: "PAID", 3: "SETTLED", 4: "REQUESTED" });
    const event = await prisma.rentalEvent.findFirstOrThrow({ where: { type: "charges.settled.cutover" } });
    expect((event.payload as { charges: { weekNumber: number; previous: string }[] }).charges).toEqual([
      expect.objectContaining({ weekNumber: 1, previous: "REQUESTED" }),
      expect.objectContaining({ weekNumber: 3, previous: "SCHEDULED" }),
    ]);
    expect((await prisma.organisation.findUniqueOrThrow({ where: { id: organisationId } })).paymentsCutoverAt).toEqual(
      new Date("2026-11-04T23:00:00Z")
    );

    // A second run (an organisation already cut over) changes nothing.
    await prisma.charge.update({ where: { rentalId_weekNumber: { rentalId: rental.id, weekNumber: 1 } }, data: { status: "SCHEDULED" } });
    await prisma.$executeRawUnsafe(sql);
    expect((await prisma.charge.findUniqueOrThrow({ where: { rentalId_weekNumber: { rentalId: rental.id, weekNumber: 1 } } })).status).toBe(
      "SCHEDULED"
    );
    expect(await prisma.rentalEvent.count({ where: { type: "charges.settled.cutover" } })).toBe(1);
  });
});
