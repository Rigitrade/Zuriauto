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
    totalWeeks: 4,
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
