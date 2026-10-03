/**
 * Storage keys for fine letters and payment proofs.
 *
 * Meaningless on purpose, like every key in lib/storage/keys.ts: a document
 * id and random hex, never a plate, a fine number or a name, so a key pasted
 * into a log or a ticket ties nobody to anything.
 */

import { randomBytes } from "node:crypto";

export const LETTER_CONTENT_TYPE = "application/pdf";
/** A multi-page scan at 300 DPI; anything bigger is not a letter. */
export const MAX_LETTER_BYTES = 20 * 1024 * 1024;
export const MAX_LETTER_PAGES = 10;

export function fineLetterKey(documentId: string): string {
  return `fines/${documentId}/letter-${randomBytes(8).toString("hex")}.pdf`;
}

/** Whether a key is one this document's slot could have produced. */
export function isLetterKeyOf(documentId: string, key: string): boolean {
  return new RegExp(`^fines/${documentId}/letter-[0-9a-f]{16}\\.pdf$`).test(key);
}

export function fineProofKey(fineId: string, extension: string): string {
  return `fines/${fineId}/proof-${randomBytes(8).toString("hex")}.${extension}`;
}
