import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { recognise } from "./ocr";
import { decodeQrCodes } from "./qrDecode";
import { pdfPageCount, rasterisePdf } from "./raster";

/**
 * The three primitives against a real letter.
 *
 * The fixture is Ahmed's sample: a Kantonspolizei Zürich Mahnung, photographed
 * on WhatsApp at 580 px wide and placed on an A4 page at 300 DPI — a far worse
 * input than a scanner produces. Slow by unit-test standards (OCR takes
 * seconds), which is the price of testing the thing that actually reads.
 */

const fixture = new Uint8Array(
  readFileSync(join(process.cwd(), "lib/fines/__fixtures__/kapo-zh-mahnung.pdf"))
);

describe("reading a scanned letter", () => {
  it("counts the pages", async () => {
    expect(await pdfPageCount(fixture)).toBe(1);
  });

  it("rasterises an A4 page at 300 DPI", { timeout: 60_000 }, async () => {
    const pages = await rasterisePdf(fixture);
    expect(pages).toHaveLength(1);
    expect(Math.abs(pages[0].width - 2480)).toBeLessThan(5);
    expect(Math.abs(pages[0].height - 3508)).toBeLessThan(5);
  });

  it("finds the QR-bill among the page's codes", async () => {
    const [page] = await rasterisePdf(fixture);
    const texts = await decodeQrCodes(page);
    expect(texts.some((text) => text.startsWith("SPC"))).toBe(true);
  }, 60_000);

  it("reads the fine number and the date in German", async () => {
    const [page] = await rasterisePdf(fixture);
    const result = await recognise(await page.ocrPng(), ["deu"]);
    expect(result.text).toContain("830557506 017 4");
    // Day and month only. Ahmed's green marker box runs under the year and
    // Tesseract reads its 6 as an 8 — the fixture is marked, a real scan is
    // not. A misread year is what validate.ts exists to catch.
    expect(result.text).toMatch(/02\.07\.20\d\d/);
    expect(result.words.length).toBeGreaterThan(50);
  }, 120_000);
});
