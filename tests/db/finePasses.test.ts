import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import type { SentMail } from "@/lib/fines/notify";
import {
  fineDigestPass,
  fineDocumentRetryPass,
  fineDueSoonPass,
  fineOverduePass,
  type FinePassDeps,
} from "@/lib/fines/passes";
import { createMemoryStore } from "@/lib/storage";
import { fakeReader, letterDocument, priusLetter, seedOrganisation, seedRental } from "./fineHelpers";

/**
 * The daily run's fines passes. Each is run twice: whatever it sends, it
 * sends once.
 */

const MAIL = { host: "h", port: 587, user: "u", pass: "p", from: "office@zuriauto.ch", office: "office@zuriauto.ch" };

async function world(now: Date) {
  const org = await seedOrganisation();
  const rental = await seedRental(org.id, { signedAt: new Date("2026-06-01T08:10:00Z") });
  const store = createMemoryStore();
  const sent: SentMail[] = [];
  const deps: FinePassDeps = {
    client: prisma,
    store,
    reader: fakeReader([priusLetter("notice")]),
    now,
    mail: MAIL,
    baseUrl: "https://www.zuriauto.ch",
    send: async (_c, message) => {
      sent.push(message);
    },
  };
  const fine = (data: Record<string, unknown>) =>
    prisma.fine.create({
      data: {
        organisationId: org.id,
        amountCents: 4000,
        fineNumber: `n-${Math.random()}`,
        violationAt: new Date("2026-07-02T08:00:00Z"),
        offenceTextDe: "Überschreiten",
        offenceTextEn: "Speeding",
        carId: rental.carId,
        rentalId: rental.id,
        customerId: rental.customerId,
        ...data,
      },
    });
  return { org, store, deps, sent, fine };
}

describe("fineDocumentRetryPass", () => {
  it("reads one letter a run, including one whose reading died", async () => {
    const now = new Date("2026-10-03T12:00:00Z");
    const { org, store, deps } = await world(now);
    const stuck = await letterDocument(org.id, store, 0);
    await prisma.fineDocument.update({
      where: { id: stuck.id },
      data: { status: "PROCESSING", attempts: 1, claimedAt: new Date("2026-10-03T09:00:00Z"), uploadedAt: new Date("2026-10-03T09:00:00Z") },
    });
    const waiting = await letterDocument(org.id, store, 1);
    await prisma.fineDocument.update({ where: { id: waiting.id }, data: { uploadedAt: new Date("2026-10-03T10:00:00Z") } });

    expect(await fineDocumentRetryPass(deps)).toBe(1);
    expect((await prisma.fineDocument.findUniqueOrThrow({ where: { id: stuck.id } })).status).toBe("PROCESSED");
    expect((await prisma.fineDocument.findUniqueOrThrow({ where: { id: waiting.id } })).status).toBe("UPLOADED");
  });

  it("reads letters left unread for an hour, and gives up after three attempts", async () => {
    const now = new Date("2026-10-03T12:00:00Z");
    const { org, store, deps } = await world(now);
    const waiting = await letterDocument(org.id, store, 0);
    await prisma.fineDocument.update({ where: { id: waiting.id }, data: { uploadedAt: new Date("2026-10-03T10:00:00Z") } });
    const fresh = await letterDocument(org.id, store, 1);
    await prisma.fineDocument.update({ where: { id: fresh.id }, data: { uploadedAt: new Date("2026-10-03T11:30:00Z") } });

    expect(await fineDocumentRetryPass(deps)).toBe(1);
    expect((await prisma.fineDocument.findUniqueOrThrow({ where: { id: waiting.id } })).status).toBe("PROCESSED");
    // Uploaded half an hour ago: its own after() may still be reading it.
    expect((await prisma.fineDocument.findUniqueOrThrow({ where: { id: fresh.id } })).status).toBe("UPLOADED");

    await prisma.fineDocument.update({
      where: { id: fresh.id },
      data: { status: "FAILED", attempts: 3, uploadedAt: new Date("2026-10-01T00:00:00Z") },
    });
    expect(await fineDocumentRetryPass(deps)).toBe(0);
  });
});

