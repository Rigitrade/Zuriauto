import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { applyCutover, CutoverAlreadyApplied, planCutover, reopenCharge } from "@/lib/payments/cutover";
import { weeklyChargePass } from "@/lib/rental/scheduler";
import type { LifecycleMailConfig } from "@/lib/rental/lifecycleMail";
import { closeAt, seedOrganisation, seedRental } from "./fineHelpers";

const sent: { to: string }[] = [];
vi.mock("@/lib/rental/lifecycleMail", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/rental/lifecycleMail")>();
  return { ...original, sendMail: async (_config: unknown, message: { to: string }) => void sent.push(message) };
});
const mail: LifecycleMailConfig = {
  host: "localhost",
  port: 587,
  user: "u",
  pass: "p",
  from: "noreply@zuriauto.ch",
  office: "office@zuriauto.ch",
};
beforeEach(() => void (sent.length = 0));

const office = { id: "user-1", displayName: "Ahmed" };
// seedRental: 8 weeks from 01.06, week N due 01.06 + (N-1) weeks.
const BEFORE = new Date("2026-06-20T00:00:00Z"); // weeks 1–3 due before, week 4 (22.06) after

async function setup() {
  const org = await seedOrganisation();
  const rental = await seedRental(org.id, { signedAt: new Date("2026-06-01T08:00:00Z") });
  const week = (n: number) => prisma.charge.findFirstOrThrow({ where: { rentalId: rental.id, weekNumber: n } });
  return { org, rental, week };
}

describe("applyCutover", () => {
  it("settles the open weeks due before the date and leaves later weeks open", async () => {
    const { org, week } = await setup();

    expect((await planCutover(prisma, org.id, BEFORE)).map((c) => c.weekNumber)).toEqual([1, 2, 3]);
    expect(await applyCutover(prisma, org.id, BEFORE)).toEqual({ settled: 3 });

    expect((await week(3)).status).toBe("SETTLED");
    expect((await week(4)).status).toBe("SCHEDULED");
  });

  it("never touches a week a payment already paid, nor a void one", async () => {
    const { org, week } = await setup();
    const paidAt = new Date("2026-06-02T09:00:00Z");
    await prisma.charge.update({ where: { id: (await week(1)).id }, data: { status: "PAID", paidAt } });
    await prisma.charge.update({ where: { id: (await week(2)).id }, data: { status: "VOID" } });

    expect(await applyCutover(prisma, org.id, BEFORE)).toEqual({ settled: 1 });

    expect(await week(1)).toMatchObject({ status: "PAID", paidAt });
    expect((await week(2)).status).toBe("VOID");
  });

  it("settles a returned rental's weeks too, and records what it did on each rental", async () => {
    const { org, rental } = await setup();
    await closeAt(org.id, rental, new Date("2026-06-10T08:00:00Z"));

    await applyCutover(prisma, org.id, BEFORE);

    const event = await prisma.rentalEvent.findFirstOrThrow({ where: { rentalId: rental.id, type: "charges.settled.cutover" } });
    expect(event.payload).toMatchObject({
      before: BEFORE.toISOString(),
      charges: [{ weekNumber: 1, previous: "SCHEDULED" }, { weekNumber: 2 }, { weekNumber: 3 }],
    });
    expect(await prisma.organisation.findUniqueOrThrow({ where: { id: org.id } })).toMatchObject({ paymentsCutoverAt: BEFORE });
  });

  it("leaves a balance declared on the return form open: that is a late payment still to come", async () => {
    const { org, rental } = await setup();
    const balance = await prisma.charge.create({
      data: { organisationId: org.id, rentalId: rental.id, weekNumber: 0, dueDate: new Date("2026-06-12T00:00:00Z"), amountCents: 8_000 },
    });

    expect(await applyCutover(prisma, org.id, BEFORE)).toEqual({ settled: 3 });

    expect((await prisma.charge.findUniqueOrThrow({ where: { id: balance.id } })).status).toBe("SCHEDULED");
  });

  it("changes nothing the second time", async () => {
    const { org } = await setup();
    await applyCutover(prisma, org.id, BEFORE);

    expect(await applyCutover(prisma, org.id, BEFORE, { force: true })).toEqual({ settled: 0 });
    expect(await prisma.rentalEvent.count({ where: { type: "charges.settled.cutover" } })).toBe(1);
  });

  it("refuses a second cut-over, which would settle weeks owed since the first", async () => {
    const { org, week } = await setup();
    await applyCutover(prisma, org.id, BEFORE);

    await expect(applyCutover(prisma, org.id, new Date("2026-07-01T00:00:00Z"))).rejects.toBeInstanceOf(CutoverAlreadyApplied);
    expect((await week(4)).status).toBe("SCHEDULED");
    expect(await prisma.organisation.findUniqueOrThrow({ where: { id: org.id } })).toMatchObject({ paymentsCutoverAt: BEFORE });
  });

  it("keeps the daily job from asking for a settled week", async () => {
    const { org } = await setup();
    await applyCutover(prisma, org.id, BEFORE);

    // 21.06: weeks 1–3 are due; without the cut-over all three would be requested.
    const now = new Date("2026-06-21T08:00:00Z");
    expect(await weeklyChargePass({ client: prisma, now, baseUrl: "https://zuriauto.ch", mail })).toBe(0);
    expect(sent).toHaveLength(0);
  });
});

describe("reopenCharge", () => {
  it("puts a settled week back to scheduled and says who did it", async () => {
    const { org, rental, week } = await setup();
    await applyCutover(prisma, org.id, BEFORE);
    const week2 = await week(2);

    expect(await reopenCharge(prisma, week2.id, office)).toEqual({ ok: true });

    expect((await week(2)).status).toBe("SCHEDULED");
    const event = await prisma.rentalEvent.findFirstOrThrow({ where: { rentalId: rental.id, type: "charge.reopened" } });
    expect(event.payload).toMatchObject({ chargeId: week2.id, weekNumber: 2, actorId: "user-1", actorName: "Ahmed" });
  });

  it("refuses a week that is not settled", async () => {
    const { week } = await setup();
    expect(await reopenCharge(prisma, (await week(5)).id, office)).toEqual({ ok: false, code: "conflict" });
  });
});
