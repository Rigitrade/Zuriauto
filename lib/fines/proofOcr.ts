/**
 * The text on a renter's payment screenshot.
 *
 * Its own module so the proof flow can be tested without running Tesseract.
 * A PDF (an e-banking receipt) is rendered first; an image goes straight in.
 * German, which also reads the digits and "CHF" of an English app.
 */

import { recognise } from "./ocr";
import { rasterisePdf } from "./raster";

export async function readProofText(bytes: Uint8Array, contentType: string): Promise<string> {
  if (contentType === "application/pdf") {
    const [page] = await rasterisePdf(bytes, { maxPages: 1 });
    if (!page) return "";
    return (await recognise(await page.ocrPng(), ["deu"])).text;
  }
  return (await recognise(Buffer.from(bytes), ["deu"])).text;
}
