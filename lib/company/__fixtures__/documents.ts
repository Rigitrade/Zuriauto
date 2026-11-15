import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
// @ts-expect-error -- pdfjs ships no types for its worker module.
import * as pdfjsWorker from "pdfjs-dist/legacy/build/pdf.worker.mjs";
import { ZURIAUTO_IDENTITY } from "@/lib/company/identity";
import type { FineMailContext } from "@/lib/fines/mail";
import type { ReturnDetails } from "@/lib/rental/returnSchema";
import type { ContractDetails } from "@/lib/rental/schema";

/** Inputs shared by the golden test and the partner-company tests (phase B). */

(globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = pdfjsWorker;

export const PNG = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAF" +
      "hAJ/wlseKgAAAABJRU5ErkJggg==",
    "base64"
  )
);

export async function pdfText(bytes: Uint8Array): Promise<string> {
  const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: false, verbosity: 0 });
  const doc = await task.promise;
  const meta = (await doc.getMetadata()).info as Record<string, unknown>;
  const pages: string[] = [`[producer ${String(meta.Producer)}] [author ${String(meta.Author ?? "")}]`];
  for (let n = 1; n <= doc.numPages; n++) {
    const content = await (await doc.getPage(n)).getTextContent();
    pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
  }
  await task.destroy();
  return pages.join("\n");
}

export const LANGS = ["de", "en"] as const;

export const contractDetails: ContractDetails = {
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

export const returnDetails: ReturnDetails = {
  vehicleId: "prius-zh513925",
  mileageKm: 121_450,
  papersInside: "yes",
  keyReturned: "yes",
  boltRemoved: "no",
  fuelLevel: "1/2",
  cleanliness: "clean",
  damages: "",
  tickets: "no",
  ticketsNote: "",
  fullyPaid: "yes",
  paymentMethods: ["twint"],
  paidOn: "2026-10-18",
  hasDuePayment: "no",
  dueDate: "",
  depositBack: "yes",
  lastName: "Meier",
  firstName: "Anna",
  email: "anna@example.ch",
  place: "Zurich",
};

export const fineCtx = (language: "de" | "en"): FineMailContext => ({
  company: ZURIAUTO_IDENTITY,
  language,
  firstName: "Anna",
  plate: "ZH 513925",
  carModel: "Toyota Prius",
  violationAt: new Date("2026-10-02T08:00:00Z"),
  timeKnown: true,
  location: "Zürich, Seebahnstrasse",
  offence: { de: "Überschreiten der Höchstgeschwindigkeit", en: "Speeding" },
  amountCents: 12_000,
  dueDate: new Date("2026-11-30T00:00:00Z"),
  issuerName: "Stadtpolizei Zürich",
  fineNumber: "B-123456",
  feeCents: 2_500,
  payUrl: "https://zuriauto.ch/fines/pay/abc",
  reminder: false,
});
