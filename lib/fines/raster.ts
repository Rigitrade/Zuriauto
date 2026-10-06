/**
 * A scanned PDF into page images.
 *
 * A scan is a picture wrapped in a PDF: there is no text layer to read, so
 * both the QR decoder and the OCR need pixels. 300 DPI is what scanners
 * produce and what Tesseract is tuned for; an A4 page comes out at about
 * 2480×3508.
 *
 * pdfjs' legacy build, because it runs in Node without a DOM, and
 * `@napi-rs/canvas` as its canvas — a prebuilt binary, no system Cairo, which
 * is what lets this run in a serverless function. Both are listed in
 * `serverExternalPackages` so the bundler leaves them alone.
 */

import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
// @ts-expect-error -- pdfjs ships no types for its worker module.
import * as pdfjsWorker from "pdfjs-dist/legacy/build/pdf.worker.mjs";

/**
 * pdfjs' worker, handed over rather than found.
 *
 * In Node pdfjs runs its worker in-process, loading it with
 * `import("./pdf.worker.mjs")` through a variable. File tracing cannot follow
 * that, so on Vercel the file was not in the function, every PDF failed to
 * open, and the upload answered "not a PDF" — for a scan or a photo alike.
 * pdfjs looks at `globalThis.pdfjsWorker` first; this static import is one
 * the tracer does follow.
 */
(globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = pdfjsWorker;

export interface PageImage {
  width: number;
  height: number;
  /** RGBA, row-major, as `ImageData` holds it. */
  rgba: Uint8ClampedArray;
  png: () => Promise<Buffer>;
  /** Greyscale with the contrast stretched — what the OCR reads. */
  ocrPng: () => Promise<Buffer>;
}

/**
 * Greyscale, then the darkest and lightest one percent pinned to black and
 * white.
 *
 * Measured on Ahmed's sample: without it Tesseract lost the offence date
 * entirely; with it, the date read correctly. A faded or grey-backed scan is
 * the normal case — paper is not white, toner is not black — and the stretch
 * costs a few milliseconds.
 */
export function stretchToGrey(rgba: Uint8ClampedArray): Uint8ClampedArray {
  const pixels = rgba.length / 4;
  const grey = new Uint8Array(pixels);
  const histogram = new Uint32Array(256);
  for (let i = 0; i < pixels; i += 1) {
    const value = Math.round(
      0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2]
    );
    grey[i] = value;
    histogram[value] += 1;
  }

  const clip = pixels * 0.01;
  let low = 0;
  for (let seen = 0; low < 255 && seen + histogram[low] <= clip; low += 1) {
    seen += histogram[low];
  }
  let high = 255;
  for (let seen = 0; high > 0 && seen + histogram[high] <= clip; high -= 1) {
    seen += histogram[high];
  }
  const range = Math.max(1, high - low);

  const out = new Uint8ClampedArray(rgba.length);
  for (let i = 0; i < pixels; i += 1) {
    const value = ((grey[i] - low) * 255) / range;
    out[i * 4] = value;
    out[i * 4 + 1] = value;
    out[i * 4 + 2] = value;
    out[i * 4 + 3] = 255;
  }
  return out;
}

/** Letters are one to three pages; ten covers anything plausible. */
export const MAX_PAGES = 10;

function open(bytes: Uint8Array) {
  // A copy: pdfjs transfers the buffer it is given, which would empty the
  // caller's — and the caller usually still needs the bytes.
  return getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: false,
    verbosity: 0,
  });
}

export async function pdfPageCount(bytes: Uint8Array): Promise<number> {
  const task = open(bytes);
  try {
    return (await task.promise).numPages;
  } finally {
    await task.destroy();
  }
}

/**
 * The longest edge a page is rendered at, whatever the PDF says its size is.
 * A4 at 300 DPI is 3508 px. Some scanner apps write the page size in pixels
 * as points; taken at its word, such a page would be a 10333×14617 canvas —
 * about 600 MB of pixels for one page.
 */
export const MAX_EDGE_PX = 3600;

/**
 * Renders the pages one at a time and hands each to `fn` before the next
 * is drawn, so a ten-page letter holds one page of pixels, not ten.
 */
export async function forEachPage(
  bytes: Uint8Array,
  fn: (page: PageImage, index: number) => Promise<void>,
  opts: { dpi?: number; maxPages?: number } = {}
): Promise<number> {
  const dpi = opts.dpi ?? 300;
  const maxPages = opts.maxPages ?? MAX_PAGES;
  const task = open(bytes);

  try {
    const pdf = await task.promise;
    const count = Math.min(pdf.numPages, maxPages);
    for (let number = 1; number <= count; number += 1) {
      const page = await pdf.getPage(number);
      const natural = page.getViewport({ scale: 1 });
      const scale = Math.min(dpi / 72, MAX_EDGE_PX / Math.max(natural.width, natural.height));
      const viewport = page.getViewport({ scale });
      const canvas = createCanvas(
        Math.floor(viewport.width),
        Math.floor(viewport.height)
      );
      const context = canvas.getContext("2d");
      // A scan with a transparent background would read as black to the
      // decoders; paper is white.
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({
        canvas: canvas as unknown as HTMLCanvasElement,
        canvasContext: context as unknown as CanvasRenderingContext2D,
        viewport,
      }).promise;

      const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
      await fn(
        {
          width: canvas.width,
          height: canvas.height,
          rgba: data,
          png: async () => canvas.encode("png"),
          ocrPng: async () => {
            const grey = createCanvas(canvas.width, canvas.height);
            const greyContext = grey.getContext("2d");
            const image = greyContext.createImageData(canvas.width, canvas.height);
            image.data.set(stretchToGrey(data));
            greyContext.putImageData(image, 0, 0);
            return grey.encode("png");
          },
        },
        number - 1
      );
      page.cleanup();
    }
    return count;
  } finally {
    await task.destroy();
  }
}

/** Every page at once — for a single page, or for tests. */
export async function rasterisePdf(
  bytes: Uint8Array,
  opts: { dpi?: number; maxPages?: number } = {}
): Promise<PageImage[]> {
  const pages: PageImage[] = [];
  await forEachPage(bytes, async (page) => {
    pages.push(page);
  }, opts);
  return pages;
}
