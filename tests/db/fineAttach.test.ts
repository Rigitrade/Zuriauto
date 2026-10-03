import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { processFineDocument } from "@/lib/fines/process";
import { createMemoryStore } from "@/lib/storage";
import {
  fakeReader,
  letterDocument,
  priusLetter,
  recordingDeps,
  seedOrganisation,
  seedRental,
  type FakeLetter,
} from "./fineHelpers";

/**
 * One fine, many letters: the notice, a second copy, the reminders. And the
 * letters that must not become a fine on their own.
 */

async function world(letters: FakeLetter[]) {
  const org = await seedOrganisation();
  const store = createMemoryStore();
  const { deps, notified } = recordingDeps(store, fakeReader(letters));
  const process = async (index: number) => {
    const document = await letterDocument(org.id, store, index);
    expect(await processFineDocument(deps, document.id)).toBe("processed");
    return prisma.fineDocument.findUniqueOrThrow({ where: { id: document.id } });
  };
  return { org, process, notified };
}

const ANNA_PICKUP = new Date("2026-06-01T08:10:00Z");

describe("attaching letters to fines", () => {
  it("keeps a second copy of a notice on the same fine, and sends once", async () => {
    const { org, process, notified } = await world([priusLetter("notice"), priusLetter("notice")]);
    await seedRental(org.id, { signedAt: ANNA_PICKUP });

    const first = await process(0);
    const second = await process(1);

    expect(second.fineId).toBe(first.fineId);
    expect(await prisma.fine.count()).toBe(1);
    expect(notified).toEqual([{ fineId: first.fineId, reason: "notice" }]);
  });

  it("raises the amount of a sent fine on a reminder and reminds the renter", async () => {
    const { org, process, notified } = await world([
      priusLetter("notice"),
      priusLetter("reminder", { amount: "60.00" }),
    ]);
    await seedRental(org.id, { signedAt: ANNA_PICKUP });

    const notice = await process(0);
    await process(1);

    const fine = await prisma.fine.findUniqueOrThrow({ where: { id: notice.fineId! } });
    expect(fine).toMatchObject({
      status: "NOTIFIED",
      amountCents: 6000,
      reminderLevel: 1,
      // The notice's CHF 20, and CHF 20 for the Mahnung.
      handlingFeeCents: 4000,
    });
    expect(notified.map((n) => n.reason)).toEqual(["notice", "reminder"]);
  });

  for (const status of ["PAID", "PROOF_SUBMITTED"] as const) {
    it(`reopens a ${status} fine when the police say it is unpaid`, async () => {
      const { org, process, notified } = await world([priusLetter("notice"), priusLetter("reminder")]);
      await seedRental(org.id, { signedAt: ANNA_PICKUP });
      const notice = await process(0);
      await prisma.fine.update({
        where: { id: notice.fineId! },
        data: { status, paidAt: status === "PAID" ? new Date() : null, paidVia: status === "PAID" ? "PROOF_VERIFIED" : null },
      });

      await process(1);

      const fine = await prisma.fine.findUniqueOrThrow({ where: { id: notice.fineId! } });
      expect(fine).toMatchObject({
        status: "NEEDS_REVIEW",
        reviewReason: "REMINDER_AFTER_PAID",
        paidAt: null,
        paidVia: null,
      });
      expect(notified.at(-1)).toEqual({ fineId: notice.fineId, reason: "reopened" });
    });
  }

  for (const status of ["HANDLED_OTHERWISE", "VOID"] as const) {
    it(`only tells the office about a reminder for a ${status} fine`, async () => {
      const { org, process, notified } = await world([priusLetter("notice"), priusLetter("reminder")]);
      await seedRental(org.id, { signedAt: ANNA_PICKUP });
      const notice = await process(0);
      await prisma.fine.update({ where: { id: notice.fineId! }, data: { status } });

      await process(1);

      expect((await prisma.fine.findUniqueOrThrow({ where: { id: notice.fineId! } })).status).toBe(status);
      expect(notified.at(-1)).toEqual({ fineId: notice.fineId, reason: "office" });
    });
  }

  it("adds a reminder to a fine already waiting for the office, quietly", async () => {
    const { process, notified } = await world([priusLetter("notice"), priusLetter("reminder")]);
    // No rental: the notice waits in review.
    const notice = await process(0);
    await process(1);

    const fine = await prisma.fine.findUniqueOrThrow({ where: { id: notice.fineId! } });
    expect(fine.status).toBe("NEEDS_REVIEW");
    expect(fine.reminderLevel).toBe(1);
    expect(notified).toEqual([]);
    const events = await prisma.fineEvent.findMany({ where: { fineId: fine.id }, orderBy: { createdAt: "asc" } });
    expect(events.map((e) => e.type)).toEqual(["fine.created", "document.attached"]);
  });

  it("treats a reminder for a fine never seen as a new fine, flagged", async () => {
    const { org, process, notified } = await world([priusLetter("reminder")]);
    await seedRental(org.id, { signedAt: ANNA_PICKUP });

    const reminder = await process(0);

    const fine = await prisma.fine.findUniqueOrThrow({ where: { id: reminder.fineId! } });
    expect(fine).toMatchObject({ firstSeenAsReminder: true, reminderLevel: 1, status: "NOTIFIED" });
    expect(notified).toEqual([{ fineId: fine.id, reason: "notice" }]);
  });

  it("holds a letter that looks like a fine already on file, but has nothing to prove it", async () => {
    const { org, process, notified } = await world([
      priusLetter("notice"),
      // The same offence, read without its slip or its OB number.
      { ...priusLetter("notice", { withQr: false }), text: priusLetter("notice").text.replace(/OB-Nr\. 830557506 017 4/, "").replace(/Ordnungsbusse: 830557506 017 4/, "").replace(/Referenz 00 19809 19800 08305 57506 01742/, "") },
    ]);
    await seedRental(org.id, { signedAt: ANNA_PICKUP });

    const first = await process(0);
    const second = await process(1);

    expect(second.fineId).not.toBe(first.fineId);
    const fine = await prisma.fine.findUniqueOrThrow({ where: { id: second.fineId! } });
    expect(fine).toMatchObject({ status: "NEEDS_REVIEW", reviewReason: "PROBABLE_DUPLICATE" });
    expect(notified).toHaveLength(1);
  });

  it("does not email a renter whose address was never recorded", async () => {
    const { org, process, notified } = await world([priusLetter("notice")]);
    await seedRental(org.id, {
      signedAt: ANNA_PICKUP,
      details: { email: "rental-x@unrecorded.invalid" },
    });

    const document = await process(0);

    const fine = await prisma.fine.findUniqueOrThrow({ where: { id: document.fineId! } });
    expect(fine).toMatchObject({ status: "NEEDS_REVIEW", reviewReason: "NO_CUSTOMER_EMAIL" });
    expect(fine.rentalId).not.toBeNull();
    expect(notified).toEqual([]);
  });

  it("asks a person about an offence an hour after the pickup", async () => {
    // 10:00 Zurich on 2 July is 08:00 UTC; the pickup was signed at 07:00 UTC.
    const { org, process, notified } = await world([priusLetter("notice")]);
    await seedRental(org.id, { signedAt: new Date("2026-07-02T07:00:00Z") });

    const document = await process(0);

    const fine = await prisma.fine.findUniqueOrThrow({ where: { id: document.fineId! } });
    expect(fine).toMatchObject({ status: "NEEDS_REVIEW", reviewReason: "HANDOVER_BOUNDARY" });
    expect(notified).toEqual([]);
  });

  it("makes one fine of two copies processed at the same moment", async () => {
    const org = await seedOrganisation();
    await seedRental(org.id, { signedAt: ANNA_PICKUP });
    const store = createMemoryStore();
    const { deps } = recordingDeps(store, fakeReader([priusLetter("notice"), priusLetter("notice")]));
    const a = await letterDocument(org.id, store, 0);
    const b = await letterDocument(org.id, store, 1);

    await Promise.all([processFineDocument(deps, a.id), processFineDocument(deps, b.id)]);

    expect(await prisma.fine.count()).toBe(1);
    const documents = await prisma.fineDocument.findMany();
    expect(new Set(documents.map((d) => d.fineId)).size).toBe(1);
  });
});
