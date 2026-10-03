import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { extractFields } from "@/lib/fines/extract";
import { processFineDocument, type FineDeps } from "@/lib/fines/process";
import { parseQrBill } from "@/lib/fines/qrBill";
import type { FineReader, ReadResult } from "@/lib/fines/reader";
import { validateExtraction } from "@/lib/fines/validate";
import { createMemoryStore } from "@/lib/storage";
import { KAPO_ZH_OCR } from "@/lib/fines/__fixtures__/texts";
import { seedOrganisation, seedRental } from "./fineHelpers";

const NOW = new Date("2026-10-03T12:00:00Z");

const KAPO_QR_TEXT = [
  "SPC", "0200", "1", "CH2430000001800000803", "S", "Kantonspolizei Zürich",
  "Ordnungsbussen", "", "8010", "Zürich", "CH", "", "", "", "", "", "", "",
  "40.00", "CHF", "S", "Rigitrade AG", "Tannenstrasse", "16", "8424",
  "Embrach", "CH", "QRR", "001980919800083055750601742",
  "Ordnungsbusse: 830557506 017 4", "EPD",
].join("\n");

/** A reader that returns what the free reader would for this text. */
function readerFor(text: string): FineReader {
  return {
    name: "fake",
    async read(): Promise<ReadResult> {
      const qr = parseQrBill(KAPO_QR_TEXT);
      return {
        qrText: KAPO_QR_TEXT,
        ocrText: text,
        language: "de",
        extraction: validateExtraction(extractFields(text, qr, "de"), { now: NOW }),
        pages: 1,
      };
    },
  };
}

/** Ahmed's letter as a first notice for our Prius ZH 513 925. */
const NOTICE_FOR_PRIUS = KAPO_ZH_OCR.replace("ZH 949636", "ZH 513925").replace(/Mahnung/g, "Busse");

async function setup(reader: FineReader) {
  const org = await seedOrganisation();
  const store = createMemoryStore();
  await store.put("fines/doc-1/letter-0000000000000000.pdf", new Uint8Array([37, 80, 68, 70]), "application/pdf");
  const document = await prisma.fineDocument.create({
    data: {
      organisationId: org.id,
      storageKey: "fines/doc-1/letter-0000000000000000.pdf",
      sha256: "a".repeat(64),
      bytes: 4,
      pages: 1,
      uploadedById: "u1",
      uploadedByName: "Eng Ahmed",
    },
  });
  const notified: { fineId: string; reason: string }[] = [];
  const deps: FineDeps = {
    client: prisma,
    store,
    reader,
    now: NOW,
    notify: async (fineId, reason) => {
      notified.push({ fineId, reason });
      await prisma.fine.update({ where: { id: fineId }, data: { status: "NOTIFIED", notifiedAt: NOW } });
    },
  };
  return { org, store, document, deps, notified };
}

