/**
 * Single-use links that authenticate a renter who has no account.
 *
 * 32 random bytes go in the email; only their SHA-256 hash goes in the
 * database, so a database dump does not hand over a set of live links into
 * strangers' rental records. Verification is a lookup by hash, single use is a
 * `usedAt` stamp, and revocation is deleting a row.
 *
 * Chosen over a signed stateless token — an HMAC or a JWT — because single use
 * and revocation are the properties that matter here, and both need a row
 * anyway. A stateless token would buy nothing and would be impossible to
 * withdraw.
 *
 * This is emphatically NOT `APPLY_SECRET`. That is an office credential pasted
 * into WhatsApp by staff; see the warning in lib/applyKey.ts.
 */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** How long a manage link stays usable. */
export const MANAGE_TOKEN_TTL_HOURS = 14 * 24;

/** URL-safe, no padding, so the link survives being pasted into WhatsApp. */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Compares two hashes without leaking where they diverge.
 *
 * The lookup is by hash and a hash is not a secret, so this is belt and
 * braces rather than load-bearing — but a hash comparison in an auth path
 * should not be `===` for the same reason the office key's is not.
 */
export function hashesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    timingSafeEqual(right, right);
    return false;
  }
  return timingSafeEqual(left, right);
}

export interface TokenRowLike {
  expiresAt: Date;
  usedAt: Date | null;
}

/**
 * Whether a token row may still be acted on.
 *
 * Expiry and prior use are one predicate on purpose: the manage page shows the
 * same message for both, and for an unknown token too. A caller learns only
 * that the link does not work, never which of the three reasons applies.
 */
export function tokenIsUsable(row: TokenRowLike, now: Date): boolean {
  return row.usedAt === null && row.expiresAt.getTime() > now.getTime();
}

/** The link the reminder email carries. */
export function manageUrl(baseUrl: string, token: string): string {
  // Trailing slash before the query: next.config.ts sets trailingSlash, and
  // the unslashed path 308-redirects.
  return `${baseUrl.replace(/\/$/, "")}/rental/manage/?t=${token}`;
}
