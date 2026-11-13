import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { mfkDuePass, mfkNoticePass, serviceDuePass } from "@/lib/rental/scheduler";
import { recordOdometer } from "@/lib/rental/odometer";
import { ensureOrganisation, seedFleet } from "@/prisma/seed";
import type { LifecycleMailConfig } from "@/lib/rental/lifecycleMail";

/**
 * The owner's two reminders (05.11.2026).
 *
 * 1. MFK, two weeks before: to the office and to the renter who has the car.
 * 2. The oil service every 10'000 km: the odometer comes from the handovers,
 *    is projected forward at the car's pace (or 10'000 km in 45–60 days), and
 *    the renter and the office are told at what reading and roughly when.
 */

const sent: { to: string; subject: string; text: string; replyTo?: string }[] = [];

vi.mock("@/lib/rental/lifecycleMail", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/rental/lifecycleMail")>();
  return {
    ...original,
    sendMail: async (
      _config: unknown,
      message: { to: string; subject: string; text: string; replyTo?: string }
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

/** 08:00 Zurich, 5 November 2026. */
const NOW = new Date("2026-11-05T07:00:00.000Z");
const daysBefore = (n: number, from = NOW) => new Date(from.getTime() - n * 86_400_000);

function deps(now = NOW) {
  return { client: prisma, now, baseUrl: "https://zuriauto.ch", mail };
}

async function aCar(data: Record<string, unknown> = {}) {
  const org = await ensureOrganisation(prisma);
  await seedFleet(prisma, org.id);
  const row = await prisma.car.findFirstOrThrow({
    where: { organisationId: org.id, slug: "vito-119-zh323239" },
    select: { id: true },
  });
  await prisma.car.update({ where: { id: row.id }, data: { status: "available", ...data } });
  return { org, carId: row.id };
}

async function rentTo(
  organisationId: string,
  carId: string,
  options: { email?: string; language?: string; pickupKm?: number; pickupAt?: Date } = {}
) {
  const customer = await prisma.customer.create({
    data: {
      organisationId,
      firstName: "Samir",
      lastName: "Haddad",
      email: options.email ?? "samir@example.ch",
      phone: "079 555 44 33",
      birthDate: new Date("1988-02-01"),
      street: "Langstrasse 10",
      postalCode: "8004",
      city: "Zürich",
      country: "Switzerland",
    },
    select: { id: true },
  });
  const rental = await prisma.rental.create({
    data: {
      organisationId,
      carId,
      customerId: customer.id,
      createdBy: "office",
      type: "WEEKLY",
      status: "ACTIVE",
      startAt: options.pickupAt ?? daysBefore(30),
      endAt: null,
    },
    select: { id: true },
  });
  await prisma.contract.create({
    data: {
      organisationId,
      rentalId: rental.id,
      contractNumber: `ZA-TEST-${rental.id.slice(-6)}`,
      createdBy: "office",
      kind: "PICKUP",
      mileageKm: options.pickupKm ?? 100_000,
      fuelLevel: "full",
      gtcVersion: "2026-10-22",
      gtcLanguage: options.language ?? "de",
      acceptedAt: options.pickupAt ?? daysBefore(30),
      place: "Zürich",
      signedAt: options.pickupAt ?? daysBefore(30),
      pdfKey: "contracts/test.pdf",
    },
  });
  await prisma.car.update({ where: { id: carId }, data: { status: "rented" } });
  return rental.id;
}

beforeEach(() => {
  sent.length = 0;
});

describe("mfkNoticePass — two weeks before", () => {
  it("is quiet three weeks out", async () => {
    await aCar({ mfkDate: new Date("2026-11-26T00:00:00.000Z") });
    expect(await mfkNoticePass(deps())).toBe(0);
    expect(sent).toHaveLength(0);
  });

  it("writes the renter and the office fourteen days before", async () => {
    const { org, carId } = await aCar({ mfkDate: new Date("2026-11-19T00:00:00.000Z") });
    await rentTo(org.id, carId);

    expect(await mfkNoticePass(deps())).toBe(2);

    const renter = sent.find((m) => m.to === "samir@example.ch");
    const office = sent.find((m) => m.to === "office@zuriauto.ch");
    expect(renter?.subject).toContain("MFK");
    expect(renter?.text).toContain("19.11.2026");
    expect(renter?.text).toContain("in 14 Tagen");
    // A reply from the renter has to reach the office, not a no-reply sender.
    expect(renter?.replyTo).toBe("office@zuriauto.ch");
    expect(office?.text).toContain("Der Mieter wurde per E-Mail informiert.");
    expect(office?.text).toContain("079 555 44 33");
  });

  it("writes in English to a renter who signed in English", async () => {
    const { org, carId } = await aCar({ mfkDate: new Date("2026-11-19T00:00:00.000Z") });
    await rentTo(org.id, carId, { language: "en" });

    await mfkNoticePass(deps());

    const renter = sent.find((m) => m.to === "samir@example.ch");
    expect(renter?.subject).toContain("Vehicle inspection");
  });

  it("tells only the office about a car on the forecourt, and does not block it", async () => {
    const { carId } = await aCar({ mfkDate: new Date("2026-11-19T00:00:00.000Z") });

    expect(await mfkNoticePass(deps())).toBe(1);
    expect(sent[0].to).toBe("office@zuriauto.ch");

    const car = await prisma.car.findUniqueOrThrow({ where: { id: carId } });
    // Two weeks early it stays bookable: the block is mfkDuePass's, two days out.
    expect(car.status).toBe("available");
  });

  it("asks the office to phone a renter with no email on file", async () => {
    const { org, carId } = await aCar({ mfkDate: new Date("2026-11-19T00:00:00.000Z") });
    await rentTo(org.id, carId, { email: "renter-x@unrecorded.invalid" });

    expect(await mfkNoticePass(deps())).toBe(1);
    expect(sent[0].to).toBe("office@zuriauto.ch");
    expect(sent[0].text).toContain("bitte telefonisch informieren");
  });

  it("sends once, however often the day's run happens", async () => {
    const { org, carId } = await aCar({ mfkDate: new Date("2026-11-19T00:00:00.000Z") });
    await rentTo(org.id, carId);

    await mfkNoticePass(deps());
    await mfkNoticePass(deps());
    await mfkNoticePass(deps(new Date("2026-11-06T07:00:00.000Z")));

    expect(sent).toHaveLength(2);
  });

  it("leaves the two-day warning and block in place", async () => {
    const { carId } = await aCar({ mfkDate: new Date("2026-11-07T00:00:00.000Z") });

    await mfkNoticePass(deps());
    await mfkDuePass(deps());

    const kinds = (await prisma.carNotification.findMany()).map((n) => n.kind).sort();
    expect(kinds).toEqual(["MFK_DUE", "MFK_NOTICE"]);
    const car = await prisma.car.findUniqueOrThrow({ where: { id: carId } });
    expect(car.status).toBe("maintenance");
  });
});

describe("serviceDuePass — every 10'000 km", () => {
  it("is quiet while the service is weeks away", async () => {
    const { org, carId } = await aCar({ serviceDoneKm: 100_000, serviceDoneOn: daysBefore(10) });
    await rentTo(org.id, carId, { pickupKm: 100_500, pickupAt: daysBefore(5) });

    expect(await serviceDuePass(deps())).toBe(0);
  });

  it("tells the renter at what reading, and roughly when, a week ahead", async () => {
    // Serviced at 100'000 thirty days ago, picked up at 100'000 then, read at
    // 108'400 today: 280 km a day, 1'600 km left, under six days.
    const { org, carId } = await aCar({
      serviceDoneKm: 100_000,
      serviceDoneOn: daysBefore(30),
      currentMileageKm: 108_400,
      mileageReadAt: NOW,
    });
    await rentTo(org.id, carId, { pickupKm: 100_000, pickupAt: daysBefore(30) });

    expect(await serviceDuePass(deps())).toBe(2);

    const renter = sent.find((m) => m.to === "samir@example.ch");
    expect(renter?.subject).toBe("Ölservice fällig bei 110'000 km – ZH 323 239");
    expect(renter?.text).toContain("108'400 km");
    expect(renter?.text).toContain("10.11.2026");

    const office = sent.find((m) => m.to === "office@zuriauto.ch");
    expect(office?.text).toContain("aus den Ablesungen dieses Fahrzeugs");

    const claims = await prisma.carNotification.findMany({ where: { kind: "SERVICE_DUE" } });
    expect(claims.map((c) => c.dedupeKey).sort()).toEqual(
      ["110000:office", expect.stringMatching(/^110000:rental:/)].sort()
    );
  });

  it("projects an old reading forward at 10'000 km in 45–60 days", async () => {
    // Read at 102'000 forty days ago and nothing since: at ~190 km a day the
    // car is near 109'600 today, so it is due within the week.
    const { carId } = await aCar({
      serviceDoneKm: 100_000,
      currentMileageKm: 102_000,
      mileageReadAt: daysBefore(40),
    });

    expect(await serviceDuePass(deps())).toBe(1);
    expect(sent[0].text).toContain("Annahme: 10'000 km in 45–60 Tagen");
    expect(carId).toBeTruthy();
  });

  it("sends once per service figure, and again after the next service", async () => {
    const { carId } = await aCar({
      serviceDoneKm: 100_000,
      currentMileageKm: 109_500,
      mileageReadAt: NOW,
    });

    await serviceDuePass(deps());
    await serviceDuePass(deps());
    expect(sent).toHaveLength(1);

    // Serviced at 109'600: the next figure is 119'600, weeks away.
    await prisma.car.update({
      where: { id: carId },
      data: { serviceDoneKm: 109_600, serviceDueKm: null, serviceDoneOn: NOW },
    });
    await serviceDuePass(deps());
    expect(sent).toHaveLength(1);
  });

  it("follows up once a real reading has passed the figure", async () => {
    await aCar({
      serviceDoneKm: 100_000,
      currentMileageKm: 110_300,
      mileageReadAt: NOW,
    });

    expect(await serviceDuePass(deps())).toBe(1);
    expect(sent[0].subject).toContain("überfällig");
    expect((await prisma.carNotification.findFirstOrThrow()).kind).toBe("SERVICE_OVERDUE");
  });

  it("says nothing about a car with no service recorded", async () => {
    await aCar({ currentMileageKm: 150_000, mileageReadAt: NOW });
    expect(await serviceDuePass(deps())).toBe(0);
  });
});

describe("recordOdometer — the handover reading reaches the car", () => {
  it("writes a pickup or return reading onto the car", async () => {
    const { carId } = await aCar({ currentMileageKm: 100_000, mileageReadAt: daysBefore(9) });

    await prisma.$transaction((tx) => recordOdometer(tx, { id: carId }, 101_800, NOW));

    const car = await prisma.car.findUniqueOrThrow({ where: { id: carId } });
    expect(car.currentMileageKm).toBe(101_800);
    expect(car.mileageReadAt?.toISOString()).toBe(NOW.toISOString());
  });

  it("never winds the odometer back", async () => {
    const { carId } = await aCar({ currentMileageKm: 100_000, mileageReadAt: daysBefore(9) });

    await prisma.$transaction((tx) => recordOdometer(tx, { id: carId }, 10_000, NOW));

    const car = await prisma.car.findUniqueOrThrow({ where: { id: carId } });
    expect(car.currentMileageKm).toBe(100_000);
  });
});
