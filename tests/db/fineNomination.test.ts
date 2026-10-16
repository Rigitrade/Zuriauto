import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { applyFineAction } from "@/lib/fines/actions";
import { deliverNewFine } from "@/lib/fines/nominate";
import { notifyRenter, type NotifyDeps, type SentMail } from "@/lib/fines/notify";
import { createMemoryStore } from "@/lib/storage";
import { FINE_NOW, seedOrganisation, seedRental } from "./fineHelpers";

/**
 * Naming the driver of a police fine to the authority (owner's decision of
 * 16.10.2026): sent only to an address the office confirmed, which the letter
 * shows or, showing none, does not contradict; held for the office, with the
 * reason, in every other case.
 */

const MAIL = {
  host: "smtp.test",
  port: 587,
  user: "u",
  pass: "p",
  from: "noreply@zuriauto.ch",
  office: "info@zuriauto.ch",
};

const UITIKON_IBAN = "CH5930000003800077026";
const UITIKON_HEAD = `Kommunalpolizei Uitikon
Zürcherstrasse 59, 8142 Uitikon
Tel. 044 200 15 17
ordnungsbussen@uitikon.org
Zahlungserinnerung / Anzeigevorhalt Bussen-Nr. 18440`;

const office = { id: "admin-1", displayName: "Eng Ahmed" };

afterEach(() => {
  delete process.env.FINES_DRIVER_NOMINATION;
});

/** A fine matched to its renter, its letter's text stored, as processing leaves it. */
async function matchedFine(
  options: {
    ocrText?: string;
    issuerKind?: "POLICE" | "PRIVATE";
    iban?: string | null;
    fineNumber?: string | null;
    signedAt?: Date;
    organisationId?: string;
    vehicleId?: string;
  } = {}
) {
  const organisationId = options.organisationId ?? (await seedOrganisation()).id;
  const rental = await seedRental(organisationId, {
    signedAt: options.signedAt ?? new Date("2026-06-01T08:10:00Z"),
    ...(options.vehicleId ? { details: { vehicleId: options.vehicleId } } : {}),
  });
  const fine = await prisma.fine.create({
    data: {
      organisationId,
      issuerKind: options.issuerKind ?? "POLICE",
      issuerName: "Kommunalpolizei Uitikon",
      issuerIban: options.iban === undefined ? UITIKON_IBAN : options.iban,
      fineNumber: options.fineNumber === undefined ? "18440" : options.fineNumber,
      amountCents: 10000,
      violationAt: new Date("2026-08-30T11:15:00Z"),
      location: "Uitikon, Uetlibergstrasse",
      offenceTextDe: "Nichtbeachten Verbot für Motorwagen",
      offenceTextEn: "Ignoring a no-motor-vehicles sign",
      dueDate: new Date("2026-11-11T00:00:00Z"),
      carId: rental.carId,
      rentalId: rental.id,
      customerId: rental.customerId,
      status: "NEEDS_REVIEW",
      handlingFeeCents: 2000,
      handlingFeeStatus: "DUE",
    },
  });
  await prisma.fineDocument.create({
    data: {
      organisationId,
      storageKey: `fines/d/letter-${fine.id}.pdf`,
      sha256: fine.id.padEnd(64, "0").slice(0, 64),
      bytes: 5,
      pages: 1,
      uploadedById: "u1",
      uploadedByName: "Eng Ahmed",
      status: "PROCESSED",
      ocrText: options.ocrText ?? UITIKON_HEAD,
      fineId: fine.id,
    },
  });

  const sent: SentMail[] = [];
  const deps: NotifyDeps = {
    client: prisma,
    store: createMemoryStore(),
    now: FINE_NOW,
    mail: MAIL,
    baseUrl: "https://www.zuriauto.ch",
    send: async (_config, message) => {
      sent.push(message);
    },
  };
  return { organisationId, fine, deps, sent };
}

async function confirmUitikon(organisationId: string, email = "ordnungsbussen@uitikon.org") {
  await prisma.fineAuthority.create({
    data: {
      organisationId,
      iban: UITIKON_IBAN,
      name: "Kommunalpolizei Uitikon",
      email,
      confirmedAt: new Date("2026-10-01T08:00:00Z"),
      confirmedById: office.id,
    },
  });
}

const reload = (id: string) => prisma.fine.findUniqueOrThrow({ where: { id } });

