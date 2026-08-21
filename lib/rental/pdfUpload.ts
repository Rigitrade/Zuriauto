/**
 * Accepts a customer's own PDF as an identity document.
 *
 * A PDF cannot be shrunk the way a photo can, so the guard rails live here,
 * at selection time: the whole contract has to fit Vercel's ~4.5 MB request
 * cap, and a file rejected while the customer is still on the documents step
 * costs them a different file — one rejected at submit costs them a finished
 * signature.
 *
 * Validation opens the file with pdf-lib for the same reason: a corrupt or
 * password-protected PDF must fail now, not inside `buildContractPdf` after
 * everything is signed.
 */

import type { PdfDocument } from "./imageCompress";

/** Small enough that even several PDF slots leave room for the photos. */
export const MAX_PDF_BYTES = 1.5 * 1024 * 1024;

/** One side of a document is one page; five allows for a generous scan. */
export const MAX_PDF_PAGES = 5;

/** Some pickers hand over an empty MIME type, so the name is checked too. */
export function looksLikePdf(file: File): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

/**
 * Validates the file and wraps it for a document slot.
 *
 * Throws `"file-too-large"` for the size and page caps, and lets pdf-lib's
 * own error escape for anything unreadable — the caller maps both onto
 * customer-facing messages.
 *
 * pdf-lib arrives via dynamic import, as it does at submit: it is ~250 kB
 * and only needed once a PDF is actually chosen.
 */
export async function acceptPdfFile(file: File): Promise<PdfDocument> {
  if (file.size > MAX_PDF_BYTES) throw new Error("file-too-large");

  const { PDFDocument } = await import("pdf-lib");
  const source = await PDFDocument.load(await file.arrayBuffer());

  const pageCount = source.getPageCount();
  if (pageCount === 0) throw new Error("file-unreadable");
  if (pageCount > MAX_PDF_PAGES) throw new Error("file-too-large");

  return { kind: "pdf", blob: file, fileName: file.name, pageCount };
}