describe("fineDueSoonPass", () => {
  it("reminds a renter once, a week before the deadline", async () => {
    const now = new Date("2026-10-03T12:00:00Z");
    const { deps, sent, fine } = await world(now);
    await fine({ status: "NOTIFIED", dueDate: new Date("2026-10-08T00:00:00Z") });
    // Too far off, already paid, or waiting for a proof check: left alone.
    await fine({ status: "NOTIFIED", dueDate: new Date("2026-10-20T00:00:00Z") });
    await fine({ status: "PAID", dueDate: new Date("2026-10-08T00:00:00Z") });
    await fine({ status: "PROOF_SUBMITTED", dueDate: new Date("2026-10-08T00:00:00Z") });

    expect(await fineDueSoonPass(deps)).toBe(1);
    expect(await fineDueSoonPass(deps)).toBe(0);
    expect(sent.map((m) => m.subject)).toEqual(["Erinnerung: Busse für ZH 513 925 – zahlbar bis 08.10.2026"]);
  });
});

describe("fineOverduePass", () => {
  it("tells the office once about a sent fine past its deadline", async () => {
    const now = new Date("2026-10-03T12:00:00Z");
    const { deps, sent, fine } = await world(now);
    await fine({ status: "NOTIFIED", dueDate: new Date("2026-10-01T00:00:00Z") });
    await fine({ status: "NOTIFIED", dueDate: new Date("2026-10-03T00:00:00Z") });

    expect(await fineOverduePass(deps)).toBe(1);
    expect(await fineOverduePass(deps)).toBe(0);
    expect(sent.map((m) => m.to)).toEqual(["office@zuriauto.ch"]);
    expect(sent[0].subject).toContain("überfällig");
  });
});

describe("fineDigestPass", () => {
  it("sends the office one list a day of fines waiting for review", async () => {
    const { deps, sent, fine } = await world(new Date("2026-10-03T12:00:00Z"));
    await fine({ status: "NEEDS_REVIEW", reviewReason: "PLATE_NOT_IN_FLEET" });
    await fine({ status: "NEEDS_REVIEW", reviewReason: "HANDOVER_BOUNDARY" });
    await fine({ status: "NOTIFIED" });

    expect(await fineDigestPass(deps)).toBe(2);
    expect(await fineDigestPass(deps)).toBe(0);
    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toBe("2 Bussen zu prüfen");
    expect(sent[0].text).toContain("Kontrollschild nicht in der Flotte");

    // The next day, still waiting: listed again.
    expect(await fineDigestPass({ ...deps, now: new Date("2026-10-04T12:00:00Z") })).toBe(2);
    expect(sent).toHaveLength(2);
  });

  it("sends nothing when nothing waits", async () => {
    const { deps, sent } = await world(new Date("2026-10-03T12:00:00Z"));
    expect(await fineDigestPass(deps)).toBe(0);
    expect(sent).toEqual([]);
  });
});

describe("runDailyPasses", () => {
  it("runs the fines passes as part of the day", async () => {
    const { runDailyPasses } = await import("@/lib/rental/scheduler");
    const now = new Date("2026-10-03T12:00:00Z");
    // No rental: the other passes would mail about it, and this test is only
    // about the fines passes being called.
    const org = await seedOrganisation();
    await prisma.fine.create({
      data: { organisationId: org.id, status: "NEEDS_REVIEW", reviewReason: "PLATE_NOT_IN_FLEET" },
    });
    const sent: SentMail[] = [];

    const summary = await runDailyPasses({
      client: prisma,
      now,
      baseUrl: "https://www.zuriauto.ch",
      mail: MAIL,
      fineSend: async (_c, message) => {
        sent.push(message);
      },
    });

    expect(summary).toMatchObject({ fineDueSoon: 0, fineOverdue: 0, fineDigest: 1 });
    // Reading letters is not part of it: the cron route does that last, after
    // retention, so a slow letter cannot cost the day its other passes.
    expect(summary).not.toHaveProperty("fineLettersRead");
    expect(sent.map((m) => m.subject)).toContain("1 Busse zu prüfen");
  });
});
