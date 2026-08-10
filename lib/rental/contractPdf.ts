/**
 * Builds the signed pickup contract as a PDF.
 *
 * Pure in the sense that matters: contract data in, bytes out. No DOM, no
 * network, no component state — so it can be exercised directly rather than
 * only by driving the form, and so Phase 2 can call it from the server
 * untouched.
 */

import {
  PDFDocument,
  PDFFont,
  PDFImage,
  PDFPage,
  StandardFonts,
  rgb,
} from "pdf-lib";
import gtc, { GTC_DATE, GTC_ENTITY, type GtcLanguage } from "@/locales/gtc";
import { fuelLevelToFraction, type FleetVehicle } from "./fleet";
import { labelsFor, type RentalLanguage } from "./labels";
import type { ContractDetails } from "./schema";

const A4 = { width: 595.28, height: 841.89 };
const MARGIN = 48;
const CONTENT_WIDTH = A4.width - MARGIN * 2;
const FOOTER_SPACE = 42;

const INK = rgb(0.09, 0.11, 0.15);
const MUTED = rgb(0.42, 0.45, 0.5);
const RULE = rgb(0.85, 0.87, 0.9);

/**
 * pdf-lib's standard fonts encode WinAnsi, which throws on anything outside
 * it. GTC text is generated from PDFs and carries typographic quotes, dashes
 * and the odd caron, so unmapped input would fail at generation time rather
 * than review time. Fidelity is traded for never failing on a customer's
 * phone.
 */
const CHARACTER_MAP: Record<string, string> = {
  "‘": "'", "’": "'", "‚": ",", "‛": "'",
  "“": '"', "”": '"', "„": '"', "″": '"',
  "–": "-", "—": "-", "−": "-", "‐": "-", "‑": "-",
  "…": "...", "•": "-", "·": "-", "→": "->",
  " ": " ", " ": " ", " ": " ", " ": " ", "\t": "  ",
  "­": "", "​": "", "﻿": "",
  "€": "EUR", "™": "(TM)",
  "Š": "S", "š": "s", "Ž": "Z", "ž": "z",
  "Œ": "OE", "œ": "oe", "Ÿ": "Y",
};

export function toWinAnsi(text: string): string {
  let out = "";
  for (const char of text) {
    const mapped = CHARACTER_MAP[char];
    if (mapped !== undefined) {
      out += mapped;
      continue;
    }
    const code = char.codePointAt(0) ?? 0;
    if (char === "\n") out += char;
    else if (code < 0x20) out += " ";
    else if (code <= 0xff) out += char;
    else out += "?";
  }
  return out;
}

/** Splits text to fit `width`, breaking over-long words rather than clipping. */
function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];

  for (const paragraph of toWinAnsi(text).split("\n")) {
    let line = "";

    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;

      if (font.widthOfTextAtSize(candidate, size) <= width) {
        line = candidate;
        continue;
      }

      if (line) lines.push(line);

      if (font.widthOfTextAtSize(word, size) <= width) {
        line = word;
        continue;
      }

      // A single word wider than the column: break it by character.
      let chunk = "";
      for (const char of word) {
        if (font.widthOfTextAtSize(chunk + char, size) > width) {
          lines.push(chunk);
          chunk = char;
        } else {
          chunk += char;
        }
      }
      line = chunk;
    }

    lines.push(line);
  }

  return lines;
}

/** Cursor over a growing document, adding pages as content runs off the bottom. */
class Writer {
  page: PDFPage;
  private y: number;

  constructor(
    private readonly doc: PDFDocument,
    readonly font: PDFFont,
    readonly bold: PDFFont
  ) {
    this.page = doc.addPage([A4.width, A4.height]);
    this.y = A4.height - MARGIN;
  }

  get cursor(): number {
    return this.y;
  }

  newPage(): void {
    this.page = this.doc.addPage([A4.width, A4.height]);
    this.y = A4.height - MARGIN;
  }

  /** Starts a new page unless `space` points still fit above the footer. */
  ensure(space: number): void {
    if (this.y - space < MARGIN + FOOTER_SPACE) this.newPage();
  }

  gap(space: number): void {
    this.y -= space;
  }

