import { timingSafeEqual } from "node:crypto";

/**
 * The fence around the pickup write endpoint.
 *
 * From Phase 2 `/apply` stops being merely a spam-relay target and becomes a
 * write to the system of record. An open endpoint would let anyone create a
 * rental against a real plate — and a fabricated rental naming a real driver
 * is a far worse artifact than a spam email, because the traffic-fine lookup
 * would answer with it.
 *
 * A shared secret, not a login: the page is already unindexed, the office
 * pastes the link into WhatsApp, and named accounts arrive in Phase 5 with the
 * dashboard, where they are needed anyway. Accepted trade-off — no attribution
 * and no per-person revocation, because the secret leaks the moment a URL is
 * forwarded. Rotate it by changing the environment variable.
 *
 * IMPORTANT: this is an *office* credential. The Phase 4 return form is opened
 * by renters from an email, and must never be fenced with this — mailing
 * customers this secret would hand every past renter permanent write access.
 * That flow uses the signed single-use ActionTokens Phase 3 introduces. Do not
 * generalise this module, add a role parameter, or call it from another
 * handler.
 */

export const APPLY_KEY_PARAM = "k";
export const APPLY_KEY_HEADER = "x-apply-key";

export function applyKeyValid(supplied: string | null): boolean {
  const expected = process.env.APPLY_SECRET;
  // Fail closed: an unconfigured secret is a misconfiguration, not permission.
  if (!expected || !supplied) return false;

  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on a length mismatch, which would itself leak the
  // length, so the comparison is guarded rather than short-circuited on it.
  if (a.length !== b.length) {
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}
