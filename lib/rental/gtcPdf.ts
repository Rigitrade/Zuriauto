/**
 * The downloadable GTC, one PDF per language.
 *
 * Built from `locales/gtc.ts`, the same text the website shows and the signed
 * contract carries as its appendix, by `scripts/build-gtc-pdfs.ts`. The output
 * is committed under `public/gtc-pdf/` and linked from the terms page.
 */

import { PDFDocument, StandardFonts } from "pdf-lib";
import gtc, { GTC_DATE, GTC_ENTITY, type GtcLanguage } from "@/locales/gtc";
import {
  INK,
  MARGIN,
  MUTED,
  Writer,
  toWinAnsi,
  writeGtcSections,
} from "./contractPdf";

const PAGE: Record<GtcLanguage, [string, string]> = {
  de: ["Seite", "von"],
  en: ["Page", "of"],
  fr: ["Page", "sur"],
};

const LESSOR: Record<GtcLanguage, string> = {
  de: "Vermieterin",
  en: "Lessor",
  fr: "Loueur",
};

export async function buildGtcPdf(language: GtcLanguage): Promise<Uint8Array> {
  const gtcDoc = gtc[language];
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  doc.setTitle(`${gtcDoc.title} – ${GTC_DATE}`);
  doc.setAuthor(GTC_ENTITY);
  doc.setProducer("zuriauto.ch");
  doc.setLanguage(language);
  // Fixed to the version date rather than the build time, so rebuilding
  // unchanged terms produces the same file.
  const [day, month, year] = GTC_DATE.split(".").map(Number);
  const versionDate = new Date(Date.UTC(year, month - 1, day));
  doc.setCreationDate(versionDate);
  doc.setModificationDate(versionDate);

  const w = new Writer(doc, font, bold);

  w.page.drawText("ZURIAUTO", {
    x: MARGIN,
    y: w.cursor,
    size: 18,
    font: bold,
    color: INK,
  });
  w.gap(20);
  w.text(`${LESSOR[language]}: ${GTC_ENTITY}`, { size: 9, color: MUTED });
  w.gap(10);
  w.text(gtcDoc.title, { size: 15, font: bold });
  w.gap(2);
  w.text(gtcDoc.updated, { size: 9, color: MUTED });
  w.gap(8);
  writeGtcSections(w, gtcDoc);

  const [page, of] = PAGE[language];
  const pages = doc.getPages();
  pages.forEach((p, index) => {
    p.drawText(
      toWinAnsi(
        `${gtcDoc.title} – ${GTC_DATE}   ·   ${page} ${index + 1} ${of} ${pages.length}`
      ),
      { x: MARGIN, y: MARGIN - 12, size: 8, font, color: MUTED }
    );
  });

  return doc.save();
}
