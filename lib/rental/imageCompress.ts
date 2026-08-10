/**
 * Shrinks a camera photo to something that fits in a serverless request body.
 *
 * Vercel caps a function request at roughly 4.5 MB. A single photo from a
 * current phone is comfortably 3-6 MB, and the contract carries at least two
 * of them, so compression is not an optimisation here — without it the request
 * fails outright.
 *
 * Compression runs when the file is chosen rather than at submit, so the cost
 * is paid while the customer is still filling the form instead of appearing as
 * a stall on the last button.
 */

export interface CompressedImage {
  blob: Blob;
  /** Object URL for preview. Callers must revoke it when done. */
  previewUrl: string;
  width: number;
  height: number;
}

export interface CompressOptions {
  /** Longest edge in pixels after scaling. */
  maxEdge?: number;
  /** JPEG quality, 0-1. */
  quality?: number;
}

const DEFAULTS: Required<CompressOptions> = { maxEdge: 1600, quality: 0.72 };

/**
 * Decodes the file with EXIF orientation applied.
 *
 * This is load bearing. Phones store the sensor image unrotated plus an EXIF
 * orientation tag; drawing the raw bitmap to a canvas discards the tag and the
 * ID photo lands sideways in the PDF. `createImageBitmap` honours it when
 * asked, and the `<img>` fallback gets it from the browser's own decoder.
 */
async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Older Safari rejects the option rather than ignoring it. Fall through.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("decode-failed"));
      image.src = url;
    });
  } finally {
    // Safe once the image has decoded; the bitmap is retained by the element.
    URL.revokeObjectURL(url);
  }
}

function dimensionsOf(source: ImageBitmap | HTMLImageElement): {
  width: number;
  height: number;
} {
  return source instanceof HTMLImageElement
    ? { width: source.naturalWidth, height: source.naturalHeight }
    : { width: source.width, height: source.height };
}

/** Scales to fit `maxEdge` and re-encodes as JPEG. Never scales up. */
export async function compressImage(
  file: Blob,
  options: CompressOptions = {}
): Promise<CompressedImage> {
  const { maxEdge, quality } = { ...DEFAULTS, ...options };

  const source = await decode(file);
  const { width: sourceWidth, height: sourceHeight } = dimensionsOf(source);

  if (!sourceWidth || !sourceHeight) {
    throw new Error("decode-failed");
  }

  const scale = Math.min(1, maxEdge / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas-unavailable");

  // JPEG has no alpha; without this, transparent source pixels turn black.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(source, 0, 0, width, height);

  if ("close" in source) source.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality)
  );
  if (!blob) throw new Error("encode-failed");

  return { blob, previewUrl: URL.createObjectURL(blob), width, height };
}

/** Re-encodes an already-compressed image harder, for the oversize retry. */
export async function recompress(
  image: CompressedImage,
  options: CompressOptions
): Promise<CompressedImage> {
  URL.revokeObjectURL(image.previewUrl);
  return compressImage(image.blob, options);
}

export async function toUint8Array(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}