describe("a police fine whose authority the office has confirmed", () => {
  it("names the driver to the authority, tells the renter, and asks nothing of them", async () => {
    const { organisationId, fine, deps, sent } = await matchedFine();
    await confirmUitikon(organisationId);

    await deliverNewFine(deps, fine.id);

    expect(sent.map((m) => m.to)).toEqual(["ordnungsbussen@uitikon.org", "anna@example.ch"]);
    const [police, renter] = sent;
    expect(police.cc).toBe("info@zuriauto.ch");
    expect(police.replyTo).toBe("info@zuriauto.ch");
    expect(police.subject).toBe("Lenkerangabe zu Busse-Nr. 18440 – ZH 513 925");
    expect(police.text).toContain("Name, Vorname:  MEIER, Anna");
    expect(police.text).toContain("Geburtsdatum:   12.04.1990");
    expect(police.text).toContain("Wohnadresse:    Bahnhofstrasse 1, 8001 Zürich");
    expect(police.attachments ?? []).toHaveLength(0);

    // No fee, no payment link, and not the letter with its payment slip.
    expect(renter.text).toContain("als Lenker gemeldet");
    expect(renter.text).not.toMatch(/zuriauto\.ch\/fines|Bearbeitungsgebühr|CHF 20/);
    expect(renter.attachments ?? []).toHaveLength(0);

    const after = await reload(fine.id);
    expect(after).toMatchObject({
      status: "DRIVER_NAMED",
      reviewReason: null,
      driverNamedTo: "ordnungsbussen@uitikon.org",
      handlingFeeCents: 0,
      handlingFeeStatus: "NONE",
    });
    expect(after.driverNamedAt?.toISOString()).toBe(FINE_NOW.toISOString());
    const events = await prisma.fineEvent.findMany({ where: { fineId: fine.id } });
    expect(events.map((e) => e.type)).toContain("driver.named");
  });

  it("names nobody twice when it runs again", async () => {
    const { organisationId, fine, deps, sent } = await matchedFine();
    await confirmUitikon(organisationId);
    await deliverNewFine(deps, fine.id);
    await prisma.fine.update({ where: { id: fine.id }, data: { status: "NEEDS_REVIEW" } });
    await deliverNewFine(deps, fine.id);
    expect(sent.filter((m) => m.to === "ordnungsbussen@uitikon.org")).toHaveLength(1);
  });

  it("names the driver of a letter that shows no address to the confirmed one", async () => {
    // As every Kantonspolizei Zürich letter: an address on none of them.
    const { organisationId, fine, deps, sent } = await matchedFine({
      ocrText: "Kommunalpolizei Uitikon\nBussen-Nr. 18440",
    });
    await confirmUitikon(organisationId);

    await deliverNewFine(deps, fine.id);

    expect(sent.map((m) => m.to)).toEqual(["ordnungsbussen@uitikon.org", "anna@example.ch"]);
    expect(await reload(fine.id)).toMatchObject({
      status: "DRIVER_NAMED",
      driverNamedTo: "ordnungsbussen@uitikon.org",
    });
  });
});

describe("a police fine held for the office, with the reason", () => {
  it("holds the first letter of an authority, and remembers the address it read", async () => {
    const { fine, deps, sent } = await matchedFine();
    await deliverNewFine(deps, fine.id);

    expect(sent).toEqual([]);
    const after = await reload(fine.id);
    expect(after).toMatchObject({
      status: "NEEDS_REVIEW",
      reviewReason: "NOMINATION_NEW_ADDRESS",
      authorityEmailRead: "ordnungsbussen@uitikon.org",
    });
    const authority = await prisma.fineAuthority.findUniqueOrThrow({ where: { id: after.authorityId! } });
    expect(authority).toMatchObject({ iban: UITIKON_IBAN, email: null, confirmedAt: null });
  });

  it("holds a letter that shows no address from an authority not yet confirmed", async () => {
    const { fine, deps, sent } = await matchedFine({ ocrText: "Kommunalpolizei Uitikon\nBussen-Nr. 18440" });
    await deliverNewFine(deps, fine.id);
    expect(sent).toEqual([]);
    expect(await reload(fine.id)).toMatchObject({
      status: "NEEDS_REVIEW",
      reviewReason: "NOMINATION_NO_EMAIL",
      authorityEmailRead: null,
    });
  });

  it("holds a letter whose address is not the confirmed one", async () => {
    const { organisationId, fine, deps, sent } = await matchedFine({
      ocrText: "Kommunalpolizei Uitikon\nbussen@uitikon.ch",
    });
    await confirmUitikon(organisationId);
    await deliverNewFine(deps, fine.id);
    expect(sent).toEqual([]);
    expect(await reload(fine.id)).toMatchObject({
      reviewReason: "NOMINATION_ADDRESS_CHANGED",
      authorityEmailRead: "bussen@uitikon.ch",
    });
  });

  it("holds a fine with no Busse-Nr.", async () => {
    const { organisationId, fine, deps, sent } = await matchedFine({ fineNumber: null });
    await confirmUitikon(organisationId);
    await deliverNewFine(deps, fine.id);
    expect(sent).toEqual([]);
    expect((await reload(fine.id)).reviewReason).toBe("NOMINATION_NO_NUMBER");
  });

  it("holds a letter with no payment slip to recognise the authority by", async () => {
    const { fine, deps, sent } = await matchedFine({ iban: null });
    await deliverNewFine(deps, fine.id);
    expect(sent).toEqual([]);
    expect((await reload(fine.id)).reviewReason).toBe("NOMINATION_NO_AUTHORITY");
  });
});

