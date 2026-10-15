import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { closeRental, RETURN_CLOSE_EVENT } from "@/lib/rental/closeRental";
import type { LifecycleMailConfig } from "@/lib/rental/lifecycleMail";
import {
  preEndReminderPass,
  rentalOverduePass,
  runningWeeksPass,
  weeklyChargePass,
} from "@/lib/rental/scheduler";
import { pickupDetails, seedOrganisation, seedRental } from "./fineHelpers";

/**
 * A weekly rental with no number of weeks, as the pickup form records it since
 * 16.10.2026: it runs until the car comes back. Made through `persistPickup`
 * and `closeRental`, as production makes it, and driven through the daily run
 * week by week.
 */

const sent: { to: string; subject: string }[] = [];

vi.mock("@/lib/rental/lifecycleMail", async (importOriginal) => {
  const original = await importOriginal<
    typeof import("@/lib/rental/lifecycleMail")
  >();
  return {
    ...original,
    sendMail: async (_config: unknown, message: { to: string; subject: string }) => {
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

const deps = (now: Date) => ({
  client: prisma,
  now,
  baseUrl: "https://zuriauto.ch",
  mail,
});

// Monday 5 October 2026, 10:00 in Zurich.
const START = new Date("2026-10-05T08:00:00.000Z");
/** The Zurich morning of the day `weeks` whole weeks after the start. */
const morningOfWeek = (weeks: number) =>
  new Date(START.getTime() + weeks * 7 * 86_400_000 - 2 * 3_600_000);

beforeEach(() => {
  sent.length = 0;
});

async function aRunningRental() {
  const { id: organisationId } = await seedOrganisation();
  const rental = await seedRental(organisationId, {
    signedAt: START,
    details: pickupDetails({
      terms: {
        type: "WEEKLY",
        startAt: START.toISOString(),
        weeklyAmountCents: 45_000,
        depositCents: 50_000,
        paymentMethod: "cash",
      },
    }),
  });
  return { organisationId, rental };
}

const weekNumbers = async () =>
  (
    await prisma.charge.findMany({
      where: { weekNumber: { gt: 0 } },
      orderBy: { weekNumber: "asc" },
      select: { weekNumber: true },
    })
  ).map((charge) => charge.weekNumber);

async function closeBy(
  organisationId: string,
  rental: { id: string; carId: string },
  at: Date,
  type: string
) {
  await prisma.$transaction((tx) =>
    closeRental(tx, {
      organisationId,
      rentalId: rental.id,
      carId: rental.carId,
      fromStatuses: ["ACTIVE", "EXTENSION_REQUESTED", "RETURN_SUBMITTED"],
      settlement: null,
      event: { type, payload: {} },
      now: at,
    })
  );
}

describe("a running weekly rental", () => {
  it("starts with week 1 and no end", async () => {
    await aRunningRental();
    const rental = await prisma.rental.findFirstOrThrow();
    expect(rental.endAt).toBeNull();
    expect(rental.totalWeeks).toBeNull();
    expect(rental.paymentMethod).toBe("CASH");
    expect(await weekNumbers()).toEqual([1]);
  });

  it("gets each week on the morning it begins, requested in the same run", async () => {
    await aRunningRental();

    // The day before week 2: nothing to add.
    expect(await runningWeeksPass(deps(morningOfWeek(1.0 - 1 / 7)))).toBe(0);
    expect(await weekNumbers()).toEqual([1]);

    // Week 2's morning, two hours before its hour.
    expect(await runningWeeksPass(deps(morningOfWeek(1)))).toBe(1);
    expect(await weekNumbers()).toEqual([1, 2]);

    // Week 1 and week 2 are both due by now, and the charge pass asks for them.
    expect(await weeklyChargePass(deps(morningOfWeek(1)))).toBe(2);
    const week2 = await prisma.charge.findFirstOrThrow({ where: { weekNumber: 2 } });
    expect(week2.status).toBe("REQUESTED");
    expect(week2.amountCents).toBe(45_000);
    expect(week2.dueDate.toISOString()).toBe("2026-10-12T08:00:00.000Z");
  });

  it("writes nothing twice when the run repeats", async () => {
    await aRunningRental();
    await runningWeeksPass(deps(morningOfWeek(1)));
    expect(await runningWeeksPass(deps(morningOfWeek(1)))).toBe(0);
    expect(await weekNumbers()).toEqual([1, 2]);
  });

  it("catches up on the weeks a missed run would have added", async () => {
    await aRunningRental();
    expect(await runningWeeksPass(deps(morningOfWeek(3)))).toBe(3);
    expect(await weekNumbers()).toEqual([1, 2, 3, 4]);
  });

  it("is never reminded of an end, nor reported overdue", async () => {
    await aRunningRental();
    for (const weeks of [0, 1, 4, 30]) {
      expect(await preEndReminderPass(deps(morningOfWeek(weeks)))).toBe(0);
      expect(await rentalOverduePass(deps(morningOfWeek(weeks)))).toBe(0);
    }
    expect(sent).toEqual([]);
  });

  it("closed by the return, keeps the weeks begun before it and gets no more", async () => {
    const { organisationId, rental } = await aRunningRental();
    await runningWeeksPass(deps(morningOfWeek(1)));

    // Back at 10:01 on the day week 3 began at 10:00 — before any run added
    // week 3, so only the weeks bounded by the return can supply it.
    const returnedAt = new Date("2026-10-19T08:01:00.000Z");
    await closeBy(organisationId, rental, returnedAt, RETURN_CLOSE_EVENT);

    const closed = await prisma.rental.findUniqueOrThrow({ where: { id: rental.id } });
    expect(closed.status).toBe("COMPLETED");
    expect(closed.endAt?.toISOString()).toBe(returnedAt.toISOString());

    expect(await runningWeeksPass(deps(morningOfWeek(6)))).toBe(1);
    expect(await weekNumbers()).toEqual([1, 2, 3]);
    expect(await runningWeeksPass(deps(morningOfWeek(9)))).toBe(0);
  });

  it("closed by the office, gets no more weeks", async () => {
    const { organisationId, rental } = await aRunningRental();
    await closeBy(
      organisationId,
      rental,
      new Date("2026-10-20T08:00:00.000Z"),
      "rental.closed.manual"
    );
    expect(await runningWeeksPass(deps(morningOfWeek(6)))).toBe(0);
    expect(await weekNumbers()).toEqual([1]);
  });

  it("leaves a rental with a number of weeks to its own schedule", async () => {
    // Recorded before 16.10.2026: its weeks were all written at the pickup.
    const { organisationId, rental } = await aRunningRental();
    await prisma.rental.update({
      where: { id: rental.id },
      data: { totalWeeks: 1, endAt: new Date("2026-10-12T08:00:00.000Z") },
    });
    expect(await runningWeeksPass(deps(morningOfWeek(4)))).toBe(0);
    expect(organisationId).toBeTruthy();
  });
});
