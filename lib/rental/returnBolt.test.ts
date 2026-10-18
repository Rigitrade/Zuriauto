import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
// @ts-expect-error -- pdfjs ships no types for its worker module.
import * as pdfjsWorker from "pdfjs-dist/legacy/build/pdf.worker.mjs";
import { describe, expect, it } from "vitest";
import { findVehicle } from "./fleet";
import { buildReturnPdf } from "./returnPdf";
import { returnDetailsSchema, type ReturnDetails } from "./returnSchema";

/**
 * The owner's question of 18.10.2026 for the return form: did the renter take
 * the car off their Bolt account? A car still on a renter's account can be
 * booked for rides by them after it is back with us. Asked of the rentals
 * lib/rental/bolt.ts names, where the form requires it; the schema takes the
 * return of a daily rental without it. Printed on the protocol when asked.
 */

// pdfjs' worker, handed over in-process as lib/fines/raster.ts does.
(globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = pdfjsWorker;

/** A one-pixel PNG for the signature, which is embedded with embedPng. */
const PNG = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAF" +
      "hAJ/wlseKgAAAABJRU5ErkJggg==",
    "base64"
  )
);

const details: ReturnDetails = {
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

async function pdfText(bytes: Uint8Array): Promise<string> {
  const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: false, verbosity: 0 });
  const doc = await task.promise;
  const pages: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const content = await (await doc.getPage(n)).getTextContent();
    pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
  }
  await task.destroy();
  return pages.join(" ");
}

describe("the Bolt question on the return", () => {
  it("takes yes or no, or no answer where it was not asked", () => {
    const unanswered: Partial<ReturnDetails> = { ...details };
    delete unanswered.boltRemoved;
    expect(returnDetailsSchema.safeParse(unanswered).success).toBe(true);

    for (const answer of ["yes", "no"] as const) {
      expect(returnDetailsSchema.safeParse({ ...details, boltRemoved: answer }).success).toBe(true);
    }
    expect(returnDetailsSchema.safeParse({ ...details, boltRemoved: "maybe" }).success).toBe(false);
  });

  it.each([
    ["de", "Fahrzeug aus der Bolt-App entfernt", "Nein"],
    ["en", "Car removed from the Bolt app", "No"],
  ] as const)("is printed on the %s protocol with the answer", async (language, label, answer) => {
    const text = await pdfText(
      await buildReturnPdf({
        details,
        vehicle: findVehicle(details.vehicleId)!,
        returnNumber: "ZR-20261018-513925-A1B2",
        issuedAt: new Date("2026-10-18T10:00:00Z"),
        language,
        signaturePng: PNG,
      })
    );
    const at = text.indexOf(label);
    expect(at, text).toBeGreaterThanOrEqual(0);
    // The answer follows its label, before the next field's.
    expect(text.slice(at + label.length, at + label.length + 12)).toContain(answer);
  });

  it("is left off the protocol of a return it was not asked on", async () => {
    const unanswered: ReturnDetails = { ...details };
    delete unanswered.boltRemoved;
    const text = await pdfText(
      await buildReturnPdf({
        details: unanswered,
        vehicle: findVehicle(details.vehicleId)!,
        returnNumber: "ZR-20261018-513925-C3D4",
        issuedAt: new Date("2026-10-18T10:00:00Z"),
        language: "de",
        signaturePng: PNG,
      })
    );
    expect(text).toContain("Autoschlüssel retourniert");
    expect(text).not.toContain("Bolt");
  });
});
