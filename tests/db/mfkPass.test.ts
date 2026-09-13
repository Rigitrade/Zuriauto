import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { mfkDuePass } from "@/lib/rental/scheduler";
import { ensureOrganisation, seedFleet } from "@/prisma/seed";
import type { LifecycleMailConfig } from "@/lib/rental/lifecycleMail";

/**
 * The annual technical inspection.
 *
 * Two things happen two days out, and which one depends on where the car is:
 * a car sitting on the forecourt is taken off the road so nobody hands it to a
 * renter days before its inspection, and a car that is already out is left
 * alone but reported with the renter's number so the office can call them.
 */

/** Captures what would have been sent, the same way scheduler.test.ts does:
 *  the assertions are about content, and no SMTP server is involved. */
const sent: { to: string; subject: string; text: string }[] = [];

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

async function car(options: { mfkDate: string | null; status?: "available" | "rented" }) {
  const org = await ensureOrganisation(prisma);
  await seedFleet(prisma, org.id);
  const row = await prisma.car.findFirstOrThrow({
    where: { organisationId: org.id, slug: "vito-119-zh323239" },
    select: { id: true },
  });
  await prisma.car.update({
    where: { id: row.id },
    data: {
      mfkDate: options.mfkDate ? new Date(`${options.mfkDate}T00:00:00.000Z`) : null,
      status: options.status ?? "available",
    },
  });
  return { org, carId: row.id };
}

async function rentTheCar(organisationId: string, carId: string) {
  const customer = await prisma.customer.create({
    data: {
      organisationId,
      firstName: "Maria",
      lastName: "Keller",
      email: "maria@example.ch",
      phone: "079 123 45 67",
      birthDate: new Date("1990-04-12"),
      street: "Bahnhofstrasse 1",
      postalCode: "8001",
      city: "Zürich",
      country: "Switzerland",
    },
    select: { id: true },
  });
  await prisma.rental.create({
    data: {
      organisationId,
      carId,
      customerId: customer.id,
      createdBy: "office",
      type: "WEEKLY",
      status: "ACTIVE",
      startAt: new Date("2026-07-01T08:00:00.000Z"),
      endAt: new Date("2026-07-30T08:00:00.000Z"),
    },
  });
  await prisma.car.update({ where: { id: carId }, data: { status: "rented" } });
}

/** 07:00 Zurich on the 12th — two days before an inspection on the 14th. */
const NOW = new Date("2026-07-12T05:00:00.000Z");

function deps(now = NOW) {
  return { client: prisma, now, baseUrl: "https://zuriauto.ch", mail };
}

describe("mfkDuePass", () => {
  beforeEach(() => {
    sent.length = 0;
  });

  it("ignores a car with no inspection date recorded", async () => {
    await car({ mfkDate: null });
    expect(await mfkDuePass(deps())).toBe(0);
    expect(await prisma.carNotification.count()).toBe(0);
  });

  it("ignores a car whose inspection is still a week away", async () => {
    await car({ mfkDate: "2026-07-19" });
    expect(await mfkDuePass(deps())).toBe(0);
    expect(await prisma.carNotification.count()).toBe(0);
  });

  it("warns the office two days before", async () => {
    await car({ mfkDate: "2026-07-14" });

    expect(await mfkDuePass(deps())).toBe(1);

    const claims = await prisma.carNotification.findMany();
    expect(claims).toHaveLength(1);
    expect(claims[0].kind).toBe("MFK_DUE");
    // Keyed to the inspection date, never the run: that is what makes a second
    // run today silent and a corrected date audible.
    expect(claims[0].dedupeKey).toBe("2026-07-14");
    expect(claims[0].sentAt).not.toBeNull();
  });

  it("takes an idle car off the road so nobody rents it out first", async () => {
    const { carId } = await car({ mfkDate: "2026-07-14" });

    await mfkDuePass(deps());

    const after = await prisma.car.findUniqueOrThrow({ where: { id: carId } });
    // Not "available" is the whole mechanism: /api/fleet/ serves only
    // available cars, so this removes it from the pickup picker.
    expect(after.status).toBe("maintenance");
  });

  it("leaves a rented car rented, because it is already out", async () => {
    const { org, carId } = await car({ mfkDate: "2026-07-14" });
    await rentTheCar(org.id, carId);

    expect(await mfkDuePass(deps())).toBe(1);

    const after = await prisma.car.findUniqueOrThrow({ where: { id: carId } });
    // Blocking here would be a lie about where the car is, and would break the
    // return flow that expects to find it rented.
    expect(after.status).toBe("rented");
  });

  it("sends the renter's number when the car is out, so the office can call", async () => {
    const { org, carId } = await car({ mfkDate: "2026-07-14" });
    await rentTheCar(org.id, carId);

    await mfkDuePass(deps());

    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("office@zuriauto.ch");
    expect(sent[0].text).toContain("Maria Keller");
    expect(sent[0].text).toContain("079 123 45 67");
    // The date the office has to work back from, not just "soon".
    expect(sent[0].subject).toContain("14.07.2026");
  });

  it("warns once, however many times the day's run happens", async () => {
    await car({ mfkDate: "2026-07-14" });

    expect(await mfkDuePass(deps())).toBe(1);
    expect(await mfkDuePass(deps())).toBe(0);
    expect(await mfkDuePass(deps(new Date("2026-07-13T05:00:00.000Z")))).toBe(0);

    expect(await prisma.carNotification.count()).toBe(1);
  });

  it("warns again once the office records the next inspection", async () => {
    const { carId } = await car({ mfkDate: "2026-07-14" });
    await mfkDuePass(deps());

    // The inspection was done and the new date entered; a year later the
    // office must be warned again rather than silenced by the old claim.
    await prisma.car.update({
      where: { id: carId },
      data: { mfkDate: new Date("2027-07-14T00:00:00.000Z"), status: "available" },
    });

    expect(await mfkDuePass(deps(new Date("2027-07-12T05:00:00.000Z")))).toBe(1);
    expect(await prisma.carNotification.count()).toBe(2);
  });

  it("still acts on an inspection date that has already gone by", async () => {
    // The car must not quietly become rentable again just because nobody
    // looked at the email.
    const { carId } = await car({ mfkDate: "2026-07-14" });

    expect(await mfkDuePass(deps(new Date("2026-07-20T05:00:00.000Z")))).toBe(1);
    const after = await prisma.car.findUniqueOrThrow({ where: { id: carId } });
    expect(after.status).toBe("maintenance");
  });

  it("re-blocks a car freed without its inspection being recorded", async () => {
    const { carId } = await car({ mfkDate: "2026-07-14" });
    await mfkDuePass(deps());

    // Somebody put it back on the road without entering a new date.
    await prisma.car.update({ where: { id: carId }, data: { status: "available" } });

    await mfkDuePass(deps(new Date("2026-07-13T05:00:00.000Z")));
    const after = await prisma.car.findUniqueOrThrow({ where: { id: carId } });
    expect(after.status).toBe("maintenance");
  });

  it("never touches a retired car", async () => {
    const { carId } = await car({ mfkDate: "2026-07-14" });
    await prisma.car.update({ where: { id: carId }, data: { status: "retired" } });

    await mfkDuePass(deps());

    const after = await prisma.car.findUniqueOrThrow({ where: { id: carId } });
    // Already off the road, and putting it into maintenance would misreport
    // why — the office retired it deliberately.
    expect(after.status).toBe("retired");
  });
});
