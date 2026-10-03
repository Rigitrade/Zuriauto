/**
 * Rentals for the fines tests, made the way production makes them.
 *
 * Through `persistPickup` and `closeRental` rather than inserted rows, so the
 * possession intervals the matcher reads are built from the same contract
 * signatures and close events a real rental leaves behind.
 */

import { prisma } from "@/lib/db";
import { extractFields } from "@/lib/fines/extract";
import type { FineDeps, NotifyReason } from "@/lib/fines/attach";
import { parseQrBill } from "@/lib/fines/qrBill";
import type { FineReader } from "@/lib/fines/reader";
import { validateExtraction } from "@/lib/fines/validate";
import { KAPO_ZH_OCR } from "@/lib/fines/__fixtures__/texts";
import { closeRental } from "@/lib/rental/closeRental";
import { persistPickup, type PickupUpload } from "@/lib/rental/persistPickup";
import type { ContractDetails } from "@/lib/rental/schema";
import { createMemoryStore } from "@/lib/storage";
import { ensureOrganisation, seedFleet } from "@/prisma/seed";

export const UPLOADS: PickupUpload[] = [
  { kind: "PORTRAIT", body: new Uint8Array([1]), contentType: "image/jpeg" },
  { kind: "ID_FRONT", body: new Uint8Array([2]), contentType: "image/jpeg" },
  { kind: "ID_BACK", body: new Uint8Array([3]), contentType: "image/jpeg" },
  { kind: "LICENCE_FRONT", body: new Uint8Array([4]), contentType: "image/jpeg" },
  { kind: "LICENCE_BACK", body: new Uint8Array([5]), contentType: "image/jpeg" },
  { kind: "SIGNATURE", body: new Uint8Array([6]), contentType: "image/png" },
];