describe("processFineDocument", () => {
  it("reads a notice, finds who had the car, records the fine and sends it", async () => {
    const { org, document, deps, notified } = await setup(readerFor(NOTICE_FOR_PRIUS));
    const rental = await seedRental(org.id, { signedAt: new Date("2026-06-01T08:10:00Z") });

    expect(await processFineDocument(deps, document.id)).toBe("processed");

    const doc = await prisma.fineDocument.findUniqueOrThrow({ where: { id: document.id } });
    expect(doc).toMatchObject({ status: "PROCESSED", kind: "NOTICE", language: "de", reader: "fake", attempts: 1 });
    expect(doc.qrText).toBe(KAPO_QR_TEXT);
    expect(doc.fineId).not.toBeNull();

    const fine = await prisma.fine.findUniqueOrThrow({ where: { id: doc.fineId! } });
    expect(fine).toMatchObject({
      status: "NOTIFIED",
      reviewReason: null,
      carId: rental.carId,
      rentalId: rental.id,
      customerId: rental.customerId,
      issuerKind: "POLICE",
      issuerName: "Kantonspolizei Zürich",
      issuerIban: "CH2430000001800000803",
      fineNumber: "830557506 017 4",
      paymentReference: "001980919800083055750601742",
      amountCents: 4000,
      violationTimeKnown: true,
      location: "Lufingen, Zürcherstrasse",
      offenceCode: "303.1.a",
      speedMeasuredKmh: 55,
      speedLimitKmh: 50,
      reminderLevel: 0,
      handlingFeeCents: 2000,
      handlingFeeStatus: "DUE",
    });
    // 10:00 in Zurich on 2 July is 08:00 UTC.
    expect(fine.violationAt).toEqual(new Date("2026-07-02T08:00:00Z"));
    expect(fine.offenceTextDe).toContain("Höchstgeschwindigkeit");
    expect(fine.offenceTextEn).toContain("speed limit");
    expect(fine.letterDate?.toISOString().slice(0, 10)).toBe("2026-09-04");
    // No due date printed: the letter's date plus thirty days.
    expect(fine.dueDate?.toISOString().slice(0, 10)).toBe("2026-10-04");
    expect(notified).toEqual([{ fineId: fine.id, reason: "notice" }]);

    const events = await prisma.fineEvent.findMany({ where: { fineId: fine.id } });
    expect(events.map((e) => e.type)).toContain("fine.created");
  });

  it("sends a letter about a car that is not ours to the office", async () => {
    const { document, deps, notified } = await setup(readerFor(KAPO_ZH_OCR.replace(/Mahnung/g, "Busse")));

    await processFineDocument(deps, document.id);

    const doc = await prisma.fineDocument.findUniqueOrThrow({ where: { id: document.id } });
    const fine = await prisma.fine.findUniqueOrThrow({ where: { id: doc.fineId! } });
    expect(fine).toMatchObject({ status: "NEEDS_REVIEW", reviewReason: "PLATE_NOT_IN_FLEET", carId: null });
    expect(notified).toEqual([]);
  });

  it("sends a fine from when nobody had the car to the office", async () => {
    const { org, document, deps, notified } = await setup(readerFor(NOTICE_FOR_PRIUS));
    // Picked up after the offence.
    await seedRental(org.id, { signedAt: new Date("2026-08-01T08:00:00Z") });

    await processFineDocument(deps, document.id);

    const fine = await prisma.fine.findFirstOrThrow();
    expect(fine).toMatchObject({ status: "NEEDS_REVIEW", reviewReason: "NO_RENTAL_AT_TIME" });
    expect(fine.carId).not.toBeNull();
    expect(notified).toEqual([]);
  });

  it("records a reader failure and leaves the letter to be tried again", async () => {
    const failing: FineReader = {
      name: "broken",
      read: async () => {
        throw new Error("tesseract crashed");
      },
    };
    const { document, deps } = await setup(failing);

    expect(await processFineDocument(deps, document.id)).toBe("failed");
    const doc = await prisma.fineDocument.findUniqueOrThrow({ where: { id: document.id } });
    expect(doc).toMatchObject({ status: "FAILED", attempts: 1 });
    expect(doc.error).toContain("tesseract crashed");
    expect(await prisma.fine.count()).toBe(0);
  });

  it("gives up after three attempts", async () => {
    const { document, deps } = await setup(readerFor(NOTICE_FOR_PRIUS));
    await prisma.fineDocument.update({ where: { id: document.id }, data: { status: "FAILED", attempts: 3 } });
    expect(await processFineDocument(deps, document.id)).toBe("skipped");
  });

  it("fails cleanly when the stored file is gone", async () => {
    const { document, deps, store } = await setup(readerFor(NOTICE_FOR_PRIUS));
    await store.remove(document.storageKey);
    expect(await processFineDocument(deps, document.id)).toBe("failed");
    expect((await prisma.fineDocument.findUniqueOrThrow({ where: { id: document.id } })).error).toContain("missing");
  });

  it("processes a letter once when two runs reach it together", async () => {
    const { org, document, deps } = await setup(readerFor(NOTICE_FOR_PRIUS));
    await seedRental(org.id, { signedAt: new Date("2026-06-01T08:10:00Z") });

    const outcomes = await Promise.all([
      processFineDocument(deps, document.id),
      processFineDocument(deps, document.id),
    ]);
    expect(outcomes.sort()).toEqual(["processed", "skipped"]);
    expect(await prisma.fine.count()).toBe(1);
  });
});
