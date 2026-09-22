/**
 * What may be uploaded as a car's vehicle registration (Fahrzeugausweis).
 *
 * A sibling of `carPhoto.ts` rather than a parameter on it, because the two
 * differ in every way that matters. The photograph is a picture of a car on a
 * forecourt: public, image-only, and shrunk in the browser before it is sent.
 * This is the registration certificate — it names the holder and the first
 * registration, it is read off a scanner as often as a phone camera, and it is
 * served only to a signed-in office account.
 *
 * So a PDF is accepted here and is not accepted there. The office already
 * scans these to PDF; refusing one would mean asking somebody to photograph a
 * document they have in a better form. The ceiling is correspondingly higher,
 * since a PDF cannot be put through a canvas to be recompressed the way an
 * image can.
 *
 * Pure, like its sibling: whether a given upload is acceptable should not need
 * a bucket to decide.
 */

/**
 * The formats accepted, and the extension each is stored under.
 *
 * A whitelist for the reason the photograph's is one — these bytes are served
 * back with the type recorded here, and an SVG is a document that can carry
 * script. PDF is safe to add to that list only because it is served with
 * `Content-Disposition: attachment` and a restrictive CSP; see the endpoint.
 */
export const CAR_LICENCE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

/**
 * The ceiling.
 *
 * Five megabytes rather than the photograph's two. An image still arrives
 * recompressed by the browser and lands well under it, but a scanned PDF is
 * whatever the office's scanner produced — typically under a megabyte at 200
 * dpi, occasionally several if somebody scanned both sides in colour at 600.
 * Still inside the platform's request limit, which is the real constraint.
 */
export const CAR_LICENCE_MAX_BYTES = 5 * 1024 * 1024;

export type CarLicenceRefusal =
  /** Not a document this endpoint will store. */
  | "unsupported-type"
  /** Over the ceiling. */
  | "too-large"
  /** Zero bytes — a failed read on the client, not a document. */
  | "empty";

export interface CarLicenceUpload {
  contentType: string;
  bytes: number;
}

/** Null when the upload is acceptable, otherwise why it is not. */
export function refuseCarLicence(
  upload: CarLicenceUpload
): CarLicenceRefusal | null {
  const type = normaliseCarLicenceType(upload.contentType);
  if (!(type in CAR_LICENCE_TYPES)) return "unsupported-type";
  if (upload.bytes <= 0) return "empty";
  if (upload.bytes > CAR_LICENCE_MAX_BYTES) return "too-large";
  return null;
}

/** The stored type, normalised — never the raw header, which may carry
 *  parameters this system would then serve back verbatim. */
export function normaliseCarLicenceType(contentType: string): string {
  return contentType.split(";")[0].trim().toLowerCase();
}

/** The extension a given accepted type is stored under. */
export function carLicenceExtension(contentType: string): string {
  return CAR_LICENCE_TYPES[normaliseCarLicenceType(contentType)] ?? "bin";
}

/** Whether what is stored is a PDF, which the screen shows as a document link
 *  rather than trying to render as a thumbnail. */
export function isPdfLicence(contentType: string | null | undefined): boolean {
  return normaliseCarLicenceType(contentType ?? "") === "application/pdf";
}