  rule(): void {
    this.ensure(10);
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: MARGIN + CONTENT_WIDTH, y: this.y },
      thickness: 0.75,
      color: RULE,
    });
    this.y -= 14;
  }

  sectionTitle(text: string): void {
    this.ensure(34);
    this.y -= 6;
    this.page.drawText(toWinAnsi(text.toUpperCase()), {
      x: MARGIN,
      y: this.y,
      size: 9,
      font: this.bold,
      color: MUTED,
    });
    this.y -= 8;
    this.rule();
  }

  text(
    value: string,
    { size = 10, font = this.font, color = INK, indent = 0, leading = 1.45 } = {}
  ): void {
    const width = CONTENT_WIDTH - indent;
    for (const line of wrap(value, font, size, width)) {
      this.ensure(size * leading);
      this.page.drawText(line, {
        x: MARGIN + indent,
        y: this.y,
        size,
        font,
        color,
      });
      this.y -= size * leading;
    }
  }

  /** A label/value row, label in a fixed left column. */
  field(label: string, value: string): void {
    const size = 10;
    const labelWidth = 168;
    const lines = wrap(value || "-", this.font, size, CONTENT_WIDTH - labelWidth);

    this.ensure(Math.max(1, lines.length) * size * 1.45);
    this.page.drawText(toWinAnsi(label), {
      x: MARGIN,
      y: this.y,
      size,
      font: this.font,
      color: MUTED,
    });

    let lineY = this.y;
    for (const line of lines) {
      this.page.drawText(line, {
        x: MARGIN + labelWidth,
        y: lineY,
        size,
        font: this.bold,
        color: INK,
      });
      lineY -= size * 1.45;
    }
    this.y = lineY;
  }

  /** Two-column row, used for the tables inside the GTC. */
  row(left: string, right: string): void {
    const size = 9;
    const leftWidth = CONTENT_WIDTH * 0.62;
    const rightWidth = CONTENT_WIDTH * 0.34;

    const leftLines = wrap(left, this.font, size, leftWidth);
    const rightLines = wrap(right, this.font, size, rightWidth);
    const height = Math.max(leftLines.length, rightLines.length) * size * 1.4;

    this.ensure(height + 4);
    const top = this.y;

    leftLines.forEach((line, i) => {
      this.page.drawText(line, {
        x: MARGIN,
        y: top - i * size * 1.4,
        size,
        font: this.font,
        color: INK,
      });
    });

    rightLines.forEach((line, i) => {
      this.page.drawText(line, {
        x: MARGIN + CONTENT_WIDTH - rightWidth,
        y: top - i * size * 1.4,
        size,
        font: this.font,
        color: INK,
      });
    });

    this.y = top - height - 4;
  }

  /** Draws an image scaled to fit, captioned, starting on a fresh page. */
  imagePage(image: PDFImage, caption: string): void {
    this.newPage();
    this.sectionTitle(caption);

    const maxHeight = this.y - MARGIN - FOOTER_SPACE;
    const scale = Math.min(CONTENT_WIDTH / image.width, maxHeight / image.height);
    const width = image.width * scale;
    const height = image.height * scale;

    this.page.drawImage(image, {
      x: MARGIN + (CONTENT_WIDTH - width) / 2,
      y: this.y - height,
      width,
      height,
    });
    this.y -= height + 12;
  }
}

function formatDate(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : value;
}

const pad = (n: number) => String(n).padStart(2, "0");

function formatDateTime(date: Date): string {
  return `${formatDate(toIsoDate(date))} ${formatTime(date)}`;
}

