/**
 * Permission to copy one contract's identity documents onto a new one.
 *
 * Issued only by a successful lookup, so holding it proves the caller has
 * already legitimately read that the customer exists. It exists so the submit
 * path never has to trust a client-supplied contract id — the obvious
 * alternative, matching the submitted email against the stored one, refuses the
 * reuse precisely when a returning customer has changed their email, which is a
 * normal thing to have done.
 *
 * Deliberately NOT an ActionToken row. That is mailed to a customer and must be
 * single-use and revocable, properties that need a row. This lives for half an
 * hour inside one staff session, authorises nothing its holder has not already
 * read, and needs no revocation — so a row would buy a write and a cleanup
 * obligation and nothing else.
 *
 * Keyed with APPLY_SECRET, which is already the office credential for this
 * flow: rotating it invalidates outstanding tokens, which is the correct
 * behaviour and is why the "different secret" case is tested.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

/** Long enough for a handover, short enough that a copied URL goes stale. */
export const REUSE_TOKEN_TTL_MS = 30 * 60 * 1000;

function sign(payload: string): string {
  const secret = process.env.APPLY_SECRET;
  // Fail closed, as applyKeyValid does: an unconfigured secret is a
  // misconfiguration, not permission to skip signing.
  if (!secret) throw new Error("APPLY_SECRET is not set.");
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function constantTimeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  // timingSafeEqual throws on a length mismatch, which would itself leak the
  // length, so the comparison is guarded rather than short-circuited on it.
  if (left.length !== right.length) {
    timingSafeEqual(right, right);
    return false;
  }
  return timingSafeEqual(left, right);
}

export function issueReuseToken(
  contractId: string,
  now: Date = new Date()
): string {
  const payload = `${contractId}.${now.getTime() + REUSE_TOKEN_TTL_MS}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`;
}

/** The contract id the token authorises, or null for any reason it does not. */
export function readReuseToken(
  token: string,
  now: Date = new Date()
): string | null {
  const parts = token.split(".");
  // base64url contains no dot, so a well-formed token has exactly two parts.
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts;
  if (!encoded || !signature) return null;

  const payload = Buffer.from(encoded, "base64url").toString("utf8");

  // Verified before anything is parsed out of it, so a forged payload never
  // reaches the parser.
  let expected: string;
  try {
    expected = sign(payload);
  } catch {
    return null;
  }
  if (!constantTimeEqual(signature, expected)) return null;

  const separator = payload.lastIndexOf(".");
  if (separator <= 0) return null;

  const contractId = payload.slice(0, separator);
  const expiresAt = Number(payload.slice(separator + 1));
  if (!contractId || !Number.isFinite(expiresAt)) return null;
  if (expiresAt <= now.getTime()) return null;

  return contractId;
}
