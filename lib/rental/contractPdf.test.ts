import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
// @ts-expect-error -- pdfjs ships no types for its worker module.
import * as pdfjsWorker from "pdfjs-dist/legacy/build/pdf.worker.mjs";
import { describe, expect, it } from "vitest";
import { buildContractPdf, type ContractPdfInput } from "./contractPdf";
import { findVehicle } from "./fleet";
import type { ContractDetails } from "./schema";

/**
 * The document pages are the one part of the contract that can now be absent.
 *
 * Assertions are on bytes rather than text because a PDF's contents are not
 * readable without a parser, and what matters here is which of the two mutually
 * exclusive shapes builds at all — and that neither-of-them cannot.
 */

// pdfjs' worker, handed over in-process as lib/fines/raster.ts does.
(globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = pdfjsWorker;

/** A one-pixel JPEG, so embedJpg has something real to parse. */
const JPEG = Uint8Array.from(
  Buffer.from(
    "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8U" +
      "HRofHh0aHBwcJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA" +
      "/8QAFAABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFBEB" +
      "AAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AlgAAAA==",
    "base64"
  )
);

/** A one-pixel PNG for the signature, which is embedded with embedPng. */
const PNG = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAF" +
      "hAJ/wlseKgAAAABJRU5ErkJggg==",
    "base64"
  )
);

const details: ContractDetails = {
  vehicleId: "prius-zh513925",
  mileageKm: 120_000,
  fuelLevel: "3/4",
  existingDamage: "",
  terms: {
    type: "WEEKLY",
    startAt: "2026-08-17T08:00:00.000Z",
    paymentMethod: "twint",
    totalWeeks: 3,
    weeklyAmountCents: 45_000,
    depositCents: 50_000,
  },
  lastName: "Meier",
  firstName: "Anna",
  birthDate: "1990-04-12",
  street: "Bahnhofstrasse 1",
  postalCode: "8001",
  city: "Zürich",
  country: "Switzerland",
  mobile: "+41791234567",
  email: "anna@example.ch",
  gtcAccepted: true,
  gtcVersion: "2026-07-31",
  gtcLanguage: "de",
  acceptedAt: "2026-08-17T08:00:00.000Z",
  truthfulInfoConfirmedAt: "2026-08-17T08:00:10.000Z",
  deceptionNoticeConfirmedAt: "2026-08-17T08:00:20.000Z",
  place: "Zurich",
};

const base = {
  details,
  vehicle: findVehicle("prius-zh513925")!,
  contractNumber: "ZA-20260822-0002",
  issuedAt: new Date("2026-08-22T10:00:00.000Z"),
  language: "de" as const,
  conditionPhotos: [],
  signaturePng: PNG,
  // Skipped so the tests measure the document pages rather than twenty pages
  // of terms, and so they stay fast.
  includeGtcAppendix: false,
};

const captured = {
  portraitPhoto: JPEG,
  idFrontPhoto: JPEG,
  idBackPhoto: JPEG,
  licenceFrontPhoto: JPEG,
  licenceBackPhoto: JPEG,
};

const onFile = {
  contractNumber: "ZA-20260212-0007",
  signedAt: "2026-02-12",
  checkedAt: "2026-08-22",
};

describe("buildContractPdf document pages", () => {
  it("builds with five captured documents, as it always has", async () => {
    const bytes = await buildContractPdf({ ...base, ...captured });
    expect(bytes.byteLength).toBeGreaterThan(1000);
  });

  it("builds with a reference page instead of the images", async () => {
    const bytes = await buildContractPdf({ ...base, documentsOnFile: onFile });
    expect(bytes.byteLength).toBeGreaterThan(1000);
  });

  it("is smaller without the embedded images", async () => {
    const withImages = await buildContractPdf({ ...base, ...captured });
    const withReference = await buildContractPdf({
      ...base,
      documentsOnFile: onFile,
    });
    expect(withReference.byteLength).toBeLessThan(withImages.byteLength);
  });

  it("refuses to build with no identity evidence at all", async () => {
    // A contract that names nobody's documents must be unbuildable, not merely
    // discouraged — this is the guard that makes the optional fields safe.
    await expect(
      buildContractPdf(base as unknown as ContractPdfInput)
    ).rejects.toThrow(/identity/i);
  });

  it("builds in English too", async () => {
    const bytes = await buildContractPdf({
      ...base,
      language: "en",
      documentsOnFile: onFile,
    });
    expect(bytes.byteLength).toBeGreaterThan(1000);
  });
});

/** The words on the contract's first page, where the terms are. */
async function firstPageText(bytes: Uint8Array): Promise<string> {
  const task = getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: false,
    verbosity: 0,
  });
  const doc = await task.promise;
  const content = await (await doc.getPage(1)).getTextContent();
  await task.destroy();
  return content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
}

/**
 * What the renter signs for, as the lessor asked for it on 16.10.2026: a
 * weekly rental for business, its weeks and the return they come to; a daily
 * one for tourism, priced per day; and how it is paid.
 */
describe("buildContractPdf terms", () => {
  it("prints a weekly rental's type, its weeks and the return they come to", async () => {
    const text = await firstPageText(
      await buildContractPdf({ ...base, documentsOnFile: onFile })
    );
    expect(text).toContain("Geschäftlich - wöchentlich / monatlich");
    expect(text).toMatch(/Anzahl Wochen\s+3/);
    // Three weeks from Monday 17.08.2026, 10:00 in Zurich.
    expect(text).toMatch(/Vereinbarte Rückgabe\s+07\.09\.2026/);
    expect(text).not.toContain("Unbefristet");
    expect(text).toContain("CHF 450.00");
    expect(text).toMatch(/Zahlungsart\s+TWINT/);
  });

  it("prints a daily rental's price per day, its days and their total", async () => {
    const daily: ContractDetails = {
      ...details,
      terms: {
        type: "FIXED_TERM",
        // 10:00 Monday to 12:00 Thursday in Zurich: three days and two hours,
        // so four days begun.
        startAt: "2026-08-17T08:00:00.000Z",
        endAt: "2026-08-20T10:00:00.000Z",
        dailyAmountCents: 8_000,
        depositCents: 0,
        paymentMethod: "cash",
      },
    };
    const text = await firstPageText(
      await buildContractPdf({ ...base, details: daily, documentsOnFile: onFile })
    );
    expect(text).toContain("Tourismus - Tagesmiete");
    expect(text).toMatch(/Tagespreis\s+CHF 80.00/);
    expect(text).toMatch(/Anzahl Tage\s+4/);
    expect(text).toMatch(/Gesamtpreis\s+CHF 320.00/);
    expect(text).toMatch(/Zahlungsart\s+Bar/);
  });
});
