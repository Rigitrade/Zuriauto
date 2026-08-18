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
