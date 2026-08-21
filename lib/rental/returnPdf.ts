/**
 * Builds the signed vehicle return report as a PDF.
 *
 * Same contract as `contractPdf.ts`: data in, bytes out, no DOM and no
 * network — and it borrows that module's Writer and layout constants so the
 * two documents read as siblings rather than as two designs.
 */

import { PDFDocument, StandardFonts } from "pdf-lib";
import { GTC_ENTITY } from "@/locales/gtc";
import {
  CONTENT_WIDTH,
  formatDate,
  formatDateTime,
  formatMileage,
  formatTime,
  INK,
  MARGIN,
  MUTED,
  RULE,
  toIsoDate,
  toWinAnsi,
  Writer,
} from "./contractPdf";
import { fuelLevelToFraction, type FleetVehicle } from "./fleet";
import { labelsFor, type RentalLanguage } from "./labels";
import type { PaymentMethod, ReturnDetails } from "./returnSchema";

export interface ReturnPdfInput {
  details: ReturnDetails;
  vehicle: FleetVehicle;
  returnNumber: string;
  issuedAt: Date;
  language: RentalLanguage;
  /** PNG bytes from the signature canvas. */
  signaturePng: Uint8Array;
}

export async function buildReturnPdf(input: ReturnPdfInput): Promise<Uint8Array> {
  const { details, vehicle, returnNumber, issuedAt, language } = input;

  const L = labelsFor(language);
  const R = L.ret;
  const P = L.pdf;

  const methodName: Record<PaymentMethod, string> = {
    cash: R.methodCash,
    twint: R.methodTwint,
    card: R.methodCard,
    bank: R.methodBank,
  };
  const yesNo = (value: "yes" | "no") => (value === "yes" ? R.yes : R.no);

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  doc.setTitle(`${R.pdf.title} ${returnNumber}`);
  doc.setProducer("zuriauto.ch");
  doc.setCreationDate(issuedAt);

  const w = new Writer(doc, font, bold);

  // --- Header ----------------------------------------------------------
  w.page.drawText(toWinAnsi("ZURIAUTO"), {
    x: MARGIN,
    y: w.cursor,
    size: 18,
    font: bold,
    color: INK,
  });
  w.gap(20);
  w.text(`${P.lessor}: ${GTC_ENTITY}`, { size: 9, color: MUTED });
  w.gap(10);
  w.text(R.pdf.title, { size: 14, font: bold });
  w.gap(6);
  w.field(R.pdf.returnNumber, returnNumber);
  w.field(P.issued, formatDateTime(issuedAt));

  // --- Vehicle ---------------------------------------------------------
  w.sectionTitle(P.vehicleSection);
  w.field(P.model, vehicle.model);
  w.field(P.plate, vehicle.plate);
  if (vehicle.vin) w.field(P.vin, vehicle.vin);
  w.field(R.pdf.mileage, `${formatMileage(details.mileageKm)} ${P.km}`);
  w.field(P.fuel, fuelLevelToFraction(details.fuelLevel));

  // --- Condition at return ---------------------------------------------
  w.sectionTitle(R.conditionHeading);
  w.field(R.pdf.papers, yesNo(details.papersInside));
  w.field(R.pdf.key, yesNo(details.keyReturned));
  w.field(
    R.pdf.clean,
    details.cleanliness === "clean" ? R.cleanYes : R.cleanNeedsWash
  );
  w.field(R.pdf.damages, details.damages.trim() || R.pdf.damagesNone);

  // --- Payment ---------------------------------------------------------
  w.sectionTitle(R.paymentHeading);
  w.field(R.pdf.tickets, yesNo(details.tickets));
  if (details.tickets === "yes" && details.ticketsNote.trim()) {
    w.field(R.pdf.ticketsNote, details.ticketsNote);
  }
  w.field(R.pdf.fullyPaid, yesNo(details.fullyPaid));
  if (details.paymentMethods.length) {
    w.field(
      R.pdf.methods,
      details.paymentMethods.map((method) => methodName[method]).join(", ")
    );
  }
  w.field(R.pdf.duePayment, yesNo(details.hasDuePayment));
  if (details.hasDuePayment === "yes") {
    w.field(R.pdf.dueDate, formatDate(details.dueDate));
    if (details.dueMethod) {
      w.field(R.pdf.dueMethod, methodName[details.dueMethod]);
    }
  }
  w.field(R.pdf.deposit, yesNo(details.depositBack));

  // --- Renter ----------------------------------------------------------
  w.sectionTitle(P.customerSection);
  w.field(P.lastName, details.lastName);
  w.field(P.firstName, details.firstName);
  w.field(P.email, details.email);

  // --- Signature -------------------------------------------------------
  const signature = await doc.embedPng(input.signaturePng);
  const signatureWidth = Math.min(220, CONTENT_WIDTH / 2);
  const signatureHeight =
    (signature.height / signature.width) * signatureWidth;

  w.sectionTitle(P.signatureSection);
  w.ensure(signatureHeight + 56);

  const signatureTop = w.cursor;
  w.page.drawImage(signature, {
    x: MARGIN,
    y: signatureTop - signatureHeight,
    width: signatureWidth,
    height: signatureHeight,
  });
  w.gap(signatureHeight + 6);

  w.page.drawLine({
    start: { x: MARGIN, y: w.cursor },
    end: { x: MARGIN + signatureWidth, y: w.cursor },
    thickness: 0.75,
    color: RULE,
  });
  w.gap(12);
  w.text(
    `${P.signedBy}: ${details.firstName} ${details.lastName}`.toUpperCase(),
    { size: 9, color: MUTED }
  );
  w.gap(2);
  w.text(
    `${P.placeAndDate}: ${details.place || "Zurich"}, ` +
      `${formatDate(toIsoDate(issuedAt))}, ${formatTime(issuedAt)}`,
    { size: 9, color: MUTED }
  );

  // --- Footers ---------------------------------------------------------
  const pages = doc.getPages();
  pages.forEach((page, index) => {
    const footer = toWinAnsi(
      `${returnNumber}   ·   ${P.page} ${index + 1} ${P.of} ${pages.length}`
    );
    page.drawText(footer, {
      x: MARGIN,
      y: MARGIN - 12,
      size: 8,
      font,
      color: MUTED,
    });
  });

  return doc.save();
}
