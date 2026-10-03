import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { MAX_EDGE_PX, forEachPage, rasterisePdf } from "./raster";

/**
 * Review finding: page size comes from the PDF itself, and some scanner apps
 * write pixels as points. A 2480×3508 "pt" page at 300 DPI would be a
 * 10333×14617 canvas — about 600 MB for one page.
 */
async function pdfWithPage(width: number, height: number, pages = 1): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i += 1) doc.addPage([width, height]);
  return doc.save();
}

describe("rasterisePdf", () => {
  it("caps the long edge of a page declared in pixels", async () => {
    const [page] = await rasterisePdf(await pdfWithPage(2480, 3508));
    expect(Math.max(page.width, page.height)).toBeLessThanOrEqual(MAX_EDGE_PX);
  }, 60_000);

  it("still renders A4 at 300 DPI", async () => {
    const [page] = await rasterisePdf(await pdfWithPage(595.28, 841.89));
    expect(Math.abs(page.height - 3508)).toBeLessThan(5);
  }, 60_000);
});

describe("forEachPage", () => {
  it("hands over one page at a time, in order, and stops at the cap", async () => {
    const seen: number[] = [];
    await forEachPage(await pdfWithPage(595.28, 841.89, 3), async (page, index) => {
      seen.push(index);
      expect(page.width).toBeGreaterThan(0);
    }, { maxPages: 2 });
    expect(seen).toEqual([0, 1]);
  }, 60_000);
});
