/**
 * A photographed letter, as the one-page PDF everything else expects.
 *
 * Not every letter reaches the office's scanner: some arrive as a photo on a
 * phone, or forwarded on WhatsApp. Everything after the upload — the server's
 * checks, the duplicate test, the reader, the office's viewer and the copy
 * attached to the renter's email — is built for a PDF, so a photo becomes one
 * in the browser before it is uploaded, and nothing downstream changes.
 *
 * In the browser because that is where the photo can be decoded the right
 * way up: a phone stores the sensor image unrotated with an EXIF tag, and
 * `compressImage` asks the browser's decoder to honour it. It is also the one
 * place an iPhone's HEIC can be opened at all — by Safari.
 *
 * Client-safe. pdf-lib is large, so it is imported only once a photo is
 * dropped, not with the page.
 */

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|heic|heif)$/i;

/** What the upload's file picker offers. */
export const LETTER_ACCEPT = ["application/pdf", ...IMAGE_TYPES].join(",");

/**
 * The longest edge a photo keeps: A4 at 300 DPI, the resolution the reader
 * renders at, and under its MAX_EDGE_PX. A larger photo would only be
 * scaled down again when it is read.
 */
export const PHOTO_MAX_EDGE = 3508;
/** Well above the 0.72 the contract photos use: here the text must survive. */
export const PHOTO_QUALITY = 0.9;

/** A4's long side, in points. */
const A4_LONG_PT = 841.89;

/**
 * By type, and by name for the files a browser leaves untyped — Windows
 * often reports a .heic as "".
 */
export function isLetterImage(file: { type: string; name: string }): boolean {
  return IMAGE_TYPES.has(file.type.toLowerCase()) || IMAGE_EXTENSIONS.test(file.name);
}

/**
 * The page a photo is placed on, in points: its own proportions, with the
 * longer side as long as A4's. The reader renders pages at 300 DPI, so
 * whatever the photo's pixel count, the page it reads is a scan's size — a
 * small WhatsApp image is enlarged, a 12-megapixel one is not drawn past
 * what OCR can use.
 */
export function letterPageSize(widthPx: number, heightPx: number): { width: number; height: number } {
  const scale = A4_LONG_PT / Math.max(widthPx, heightPx);
  return { width: widthPx * scale, height: heightPx * scale };
}

/**
 * One page, the JPEG filling it.
 *
 * Without metadata: pdf-lib would otherwise stamp the time, and the same
 * photo dropped twice would hash differently and slip past the duplicate
 * check that turns away a second upload of the same scan.
 */
export async function imageLetterPdf(
  jpeg: Uint8Array,
  page: { width: number; height: number }
): Promise<Uint8Array> {
  const { PDFDocument } = await import("pdf-lib");
  const pdf = await PDFDocument.create({ updateMetadata: false });
  const image = await pdf.embedJpg(jpeg);
  pdf.addPage([page.width, page.height]).drawImage(image, {
    x: 0,
    y: 0,
    width: page.width,
    height: page.height,
  });
  return pdf.save();
}
