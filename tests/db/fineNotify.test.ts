import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { hashToken } from "@/lib/rental/actionToken";
import { notifyRenter, type NotifyDeps, type SentMail } from "@/lib/fines/notify";
import { resolveFinePaymentToken } from "@/lib/fines/token";
import { createMemoryStore } from "@/lib/storage";
import { FINE_NOW, seedOrganisation, seedRental } from "./fineHelpers";

const MAIL = {
  host: "smtp.test",
  port: 587,
  user: "u",
  pass: "p",
  from: "office@zuriauto.ch",
  office: "office@zuriauto.ch",
};

/** A matched fine with its letter stored, as processing leaves it. */
async function matchedFine(options: { language?: "de" | "en" } = {}) {
  const org = await seedOrganisation();
  const rental = await seedRental(org.id, {
    signedAt: new Date("2026-06-01T08:10:00Z"),
    details: options.language === "en" ? { gtcLanguage: "en" } : {},
  });
  const store = createMemoryStore();
  await store.put("fines/d/letter-0000000000000001.pdf", new Uint8Array([37, 80, 68, 70, 1]), "application/pdf");
  const fine = await prisma.fine.create({
    data: {
      organisationId: org.id,
      issuerKind: "POLICE",
      issuerName: "Kantonspolizei Zürich",
      issuerIban: "CH2430000001800000803",
      fineNumber: "830557506 017 4",
      paymentReference: "001980919800083055750601742",
      amountCents: 4000,
      violationAt: new Date("2026-07-02T08:00:00Z"),
      location: "Lufingen, Zürcherstrasse",
      offenceTextDe: "Überschreiten der Höchstgeschwindigkeit",
      offenceTextEn: "Exceeding the speed limit",
      dueDate: new Date("2026-10-04T00:00:00Z"),
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
      organisationId: org.id,
      storageKey: "fines/d/letter-0000000000000001.pdf",
      sha256: "1".repeat(64),
      bytes: 5,
      pages: 1,
      uploadedById: "u1",
      uploadedByName: "Eng Ahmed",
      status: "PROCESSED",
      fineId: fine.id,
    },
  });

  const sent: SentMail[] = [];
  const deps: NotifyDeps = {
    client: prisma,
    store,
    now: FINE_NOW,
    mail: MAIL,
    baseUrl: "https://www.zuriauto.ch",
    send: async (_config, message) => {
      sent.push(message);
    },
  };
  return { fine, deps, sent };
}

describe("notifyRenter", () => {
  it("emails the renter the letter, a payment link, and marks the fine notified", async () => {
    const { fine, deps, sent } = await matchedFine();

    await notifyRenter(deps, fine.id, "notice");

    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("anna@example.ch");
    expect(sent[0].subject).toContain("ZH 513 925");
    expect(sent[0].attachments?.[0]).toMatchObject({ filename: "busse-ZH513925.pdf", contentType: "application/pdf" });

    const updated = await prisma.fine.findUniqueOrThrow({ where: { id: fine.id } });
    expect(updated).toMatchObject({ status: "NOTIFIED", reviewReason: null, notifiedAt: FINE_NOW });

    const token = /\/fines\/pay\/\?t=([A-Za-z0-9_-]+)/.exec(sent[0].text)?.[1];
    expect(token).toBeTruthy();
    const row = await prisma.actionToken.findUniqueOrThrow({ where: { tokenHash: hashToken(token!) } });
    expect(row).toMatchObject({ purpose: "FINE_PAYMENT", fineId: fine.id, rentalId: fine.rentalId });
    // Sixty days after the due date.
    expect(row.expiresAt).toEqual(new Date("2026-12-03T00:00:00Z"));
    expect((await resolveFinePaymentToken(prisma, token!, FINE_NOW)).ok).toBe(true);
  });

  it("sends a notice once, however often it is asked", async () => {
    const { fine, deps, sent } = await matchedFine();
    await notifyRenter(deps, fine.id, "notice");
    await notifyRenter(deps, fine.id, "notice");
    expect(sent).toHaveLength(1);
  });

  it("writes to an English renter in English", async () => {
    const { fine, deps, sent } = await matchedFine({ language: "en" });
    await notifyRenter(deps, fine.id, "notice");
    expect(sent[0].subject).toMatch(/^Traffic fine/);
  });

  it("hands a fine that could not be delivered to the office", async () => {
    const { fine, deps } = await matchedFine();
    const tried: string[] = [];
    await notifyRenter(
      {
        ...deps,
        send: async (_config, message) => {
          tried.push(message.to);
          if (message.to === "anna@example.ch") throw new Error("mailbox unavailable");
        },
      },
      fine.id,
      "notice"
    );

    const updated = await prisma.fine.findUniqueOrThrow({ where: { id: fine.id } });
    expect(updated).toMatchObject({ status: "NEEDS_REVIEW", reviewReason: "MAIL_FAILED" });
    expect(tried).toEqual(["anna@example.ch", "office@zuriauto.ch"]);
    // A link nobody received is not left usable.
    expect(await prisma.actionToken.count({ where: { fineId: fine.id, usedAt: null } })).toBe(0);
  });

  it("treats an unconfigured mail server as undelivered", async () => {
    const { fine, deps, sent } = await matchedFine();
    await notifyRenter({ ...deps, mail: null }, fine.id, "notice");
    expect(sent).toHaveLength(0);
    expect((await prisma.fine.findUniqueOrThrow({ where: { id: fine.id } })).reviewReason).toBe("MAIL_FAILED");
  });

  it("sends each reminder level once", async () => {
    const { fine, deps, sent } = await matchedFine();
    await notifyRenter(deps, fine.id, "notice");
    await prisma.fine.update({ where: { id: fine.id }, data: { reminderLevel: 1 } });
    await notifyRenter(deps, fine.id, "reminder");
    await notifyRenter(deps, fine.id, "reminder");
    await prisma.fine.update({ where: { id: fine.id }, data: { reminderLevel: 2 } });
    await notifyRenter(deps, fine.id, "reminder");
    expect(sent.map((m) => m.subject.startsWith("Mahnung"))).toEqual([false, true, true]);
  });

  it("tells renter and office when the police say a paid fine is unpaid, and leaves it for the office", async () => {
    const { fine, deps, sent } = await matchedFine();
    await prisma.fine.update({
      where: { id: fine.id },
      data: { status: "NEEDS_REVIEW", reviewReason: "REMINDER_AFTER_PAID", reminderLevel: 1 },
    });

    await notifyRenter(deps, fine.id, "reopened");

    expect(sent.map((m) => m.to)).toEqual(["anna@example.ch", "office@zuriauto.ch"]);
    const updated = await prisma.fine.findUniqueOrThrow({ where: { id: fine.id } });
    expect(updated).toMatchObject({ status: "NEEDS_REVIEW", reviewReason: "REMINDER_AFTER_PAID" });
  });

  it("only tells the office about a reminder for a closed fine", async () => {
    const { fine, deps, sent } = await matchedFine();
    await prisma.fine.update({ where: { id: fine.id }, data: { status: "HANDLED_OTHERWISE" } });
    await notifyRenter(deps, fine.id, "office");
    expect(sent.map((m) => m.to)).toEqual(["office@zuriauto.ch"]);
  });
});