describe("the office names the driver from the review list", () => {
  it("sends to the address it enters, and confirms it for the authority's next letter", async () => {
    const first = await matchedFine();
    await deliverNewFine(first.deps, first.fine.id);
    expect(first.sent).toEqual([]);

    const result = await applyFineAction(
      first.deps,
      first.fine.id,
      { action: "nominate", email: "Ordnungsbussen@Uitikon.org " },
      office
    );
    expect(result).toEqual({ ok: true });
    expect(first.sent.map((m) => m.to)).toEqual(["ordnungsbussen@uitikon.org", "anna@example.ch"]);
    const authority = await prisma.fineAuthority.findFirstOrThrow();
    expect(authority).toMatchObject({ email: "ordnungsbussen@uitikon.org", confirmedById: office.id });

    // The same authority's next letter goes out without anyone looking.
    const second = await matchedFine({
      organisationId: first.organisationId,
      signedAt: new Date("2026-08-01T08:10:00Z"),
      fineNumber: "18441",
      // Another car: the first is still out.
      vehicleId: "prius-zh401859",
    });
    await prisma.fine.update({
      where: { id: second.fine.id },
      data: { violationAt: new Date("2026-08-02T10:00:00Z") },
    });
    await deliverNewFine(second.deps, second.fine.id);
    expect((await reload(second.fine.id)).status).toBe("DRIVER_NAMED");
    expect(second.sent[0].to).toBe("ordnungsbussen@uitikon.org");
    // Two handovers and two fines: more than the default on a remote database.
  }, 60_000);

  it("refuses an address that is not one, and a fine already paid", async () => {
    const { fine, deps, sent } = await matchedFine();
    expect(await applyFineAction(deps, fine.id, { action: "nominate", email: "uitikon" }, office)).toEqual({
      ok: false,
      code: "bad-request",
    });
    await prisma.fine.update({ where: { id: fine.id }, data: { status: "PAID" } });
    expect(
      await applyFineAction(deps, fine.id, { action: "nominate", email: "ordnungsbussen@uitikon.org" }, office)
    ).toEqual({ ok: false, code: "conflict" });
    expect(sent).toEqual([]);
  });
});

describe("what stays as it was", () => {
  it("a private issuer's fine still goes to the renter to pay", async () => {
    const { fine, deps, sent } = await matchedFine({ issuerKind: "PRIVATE" });
    await deliverNewFine(deps, fine.id);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("anna@example.ch");
    expect((await reload(fine.id)).status).toBe("NOTIFIED");
  });

  it("with nomination switched off, a police fine goes to the renter", async () => {
    process.env.FINES_DRIVER_NOMINATION = "off";
    const { organisationId, fine, deps, sent } = await matchedFine();
    await confirmUitikon(organisationId);
    await deliverNewFine(deps, fine.id);
    expect(sent.map((m) => m.to)).toEqual(["anna@example.ch"]);
    expect((await reload(fine.id)).status).toBe("NOTIFIED");
  });
});

describe("after the driver was named", () => {
  it("a reminder from the authority alerts the office, and nobody is asked to pay", async () => {
    const { organisationId, fine, deps, sent } = await matchedFine();
    await confirmUitikon(organisationId);
    await deliverNewFine(deps, fine.id);
    sent.length = 0;

    await notifyRenter(deps, fine.id, "office");
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("info@zuriauto.ch");
    expect(sent[0].subject).toContain("Lenker gemeldet");
    expect(sent[0].text).toContain("ordnungsbussen@uitikon.org");
  });

  it("a failed send leaves the fine in review as undelivered, and tells the office", async () => {
    const { organisationId, fine, deps, sent } = await matchedFine();
    await confirmUitikon(organisationId);
    const failing: NotifyDeps = {
      ...deps,
      send: async (_config, message) => {
        if (message.to === "ordnungsbussen@uitikon.org") throw new Error("550 mailbox unavailable");
        sent.push(message);
      },
    };
    await deliverNewFine(failing, fine.id);
    expect(await reload(fine.id)).toMatchObject({ status: "NEEDS_REVIEW", reviewReason: "MAIL_FAILED" });
    expect(sent.map((m) => m.to)).toEqual(["info@zuriauto.ch"]);
  });
});
