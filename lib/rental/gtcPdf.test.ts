import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import gtc, { GTC_DATE, GTC_LANGUAGES, gtcPdfPath } from "@/locales/gtc";
import { buildGtcPdf } from "./gtcPdf";

/**
 * The downloadable terms are built from the same text the website and the
 * contract appendix show, so the three cannot disagree about what Art. 11 says.
 */
describe("buildGtcPdf", () => {
  it.each(GTC_LANGUAGES.map((l) => l.code))(
    "builds the %s terms as a titled, dated PDF",
    async (language) => {
      const bytes = await buildGtcPdf(language);
      const doc = await PDFDocument.load(bytes);

      expect(doc.getTitle()).toBe(`${gtc[language].title} – ${GTC_DATE}`);
      expect(doc.getPageCount()).toBeGreaterThan(2);
    }
  );
});

describe("gtcPdfPath", () => {
  it("names the file after the version date, so an old link keeps its version", () => {
    expect(gtcPdfPath("fr")).toBe("/gtc-pdf/gtc-zuriauto-2026-10-08-fr.pdf");
  });
});
