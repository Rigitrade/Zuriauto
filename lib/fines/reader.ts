/**
 * Reading a letter, end to end, behind one interface.
 *
 * Phase 1 is `freeReader`: everything on our own server, nothing sent
 * anywhere. Phase 2 adds a second implementation that asks Claude, used only
 * for letters this one could not settle — and everything downstream of a
 * `ReadResult` stays as it is. See the spec, "Phase 2".
 */

import { extractFields } from "./extract";
import { detectLanguage } from "./language";
import { recognise, type OcrLanguage, type OcrWord } from "./ocr";
import { pickQrBill } from "./qrBill";
import { decodeQrCodes } from "./qrDecode";
import { rasterisePdf } from "./raster";
import type { Extraction, FineLanguage } from "./types";
import { validateExtraction } from "./validate";

export interface ReadResult {
  qrText: string | null;
  ocrText: string;
  language: FineLanguage | null;
  extraction: Extraction;
  pages: number;
}

export interface FineReader {
  name: string;
  read(pdf: Uint8Array, now: Date): Promise<ReadResult>;
}

const TESSERACT: Record<FineLanguage, OcrLanguage> = { de: "deu", fr: "fra", it: "ita" };

function normalise(word: string): string {
  return word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

/** The least confident OCR word among those a value is made of. */
function confidenceLookup(words: OcrWord[]) {
  const byText = new Map<string, number>();
  for (const word of words) {
    const key = normalise(word.text);
    if (!key) continue;
    byText.set(key, Math.min(byText.get(key) ?? 100, word.confidence));
  }
  return (value: string): number | null => {
    const scores = value
      .split(/\s+/)
      .map((token) => byText.get(normalise(token)))
      .filter((score): score is number => score !== undefined);
    return scores.length ? Math.min(...scores) : null;
  };
}

export const freeReader: FineReader = {
  name: "free-v1",

  async read(pdf, now) {
    const pages = await rasterisePdf(pdf);

    const qrTexts: string[] = [];
    for (const page of pages) qrTexts.push(...(await decodeQrCodes(page)));
    const qr = pickQrBill(qrTexts);
    const qrText = qrTexts.find((text) => text.startsWith("SPC")) ?? null;

    // Pass one only when the slip does not already name the language: with
    // all three models loaded the OCR is worse, so its text is used for
    // nothing but the vote.
    let language = qr ? detectLanguage("", qr) : null;
    if (!language && pages.length > 0) {
      const first = await recognise(await pages[0].ocrPng(), ["deu", "fra", "ita"]);
      language = detectLanguage(first.text, qr);
    }

    const model = TESSERACT[language ?? "de"];
    const texts: string[] = [];
    const words: OcrWord[] = [];
    for (const page of pages) {
      const result = await recognise(await page.ocrPng(), [model]);
      texts.push(result.text);
      words.push(...result.words);
    }
    const ocrText = texts.join("\n");

    const extraction = validateExtraction(extractFields(ocrText, qr, language), {
      now,
      wordConfidence: confidenceLookup(words),
    });

    return { qrText, ocrText, language, extraction, pages: pages.length };
  },
};
