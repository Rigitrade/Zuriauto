/**
 * What may be uploaded as a car's photograph.
 *
 * Its own module rather than another field on `updateCarSchema`, because a
 * photograph arrives as bytes on a different request with a different content
 * type, and the two validations have nothing in common but the car they name.
 *
 * Pure, so the rules can be tested without a store or a database: the
 * endpoint's job is to move bytes, and deciding whether a given upload is
 * acceptable is not something that should need an R2 bucket to exercise.
 */

/**
 * The formats accepted, and the extension each is stored under.
 *
 * A whitelist, not a blacklist. The browser sends the content type, so it is
 * a claim rather than a fact — but the endpoint serves these bytes back with
 * whatever type is recorded, and an SVG is a document that can carry script.
 * Refusing anything not on this list is what keeps the photo endpoint from
 * becoming a way to host an HTML page on the company's own origin.
 *
 * HEIC is absent on purpose despite every iPhone producing it: the browser
 * re-encodes to JPEG when the file goes through a canvas, which is what
 * `lib/rental/imageCompress.ts` already does for the document captures, and
 * accepting HEIC here would mean storing a file most desktop browsers cannot
 * display.
 */
export const CAR_PHOTO_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * The ceiling, after the browser has recompressed.
 *
 * Two megabytes is generous for a 1600px photograph of a car and small enough
 * that ten of them do not make the fleet screen slow on the office's phone.
 * The browser compresses before uploading; this is the backstop for a client
 * that did not, not the primary mechanism.
 */
export const CAR_PHOTO_MAX_BYTES = 2 * 1024 * 1024;

export type CarPhotoRefusal =
  /** Not an image this endpoint will store. */
  | "unsupported-type"
  /** Over the ceiling. */
  | "too-large"
  /** Zero bytes — a failed read on the client, not a photograph. */
  | "empty";

export interface CarPhotoUpload {
  contentType: string;
  bytes: number;
}

/**
 * Null when the upload is acceptable, otherwise why it is not.
 *
 * Null-for-success rather than a boolean, so the endpoint can answer with the
 * specific reason. "Too large" and "we do not take HEIC" call for different
 * things from whoever is holding the phone, and one generic 400 would leave
 * them retrying the same file.
 */
export function refuseCarPhoto(upload: CarPhotoUpload): CarPhotoRefusal | null {
  // Content types arrive with parameters — `image/jpeg; charset=binary` from
  // some clients — so the type is compared without them.
  const type = upload.contentType.split(";")[0].trim().toLowerCase();
  if (!(type in CAR_PHOTO_TYPES)) return "unsupported-type";
  if (upload.bytes <= 0) return "empty";
  if (upload.bytes > CAR_PHOTO_MAX_BYTES) return "too-large";
  return null;
}

/** The stored type, normalised — never the raw header, which may carry
 *  parameters this system would then serve back verbatim. */
export function normaliseCarPhotoType(contentType: string): string {
  return contentType.split(";")[0].trim().toLowerCase();
}

/** The extension a given accepted type is stored under. */
export function carPhotoExtension(contentType: string): string {
  return CAR_PHOTO_TYPES[normaliseCarPhotoType(contentType)] ?? "bin";
}