/** Local calendar date as YYYY-MM-DD, so `formatDate` is the single formatter. */
function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatTime(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatMileage(km: number): string {
  return km.toLocaleString("de-CH").replace(/’/g, "'");
}

export interface ContractPdfInput {
  details: ContractDetails;
  vehicle: FleetVehicle;
  contractNumber: string;
  issuedAt: Date;
  language: RentalLanguage;
  /**
   * JPEG bytes, already downscaled by `imageCompress`. Both sides of each
   * document: a Swiss ID card carries the issuing data and validity on the
   * reverse, so a front-only copy is incomplete.
   */
  idFrontPhoto: Uint8Array;
  idBackPhoto: Uint8Array;
  licenceFrontPhoto: Uint8Array;
  licenceBackPhoto: Uint8Array;
  conditionPhotos: Uint8Array[];
  /** PNG bytes from the signature canvas. */
  signaturePng: Uint8Array;
  /** The full terms as an appendix. On by default. */
  includeGtcAppendix?: boolean;
}

export async function buildContractPdf(
  input: ContractPdfInput
): Promise<Uint8Array> {
  const {
    details,
    vehicle,
    contractNumber,
    issuedAt,
    language,
    includeGtcAppendix = true,
  } = input;

  const L = labelsFor(language).pdf;
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  doc.setTitle(`${L.title} ${contractNumber}`);
  doc.setProducer("zuriauto.ch");
  doc.setCreationDate(issuedAt);

  const w = new Writer(doc, font, bold);

  // --- Header ----------------------------------------------------------
  // The contracting party, not the trading brand. GTC_ENTITY is the same name
  // the terms give as lessor, so the document and the terms cannot disagree.
  w.page.drawText(toWinAnsi(GTC_ENTITY.toUpperCase()), {
    x: MARGIN,
    y: w.cursor,
    size: 18,
    font: bold,
    color: INK,
  });
  w.gap(20);
  w.text(L.brand, { size: 9, color: MUTED });
  w.gap(10);
  w.text(L.title, { size: 14, font: bold });
  w.gap(6);
  w.field(L.contractNumber, contractNumber);
  w.field(L.issued, formatDateTime(issuedAt));

  // --- Vehicle ---------------------------------------------------------
  w.sectionTitle(L.vehicleSection);
  w.field(L.model, vehicle.model);
  w.field(L.plate, vehicle.plate);
  w.field(L.vin, vehicle.vin);
  w.field(L.mileage, `${formatMileage(details.mileageKm)} ${L.km}`);
  w.field(L.fuel, fuelLevelToFraction(details.fuelLevel));

  // --- Renter ----------------------------------------------------------
  w.sectionTitle(L.customerSection);
  w.field(L.lastName, details.lastName);
  w.field(L.firstName, details.firstName);
  w.field(L.birthDate, formatDate(details.birthDate));
  w.field(
    L.address,
    `${details.street}, ${details.postalCode} ${details.city}, ${details.country}`
  );
  w.field(L.mobile, details.mobile);
  w.field(L.email, details.email);

  // --- Condition -------------------------------------------------------
  w.sectionTitle(L.conditionSection);
  w.field(L.damage, details.existingDamage.trim() || L.damageNone);

  // --- GTC acceptance --------------------------------------------------
  w.sectionTitle(L.gtcSection);
  w.text(L.gtcAccepted, { size: 10 });
  w.gap(8);
  w.field(L.gtcVersion, `${details.gtcVersion} (${GTC_DATE})`);
  w.field(L.gtcLanguage, details.gtcLanguage.toUpperCase());
  w.field(L.acceptedAt, formatDateTime(new Date(details.acceptedAt)));

  // --- Signature -------------------------------------------------------
  const signature = await doc.embedPng(input.signaturePng);
  const signatureWidth = Math.min(220, CONTENT_WIDTH / 2);
  const signatureHeight =
    (signature.height / signature.width) * signatureWidth;

  w.sectionTitle(L.signatureSection);
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
    `${L.signedBy}: ${details.firstName} ${details.lastName}`.toUpperCase(),
    { size: 9, color: MUTED }
  );
  w.gap(2);
  // Place, date and time as three comma-separated parts, matching the label.
  w.text(
    `${L.placeAndDate}: ${details.place || "Zurich"}, ` +
      `${formatDate(toIsoDate(issuedAt))}, ${formatTime(issuedAt)}`,
    { size: 9, color: MUTED }
  );

  // --- Photo pages -----------------------------------------------------
  const documentPages: [Uint8Array, string][] = [
    [input.idFrontPhoto, L.idFrontPhoto],
    [input.idBackPhoto, L.idBackPhoto],
    [input.licenceFrontPhoto, L.licenceFrontPhoto],
    [input.licenceBackPhoto, L.licenceBackPhoto],
  ];

  for (const [bytes, caption] of documentPages) {
    w.imagePage(await doc.embedJpg(bytes), caption);
  }

  for (const [index, photo] of input.conditionPhotos.entries()) {
    const image = await doc.embedJpg(photo);
    w.imagePage(image, `${L.conditionPhoto} ${index + 1}`);
  }

  // --- GTC appendix ----------------------------------------------------
  if (includeGtcAppendix) {
    const gtcDoc = gtc[details.gtcLanguage as GtcLanguage] ?? gtc.de;

    w.newPage();
    w.text(L.appendixTitle, { size: 13, font: bold });
    w.gap(6);
    w.text(`${gtcDoc.title} — ${gtcDoc.updated}`, { size: 9, color: MUTED });
    w.gap(10);

    for (const section of gtcDoc.sections) {
      w.ensure(40);
      w.gap(8);
      w.text(`${section.num} ${section.title}`, { size: 10.5, font: bold });
      w.gap(4);

      for (const block of section.blocks) {
        switch (block.kind) {
          case "sub":
            w.gap(4);
            w.text(block.title, { size: 9.5, font: bold });
            w.gap(2);
            break;
          case "p":
            w.text(block.text, { size: 9, leading: 1.4 });
            w.gap(4);
            break;
          case "list":
            for (const item of block.items) {
              w.text(`- ${item}`, { size: 9, indent: 10, leading: 1.4 });
            }
            w.gap(4);
            break;
          case "table":
            if (block.head) w.row(block.head[0], block.head[1]);
            for (const [left, right] of block.rows) w.row(left, right);
            w.gap(4);
            break;
        }
      }
    }
  }

  // --- Footers ---------------------------------------------------------
  // Written last, because the total page count is only known now.
  const pages = doc.getPages();
  pages.forEach((page, index) => {
    const footer = toWinAnsi(
      `${contractNumber}   ·   ${L.page} ${index + 1} ${L.of} ${pages.length}`
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
