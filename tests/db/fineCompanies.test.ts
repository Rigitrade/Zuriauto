import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { fineDigestPass, fineOverduePass, type FinePassDeps } from "@/lib/fines/passes";
import { createMemoryStore } from "@/lib/storage";
import { fakeReader, priusLetter, seedOrganisation } from "./fineHelpers";

/**
 * Multi-company phase C (16.11.2026): the fines part of the daily run per
 * company. A partner's fine alerts and review list go to the partner's
 * office, in its name; ZURIAUTO's office hears nothing of them.
 */

const MAIL = { host: "h", port: 587, user: "u", pass: "p", from: "ZURIAUTO <noreply@zuriauto.ch>", office: "office@zuriauto.ch" };
const MEIER_OFFICE = "office@meier.test";

async function world(options: { meierOffice?: string | null } = {}) {
  const zuri = await seedOrganisation();
  const meier = await prisma.organisation.create({
    data: {
      name: "MEIER CARS",
      brandName: "MEIER CARS",
      legalName: "Meier Mietwagen GmbH",
      slug: "meier",
      officeEmail: options.meierOffice === undefined ? MEIER_OFFICE : options.meierOffice,
    },
  });
  const meierCar = await prisma.car.create({
    data: { organisationId: meier.id, slug: "meier-1", model: "Skoda Octavia", plate: "ZH 777001", status: "available" },
  });
  const zuriCar = await prisma.car.findFirstOrThrow({ where: { organisationId: zuri.id } });
  const sent: { from: string; to: string; subject: string; text: string }[] = [];
  const deps: FinePassDeps = {
    client: prisma,
    store: createMemoryStore(),
    reader: fakeReader([priusLetter("notice")]),
    now: new Date("2026-10-03T12:00:00Z"),
    mail: MAIL,
    baseUrl: "https://www.zuriauto.ch",
    send: async (config, message) => {
      sent.push({ from: config.from, to: message.to, subject: message.subject, text: message.text });
    },
  };
  const fine = (organisationId: string, carId: string, data: Record<string, unknown>) =>
    prisma.fine.create({
      data: { organisationId, carId, amountCents: 4000, fineNumber: `n-${Math.random()}`, ...data },
    });
  return { zuri, meier, zuriCar, meierCar, deps, sent, fine };
}

const overdue = { status: "NOTIFIED", dueDate: new Date("2026-10-01T00:00:00Z") };
const inReview = { status: "NEEDS_REVIEW", reviewReason: "FIELDS_MISSING" };

describe("fine alerts per company", () => {
  it("a partner's overdue fine is reported to the partner's office, in its name", async () => {
    const { zuri, meier, zuriCar, meierCar, deps, sent, fine } = await world();
    await fine(meier.id, meierCar.id, overdue);
    await fine(zuri.id, zuriCar.id, overdue);

    expect(await fineOverduePass(deps)).toBe(2);

    const toMeier = sent.filter((m) => m.to === MEIER_OFFICE);
    const toZuri = sent.filter((m) => m.to === "office@zuriauto.ch");
    expect(toMeier).toHaveLength(1);
    expect(toMeier[0].from).toBe('"MEIER CARS" <noreply@zuriauto.ch>');
    expect(toZuri).toHaveLength(1);
    expect(toZuri[0].from).toBe(MAIL.from);
    expect(toZuri[0].text).not.toContain("ZH 777001");
  });

  it("each office gets its own review list, with only its own fines", async () => {
    const { zuri, meier, zuriCar, meierCar, deps, sent, fine } = await world();
    await fine(meier.id, meierCar.id, inReview);
    await fine(zuri.id, zuriCar.id, inReview);

    expect(await fineDigestPass(deps)).toBe(2);
    expect(await fineDigestPass(deps)).toBe(0);

    const toMeier = sent.filter((m) => m.to === MEIER_OFFICE);
    const toZuri = sent.filter((m) => m.to === "office@zuriauto.ch");
    expect(toMeier).toHaveLength(1);
    expect(toMeier[0].text).toContain("ZH 777001");
    expect(toZuri).toHaveLength(1);
    expect(toZuri[0].text).not.toContain("ZH 777001");
    expect(toZuri[0].text).toContain(zuriCar.plate);
  });

  it("a partner with no office address: nothing is sent of its fines, and nothing to ZURIAUTO", async () => {
    const { meier, meierCar, deps, sent, fine } = await world({ meierOffice: null });
    await fine(meier.id, meierCar.id, overdue);
    await fine(meier.id, meierCar.id, inReview);

    await fineOverduePass(deps);
    await fineDigestPass(deps);

    expect(sent).toEqual([]);
  });
});
