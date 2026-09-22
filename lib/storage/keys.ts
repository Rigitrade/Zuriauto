import { randomBytes } from "node:crypto";

/**
 * Object keys, deliberately meaningless.
 *
 * A key ends up in server logs, in the storage console, and in whatever
 * support ticket someone pastes it into. Putting a name, an email or a
 * contract number in one would leak the association between a person and
 * their ID scan to everywhere a string can travel — so a key carries a
 * submission UUID and nothing else.
 *
 * The submission UUID rather than the contract id: assets are uploaded before
 * the transaction commits, so no contract id exists yet. It also means an
 * aborted submission's orphans share one prefix and can be swept in a single
 * call.
 */
export function assetKey(
  submissionId: string,
  kind: string,
  extension: string
): string {
  return `pickup/${submissionId}/${kind}-${randomBytes(8).toString("hex")}.${extension}`;
}

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export function extensionFor(contentType: string): string {
  return EXTENSIONS[contentType] ?? "bin";
}

/**
 * Where a car's photograph lives.
 *
 * A separate prefix from `pickup/`, and deliberately so: the retention sweep
 * walks Asset rows and deletes the objects behind them, and a fleet
 * photograph has no subject, no consent to expire and no contract to hang
 * from. Keeping it out of that prefix means an operator reading the bucket
 * can see at a glance which objects are personal data and which are not.
 *
 * The random suffix is what makes a replacement a new key rather than an
 * overwrite. An overwrite would be served from every CDN and browser cache
 * that already held the old bytes, and the office would replace a photo and
 * be told it had not worked.
 */
export function carPhotoKey(carId: string, extension: string): string {
  return `fleet/${carId}/photo-${randomBytes(8).toString("hex")}.${extension}`;
}

/**
 * Where a car's registration document lives.
 *
 * Its own prefix, separate from `fleet/…/photo-…`, and the separation is the
 * point rather than tidiness: `fleet/` was created so an operator reading the
 * bucket could see at a glance which objects are personal data and which are
 * not. A registration certificate names the holder, so it is on the wrong side
 * of that line from the photograph beside it, and a prefix that says so is
 * what keeps the distinction legible from the storage console.
 *
 * The random suffix is what makes a replacement a new key, exactly as it is
 * for the photograph — an overwrite would be served from every cache that
 * already held the old bytes.
 */
export function carLicenceKey(carId: string, extension: string): string {
  return `fleet-docs/${carId}/licence-${randomBytes(8).toString("hex")}.${extension}`;
}