export function pickupDetails(overrides: Partial<ContractDetails> = {}): ContractDetails {
  return {
    vehicleId: "prius-zh513925",
    mileageKm: 120_000,
    fuelLevel: "3/4",
    existingDamage: "",
    terms: {
      type: "WEEKLY",
      startAt: "2026-06-01T08:00:00.000Z",
      totalWeeks: 8,
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
    mobile: "079 123 45 67",
    email: "anna@example.ch",
    gtcAccepted: true,
    gtcVersion: "2026-07-31",
    gtcLanguage: "de",
    acceptedAt: "2026-06-01T08:00:00.000Z",
    place: "Zurich",
    ...overrides,
  };
}

export async function seedOrganisation() {
  const org = await ensureOrganisation(prisma);
  await seedFleet(prisma, org.id);
  return org;
}

/** A pickup signed at `signedAt`; returns the rental and its car. */
export async function seedRental(
  organisationId: string,
  options: { signedAt: Date; details?: Partial<ContractDetails> }
) {
  const details = pickupDetails({
    terms: {
      type: "WEEKLY",
      startAt: options.signedAt.toISOString(),
      totalWeeks: 8,
      weeklyAmountCents: 45_000,
      depositCents: 50_000,
    },
    ...options.details,
  });
  await persistPickup({
    organisationId,
    details,
    vehicleSlug: details.vehicleId,
    uploads: UPLOADS,
    pdf: { body: new Uint8Array([7]) },
    store: createMemoryStore(),
    now: options.signedAt,
  });
  const rental = await prisma.rental.findFirstOrThrow({
    where: { car: { slug: details.vehicleId }, status: "ACTIVE" },
    orderBy: { startAt: "desc" },
    select: { id: true, carId: true, customerId: true },
  });
  return rental;
}

/** Closes a rental by the office's button at `closedAt`. */
export async function closeAt(
  organisationId: string,
  rental: { id: string; carId: string },
  closedAt: Date
) {
  await prisma.$transaction((tx) =>
    closeRental(tx, {
      organisationId,
      rentalId: rental.id,
      carId: rental.carId,
      fromStatuses: ["ACTIVE", "EXTENSION_REQUESTED", "RETURN_SUBMITTED"],
      settlement: null,
      event: { type: "rental.closed.manual", payload: {} },
      now: closedAt,
    })
  );
}

export const ADMIN_SECRET = "test-admin-secret";

/** A signed-in office user's cookie header, as the dashboard sends it. */
export async function adminCookie(): Promise<string> {
  process.env.ADMIN_SECRET = ADMIN_SECRET;
  const { hashPassword } = await import("@/lib/admin/password");
  const { ADMIN_COOKIE, issueAdminSession } = await import("@/lib/admin/session");
  const org = await ensureOrganisation(prisma);
  const user = await prisma.adminUser.upsert({
    where: { organisationId_username: { organisationId: org.id, username: "ahmed" } },
    update: {},
    create: {
      organisationId: org.id,
      username: "ahmed",
      displayName: "Eng Ahmed",
      role: "staff",
      passwordHash: await hashPassword("Sommer2026!"),
    },
    select: { id: true },
  });
  return `${ADMIN_COOKIE}=${issueAdminSession(user.id)}`;
}

// --- Letters for the processing tests -------------------------------------


export const FINE_NOW = new Date("2026-10-03T12:00:00Z");

/** The Kantonspolizei slip, with the amount and message a test needs. */
export function kapoQr(amount = "40.00", message = "Ordnungsbusse: 830557506 017 4"): string {
  return [
    "SPC", "0200", "1", "CH2430000001800000803", "S", "Kantonspolizei Zürich",
    "Ordnungsbussen", "", "8010", "Zürich", "CH", "", "", "", "", "", "", "",
    amount, "CHF", "S", "Rigitrade AG", "Tannenstrasse", "16", "8424",
    "Embrach", "CH", "QRR", "001980919800083055750601742", message, "EPD",
  ].join("\n");
}

export interface FakeLetter {
  text: string;
  qrText: string | null;
}

/** Ahmed's letter as a first notice or a reminder for our Prius ZH 513 925. */
export function priusLetter(
  kind: "notice" | "reminder",
  options: { amount?: string; moment?: string; withQr?: boolean } = {}
): FakeLetter {
  let text = KAPO_ZH_OCR.replace("ZH 949636", "ZH 513925");
  if (kind === "notice") text = text.replace(/Mahnung/g, "Busse");
  if (options.moment) text = text.replace("02.07.2026 10.00", options.moment);
  if (options.amount) text = text.replace(/CHF 40\.00/g, `CHF ${options.amount}`);
  return {
    text,
    qrText: options.withQr === false ? null : kapoQr(options.amount ?? "40.00"),
  };
}

/**
 * A reader for several letters at once: each stored file is one byte, the
 * letter's index, and the reader returns that letter as the free reader
 * would have read it.
 */
export function fakeReader(letters: FakeLetter[]): FineReader {
  return {
    name: "fake",
    async read(pdf) {
      const letter = letters[pdf[0]];
      const qr = letter.qrText ? parseQrBill(letter.qrText) : null;
      return {
        qrText: letter.qrText,
        ocrText: letter.text,
        language: "de",
        extraction: validateExtraction(extractFields(letter.text, qr, "de"), { now: FINE_NOW }),
        pages: 1,
      };
    },
  };
}

/** Stores letter `index` and records its document. */
export async function letterDocument(
  organisationId: string,
  store: { put: (key: string, body: Uint8Array, type: string) => Promise<void> },
  index: number
) {
  const key = `fines/doc-${index}/letter-${String(index).padStart(16, "0")}.pdf`;
  await store.put(key, new Uint8Array([index]), "application/pdf");
  return prisma.fineDocument.create({
    data: {
      organisationId,
      storageKey: key,
      sha256: String(index).padStart(64, "0"),
      bytes: 1,
      pages: 1,
      uploadedById: "u1",
      uploadedByName: "Eng Ahmed",
    },
  });
}

/** Deps whose notify records what it was asked and moves a notice on. */
export function recordingDeps(
  store: FineDeps["store"],
  reader: FineReader
): { deps: FineDeps; notified: { fineId: string; reason: NotifyReason }[] } {
  const notified: { fineId: string; reason: NotifyReason }[] = [];
  return {
    notified,
    deps: {
      client: prisma,
      store,
      reader,
      now: FINE_NOW,
      notify: async (fineId, reason) => {
        notified.push({ fineId, reason });
        if (reason === "notice") {
          await prisma.fine.update({
            where: { id: fineId },
            data: { status: "NOTIFIED", notifiedAt: FINE_NOW },
          });
        }
      },
    },
  };
}
