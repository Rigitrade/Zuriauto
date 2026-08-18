import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { hashToken } from "@/lib/rental/actionToken";
import {
  chargeOverduePass,
  chargeReminderPass,
  preEndReminderPass,
  rentalOverduePass,
  runDailyPasses,
  weeklyChargePass,
} from "@/lib/rental/scheduler";
import type { LifecycleMailConfig } from "@/lib/rental/lifecycleMail";
import { ensureOrganisation, seedFleet } from "@/prisma/seed";

// ---------------------------------------------------------------------
// Mail is mocked at the module boundary, so the passes exercise their real
// claim-then-send logic while nothing leaves the machine. `sent` is the
// assertion surface: the tests care how many messages were *decided on*.
// ---------------------------------------------------------------------

const sent: { to: string; subject: string; text: string }[] = [];
let failNextSends = 0;

vi.mock("@/lib/rental/lifecycleMail", async (importOriginal) => {
  const original = await importOriginal<
    typeof import("@/lib/rental/lifecycleMail")
  >();
  return {
    ...original,
    sendMail: async (
      _config: unknown,
      message: { to: string; subject: string; text: string }
    ) => {
      if (failNextSends > 0) {
        failNextSends -= 1;
        throw new Error("smtp exploded");
      }
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

const BASE = "https://zuriauto.ch";

beforeEach(() => {
  sent.length = 0;
  failNextSends = 0;
});

// ---------------------------------------------------------------------

async function aWeeklyRental(opts: {
  startAt: Date;
  totalWeeks: number;
  weeklyAmountCents?: number;
  endAt?: Date;
  gtcLanguage?: string;
  status?: "ACTIVE" | "COMPLETED";
}) {
  const org = await ensureOrganisation(prisma);
  await seedFleet(prisma, org.id);
  const car = await prisma.car.findFirstOrThrow({ where: { status: "available" } });

  const customer = await prisma.customer.create({
    data: {
      organisationId: org.id,
      firstName: "Anna",
      lastName: "Meier",
      email: `anna${Math.abs(opts.startAt.getTime())}@example.ch`,
      phone: "+41791234567",
      birthDate: new Date("1990-04-12T00:00:00.000Z"),
      street: "Bahnhofstrasse 1",
      postalCode: "8001",
      city: "Zürich",
      country: "Switzerland",
    },
  });

  const endAt =
    opts.endAt ??
    new Date(opts.startAt.getTime() + opts.totalWeeks * 7 * 86_400_000);

  const rental = await prisma.rental.create({
    data: {
      organisationId: org.id,
      carId: car.id,
      customerId: customer.id,
      createdBy: "office",
      type: "WEEKLY",
      status: opts.status ?? "ACTIVE",
      startAt: opts.startAt,
      endAt,
      totalWeeks: opts.totalWeeks,
      weeklyAmountCents: opts.weeklyAmountCents ?? 45_000,
      billingWeekday: 2,
    },
  });

  await prisma.contract.create({
    data: {
      organisationId: org.id,
      rentalId: rental.id,
      contractNumber: `ZA-TEST-${rental.id.slice(-6)}`,
      createdBy: "office",
      kind: "PICKUP",
      mileageKm: 1000,
      fuelLevel: "full",
      gtcVersion: "2026-07-31",
      gtcLanguage: opts.gtcLanguage ?? "de",
      acceptedAt: opts.startAt,
    },
  });

  return { organisationId: org.id, rental, customer, car };
}

const deps = (now: Date) => ({ client: prisma, now, baseUrl: BASE, mail });

// ---------------------------------------------------------------------

describe("preEndReminderPass", () => {
  it("reminds a rental ending in 36 hours", async () => {
    const now = new Date("2026-08-18T09:00:00Z");
    await aWeeklyRental({
      startAt: new Date("2026-07-21T09:00:00Z"),
      totalWeeks: 4,
      endAt: new Date("2026-08-19T21:00:00Z"),
    });

    expect(await preEndReminderPass(deps(now))).toBe(1);
    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toContain("Ihre Miete endet");
  });

  it("does not remind a rental ending in 90 hours", async () => {
    const now = new Date("2026-08-18T09:00:00Z");
    await aWeeklyRental({
      startAt: new Date("2026-07-21T09:00:00Z"),
      totalWeeks: 4,
      endAt: new Date("2026-08-22T03:00:00Z"),
    });

    expect(await preEndReminderPass(deps(now))).toBe(0);
    expect(sent).toHaveLength(0);
  });

  it("writes to the renter in the language they signed in", async () => {
    const now = new Date("2026-08-18T09:00:00Z");
    await aWeeklyRental({
      startAt: new Date("2026-07-21T09:00:00Z"),
      totalWeeks: 4,
      endAt: new Date("2026-08-19T21:00:00Z"),
      gtcLanguage: "en",
    });

    await preEndReminderPass(deps(now));
    expect(sent[0].subject).toContain("Your rental ends");
  });

  it("sends exactly once however many times the pass runs", async () => {
    // The property the whole design exists for. A reminder that goes twice is
    // worse than one that goes late.
    const now = new Date("2026-08-18T09:00:00Z");
    await aWeeklyRental({
      startAt: new Date("2026-07-21T09:00:00Z"),
      totalWeeks: 4,
      endAt: new Date("2026-08-19T21:00:00Z"),
    });

    await preEndReminderPass(deps(now));
    await preEndReminderPass(deps(now));
    await preEndReminderPass(deps(new Date("2026-08-18T21:00:00Z")));

    expect(sent).toHaveLength(1);
    expect(await prisma.notification.count({ where: { kind: "RENTAL_ENDING" } }))
      .toBe(1);
  });

  it("survives two concurrent runs", async () => {
    // Two crons firing at once, or a manual curl racing the schedule.
    const now = new Date("2026-08-18T09:00:00Z");
    await aWeeklyRental({
      startAt: new Date("2026-07-21T09:00:00Z"),
      totalWeeks: 4,
      endAt: new Date("2026-08-19T21:00:00Z"),
    });

    await Promise.all([
      preEndReminderPass(deps(now)),
      preEndReminderPass(deps(now)),
    ]);

    expect(sent).toHaveLength(1);
  });

  it("mints exactly one usable token, and puts its link in the email", async () => {
    const now = new Date("2026-08-18T09:00:00Z");
    await aWeeklyRental({
      startAt: new Date("2026-07-21T09:00:00Z"),
      totalWeeks: 4,
      endAt: new Date("2026-08-19T21:00:00Z"),
    });

    await preEndReminderPass(deps(now));

    const tokens = await prisma.actionToken.findMany();
    expect(tokens).toHaveLength(1);

    // The raw token is only in the email; prove the stored hash matches it.
    const link = sent[0].text.match(/\?t=([A-Za-z0-9_-]+)/);
    expect(link).not.toBeNull();
    expect(hashToken(link![1])).toBe(tokens[0].tokenHash);
  });

  it("ignores a rental that is no longer active", async () => {
    const now = new Date("2026-08-18T09:00:00Z");
    await aWeeklyRental({
      startAt: new Date("2026-07-21T09:00:00Z"),
      totalWeeks: 4,
      endAt: new Date("2026-08-19T21:00:00Z"),
      status: "COMPLETED",
    });

    expect(await preEndReminderPass(deps(now))).toBe(0);
  });

  it("records the failure and leaves no token when mail breaks", async () => {
    const now = new Date("2026-08-18T09:00:00Z");
    await aWeeklyRental({
      startAt: new Date("2026-07-21T09:00:00Z"),
      totalWeeks: 4,
      endAt: new Date("2026-08-19T21:00:00Z"),
    });

    failNextSends = 1;
    expect(await preEndReminderPass(deps(now))).toBe(0);

    const row = await prisma.notification.findFirstOrThrow();
    expect(row.sentAt).toBeNull();
    expect(row.error).toContain("smtp exploded");
    expect(row.attempts).toBe(1);
  });
});

describe("weeklyChargePass", () => {
  async function withSchedule(now: Date) {
    const { organisationId, rental } = await aWeeklyRental({
      startAt: new Date("2026-08-18T08:00:00Z"),
      totalWeeks: 3,
    });
    await prisma.charge.createMany({
      data: [1, 2, 3].map((weekNumber) => ({
        organisationId,
        rentalId: rental.id,
        weekNumber,
        dueDate: new Date(
          new Date("2026-08-18T08:00:00Z").getTime() +
            (weekNumber - 1) * 7 * 86_400_000
        ),
        amountCents: 45_000,
      })),
    });
    return { rental, now };
  }

  it("requests only the charge that is due", async () => {
    const now = new Date("2026-08-18T09:00:00Z");
    await withSchedule(now);

    expect(await weeklyChargePass(deps(now))).toBe(1);
    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toContain("Woche 1");

    const statuses = await prisma.charge.findMany({
      orderBy: { weekNumber: "asc" },
      select: { weekNumber: true, status: true },
    });
    expect(statuses).toEqual([
      { weekNumber: 1, status: "REQUESTED" },
      { weekNumber: 2, status: "SCHEDULED" },
      { weekNumber: 3, status: "SCHEDULED" },
    ]);
  });

  it("does not request the same week twice", async () => {
    const now = new Date("2026-08-18T09:00:00Z");
    await withSchedule(now);

    await weeklyChargePass(deps(now));
    await weeklyChargePass(deps(now));

    expect(sent).toHaveLength(1);
  });

  it("catches up a charge whose due date has passed", async () => {
    const { rental } = await withSchedule(new Date("2026-08-18T09:00:00Z"));
    // Three weeks later, nothing has run. Weeks 1–3 are all due.
    const later = new Date("2026-09-02T09:00:00Z");

    expect(await weeklyChargePass(deps(later))).toBe(3);
    expect(
      await prisma.charge.count({
        where: { rentalId: rental.id, status: "REQUESTED" },
      })
    ).toBe(3);
  });

  it("states the amount in the email, because a static link cannot carry it", async () => {
    const now = new Date("2026-08-18T09:00:00Z");
    await withSchedule(now);
    await weeklyChargePass(deps(now));
    expect(sent[0].text).toContain("CHF 450.00");
  });
});

describe("chargeReminderPass and chargeOverduePass", () => {
  async function requested(now: Date) {
    const { organisationId, rental } = await aWeeklyRental({
      startAt: new Date("2026-08-18T08:00:00Z"),
      totalWeeks: 2,
    });
    await prisma.charge.create({
      data: {
        organisationId,
        rentalId: rental.id,
        weekNumber: 1,
        dueDate: new Date("2026-08-18T08:00:00Z"),
        amountCents: 45_000,
        status: "REQUESTED",
        requestedAt: now,
        paymentUrl: "https://pay.example/x",
      },
    });
    return rental;
  }

  it("reminds after the threshold and alerts the office after the next one", async () => {
    const requestedAt = new Date("2026-08-18T09:00:00Z");
    await requested(requestedAt);

    // 72 h default: nothing yet at 48 h.
    expect(
      await chargeReminderPass(deps(new Date("2026-08-20T09:00:00Z")))
    ).toBe(0);

    const afterRemind = new Date("2026-08-21T10:00:00Z");
    expect(await chargeReminderPass(deps(afterRemind))).toBe(1);
    expect(sent.at(-1)!.subject).toContain("Erinnerung");

    // 48 h default for the office alert.
    expect(
      await chargeOverduePass(deps(new Date("2026-08-22T10:00:00Z")))
    ).toBe(0);

    const afterAlert = new Date("2026-08-23T11:00:00Z");
    expect(await chargeOverduePass(deps(afterAlert))).toBe(1);
    expect(sent.at(-1)!.to).toBe("office@zuriauto.ch");
    expect(sent.at(-1)!.subject).toContain("Zahlung offen");

    const charge = await prisma.charge.findFirstOrThrow();
    expect(charge.status).toBe("OVERDUE");
  });

  it("leaves a paid charge alone", async () => {
    const requestedAt = new Date("2026-08-18T09:00:00Z");
    await requested(requestedAt);
    await prisma.charge.updateMany({
      data: { status: "PAID", paidAt: requestedAt },
    });

    expect(
      await chargeReminderPass(deps(new Date("2026-09-01T09:00:00Z")))
    ).toBe(0);
    expect(sent).toHaveLength(0);
  });
});

describe("rentalOverduePass", () => {
  it("alerts the office once for a late car", async () => {
    const now = new Date("2026-08-20T09:00:00Z");
    await aWeeklyRental({
      startAt: new Date("2026-07-21T09:00:00Z"),
      totalWeeks: 4,
      endAt: new Date("2026-08-18T09:00:00Z"),
    });

    expect(await rentalOverduePass(deps(now))).toBe(1);
    expect(await rentalOverduePass(deps(now))).toBe(0);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("office@zuriauto.ch");
    expect(sent[0].subject).toContain("Überfällig");
  });

  it("does not alert on a rental still running", async () => {
    const now = new Date("2026-08-18T09:00:00Z");
    await aWeeklyRental({
      startAt: new Date("2026-08-11T09:00:00Z"),
      totalWeeks: 4,
      endAt: new Date("2026-09-08T09:00:00Z"),
    });

    expect(await rentalOverduePass(deps(now))).toBe(0);
  });
});

describe("runDailyPasses", () => {
  it("is a no-op the second time it runs on the same day", async () => {
    // The spec's headline error-handling promise: a cron that fires twice in a
    // minute must not double-send anything.
    const now = new Date("2026-08-18T09:00:00Z");
    const { organisationId, rental } = await aWeeklyRental({
      startAt: new Date("2026-08-18T08:00:00Z"),
      totalWeeks: 1,
      endAt: new Date("2026-08-19T21:00:00Z"),
    });
    await prisma.charge.create({
      data: {
        organisationId,
        rentalId: rental.id,
        weekNumber: 1,
        dueDate: new Date("2026-08-18T08:00:00Z"),
        amountCents: 45_000,
      },
    });

    const first = await runDailyPasses({ client: prisma, now, baseUrl: BASE, mail });
    const countAfterFirst = sent.length;

    const second = await runDailyPasses({ client: prisma, now, baseUrl: BASE, mail });

    expect(first.reminded).toBe(1);
    expect(first.charged).toBe(1);
    expect(second.reminded).toBe(0);
    expect(second.charged).toBe(0);
    expect(sent).toHaveLength(countAfterFirst);
  });

  it("retries a failed message to the office on the next run", async () => {
    const now = new Date("2026-08-18T09:00:00Z");
    await aWeeklyRental({
      startAt: new Date("2026-07-21T09:00:00Z"),
      totalWeeks: 4,
      endAt: new Date("2026-08-19T21:00:00Z"),
    });

    // The reminder's send fails.
    failNextSends = 1;
    await runDailyPasses({ client: prisma, now, baseUrl: BASE, mail });
    expect(sent).toHaveLength(0);

    // Next run: the reminder is still claimed, so it is not re-sent to the
    // renter — but the office is told delivery failed.
    const next = await runDailyPasses({
      client: prisma,
      now: new Date("2026-08-19T09:00:00Z"),
      baseUrl: BASE,
      mail,
    });

    expect(next.mailRetried).toBe(1);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("office@zuriauto.ch");
    expect(sent[0].subject).toContain("Zustellung fehlgeschlagen");
  });

  it("gives up after three attempts", async () => {
    const now = new Date("2026-08-18T09:00:00Z");
    await aWeeklyRental({
      startAt: new Date("2026-07-21T09:00:00Z"),
      totalWeeks: 4,
      endAt: new Date("2026-08-19T21:00:00Z"),
    });

    failNextSends = 99;
    await runDailyPasses({ client: prisma, now, baseUrl: BASE, mail });
    for (let day = 1; day <= 5; day += 1) {
      await runDailyPasses({
        client: prisma,
        now: new Date(now.getTime() + day * 86_400_000),
        baseUrl: BASE,
        mail,
      });
    }

    const row = await prisma.notification.findFirstOrThrow({
      where: { kind: "RENTAL_ENDING" },
    });
    expect(row.attempts).toBe(3);
    expect(row.sentAt).toBeNull();
  });
});

describe("token hygiene", () => {
  it("withdraws the token when the reminder cannot be sent", async () => {
    // The token must be minted before the send, because the email carries its
    // link. If the send fails, nobody holds it — so it must not sit in the
    // table as a live credential for a fortnight.
    const now = new Date("2026-08-18T09:00:00Z");
    await aWeeklyRental({
      startAt: new Date("2026-07-21T09:00:00Z"),
      totalWeeks: 4,
      endAt: new Date("2026-08-19T21:00:00Z"),
    });

    failNextSends = 1;
    await preEndReminderPass(deps(now));

    expect(await prisma.actionToken.count()).toBe(0);
  });
});
