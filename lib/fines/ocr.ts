/**
 * Text from a page image, with how sure the recogniser was of each word.
 *
 * Tesseract, through tesseract.js, with its trained data read from
 * `lib/fines/tessdata/` rather than downloaded: a function that fetched 6 MB
 * from a CDN on every cold start would fail whenever the CDN did, and would
 * send nothing anywhere but would still depend on somewhere.
 *
 * One worker per call, terminated afterwards. Letters arrive a few at a time;
 * a pooled worker would hold ~100 MB between them for no gain.
 */

import { join } from "node:path";
import { createWorker, PSM } from "tesseract.js";

export type OcrLanguage = "deu" | "fra" | "ita";

export interface OcrWord {
  text: string;
  /** 0–100, Tesseract's own figure. */
  confidence: number;
}

export interface OcrResult {
  text: string;
  words: OcrWord[];
  /** Mean word confidence, 0–100. */
  confidence: number;
}

export const TESSDATA_DIR = join(process.cwd(), "lib", "fines", "tessdata");

/**
 *  page    a letter, read as one block of text. Tried against automatic
 *          layout on 2026-10-03: the clean letters read the same, Ahmed's
 *          photographed sample lost its date line.
 *  sparse  a phone screenshot: a few lines of very different sizes. Left to
 *          its default, Tesseract dropped the large "CHF 40.00" of a TWINT
 *          confirmation and kept everything around it.
 * Set explicitly either way, so a library upgrade cannot change it silently.
 */
export type OcrLayout = "page" | "sparse";

export async function recognise(
  png: Buffer,
  languages: OcrLanguage[],
  layout: OcrLayout = "page"
): Promise<OcrResult> {
  const worker = await createWorker(languages, 1, {
    langPath: TESSDATA_DIR,
    cacheMethod: "none",
    gzip: false,
  });
  try {
    await worker.setParameters({
      tessedit_pageseg_mode: layout === "sparse" ? PSM.SPARSE_TEXT : PSM.SINGLE_BLOCK,
    });
    const { data } = await worker.recognize(png, {}, { text: true, blocks: true });
    const words: OcrWord[] = [];
    for (const block of data.blocks ?? []) {
      for (const paragraph of block.paragraphs) {
        for (const line of paragraph.lines) {
          for (const word of line.words) {
            words.push({ text: word.text, confidence: word.confidence });
          }
        }
      }
    }
    return { text: data.text, words, confidence: data.confidence };
  } finally {
    await worker.terminate();
  }
}
