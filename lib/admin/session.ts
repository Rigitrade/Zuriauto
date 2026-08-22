/**
 * The fence around the fleet admin page.
 *
 * A shared secret exchanged once for a signed, expiring cookie. Not a login:
 * named accounts arrive in Phase 5 with the dashboard proper, where they are
 * needed anyway to fill in the `createdBy` columns that have said "office"
 * since Phase 2.
 *
 * IMPORTANT: this is deliberately NOT `APPLY_SECRET`. That one is pasted into
 * WhatsApp by staff and leaks the moment a link is forwarded — see the warning
 * in lib/applyKey.ts. A page that can rewrite the fleet must not sit behind a
 * semi-public credential, so it gets its own variable.
 *
 * Accepted limitation, stated so it is not discovered later: one shared secret
 * means no attribution and no per-person revocation. Rotate by changing the
 * environment variable, which signs everyone out.
 *
 * A cookie rather than `?k=` in the URL, which is what the pickup form uses:
 * that link is opened once from a message, while this page is opened daily, and
 * a secret in a URL accumulates in history, bookmarks and referrer headers. The
 * cookie carries an HMAC over the expiry rather than the secret itself, so the
 * stored value is not the credential and goes stale on its own.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE = "zuriauto_admin";

/** One working day, so the office signs in once each morning. */
export const ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function secret(): string {
  const value = process.env.ADMIN_SECRET;
  if (!value) throw new Error("ADMIN_SECRET is not set.");
  return value;
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

/** Whether the value typed into the sign-in form is the office secret. */
export function adminSecretValid(supplied: string): boolean {
  const expected = process.env.ADMIN_SECRET;
  // Fail closed: an unconfigured secret is a misconfiguration, not permission.
  if (!expected || !supplied) return false;
  return constantTimeEqual(supplied, expected);
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function issueAdminSession(now: Date = new Date()): string {
  const payload = `admin.${now.getTime() + ADMIN_SESSION_TTL_MS}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`;
}

export function adminSessionValid(
  token: string | undefined,
  now: Date = new Date()
): boolean {
  if (!token) return false;

  const parts = token.split(".");
  // base64url contains no dot, so a well-formed token has exactly two parts.
  if (parts.length !== 2) return false;
  const [encoded, signature] = parts;
  if (!encoded || !signature) return false;

  const payload = Buffer.from(encoded, "base64url").toString("utf8");

  // Verified before anything is read out of it, so a rewritten expiry never
  // reaches the comparison below.
  let expected: string;
  try {
    expected = sign(payload);
  } catch {
    return false;
  }
  if (!constantTimeEqual(signature, expected)) return false;

  const [marker, expiry] = payload.split(".");
  if (marker !== "admin") return false;

  const expiresAt = Number(expiry);
  return Number.isFinite(expiresAt) && expiresAt > now.getTime();
}

/**
 * Reads the session cookie off a request.
 *
 * The Cookie header is parsed rather than reaching for Next's `cookies()`, so
 * every admin route can be driven by a plain `Request` in a test without a
 * request context to fake.
 */
export function adminCookieFrom(request: Request): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;

  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() !== ADMIN_COOKIE) continue;
    return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return undefined;
}

/** The one check every admin endpoint makes first. */
export function requestIsAdmin(request: Request, now: Date = new Date()): boolean {
  return adminSessionValid(adminCookieFrom(request), now);
}
