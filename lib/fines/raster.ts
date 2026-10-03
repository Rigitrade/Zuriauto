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

export async function rasterisePdf(
  bytes: Uint8Array,
  opts: { dpi?: number; maxPages?: number } = {}
): Promise<PageImage[]> {
  const dpi = opts.dpi ?? 300;
  const maxPages = opts.maxPages ?? MAX_PAGES;
  const task = open(bytes);

  try {
    const pdf = await task.promise;
    const pages: PageImage[] = [];
    for (let number = 1; number <= Math.min(pdf.numPages, maxPages); number += 1) {
      const page = await pdf.getPage(number);
      const viewport = page.getViewport({ scale: dpi / 72 });
      const canvas = createCanvas(
        Math.ceil(viewport.width),
        Math.ceil(viewport.height)
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
      pages.push({
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
      });
      page.cleanup();
    }
    return pages;
  } finally {
    await task.destroy();
  }
}
