/**
 * The fence around the fleet admin page.
 *
 * `ADMIN_SECRET` is no longer the password. From Phase 5 it signs sessions:
 * people sign in with their own username and password against `AdminUser`,
 * and this key is what makes the resulting cookie unforgeable. It keeps its
 * name because four deployed environments already set it, and renaming it
 * would break every one of them for no gain.
 *
 * IMPORTANT: still deliberately NOT `APPLY_SECRET`. That one signs tokens in
 * the public, unfenced pickup flow — see the note in lib/rental/reuseToken.ts.
 * A key used there must never be the key that protects the fleet page.
 *
 * A cookie rather than a secret in the URL: this page is opened daily, and a
 * secret in a URL accumulates in history, bookmarks and referrer
 * headers.
 *
 * Rotating `ADMIN_SECRET` invalidates every cookie, which stays the way to
 * sign everybody out at once. Per-person revocation is `disabledAt`, checked
 * below on every request.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";

export const ADMIN_COOKIE = "zuriauto_admin";

/** One working day, so the office signs in once each morning. */
export const ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export interface AdminIdentity {
  id: string;
  username: string;
  displayName: string;
  role: "owner" | "staff";
}

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

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/**
 * `admin.<userId>.<issuedAt>.<expiresAt>`, signed.
 *
 * `issuedAt` is in the payload because it is what `credentialsChangedAt` is
 * compared against: changing a password has to invalidate cookies handed out
 * before the change, and only the cookie knows when it was handed out.
 */
export function issueAdminSession(userId: string, now: Date = new Date()): string {
  const issuedAt = now.getTime();
  const payload = `admin.${userId}.${issuedAt}.${issuedAt + ADMIN_SESSION_TTL_MS}`;
  const encoded = Buffer.from(payload, "utf8").toString("base64url");
  return `${encoded}.${sign(payload)}`;
}

/**
 * Verifies the seal and the expiry, and reports what the cookie claims.
 *
 * Says nothing about whether the user still exists or is still enabled — that
 * needs the database, and lives in `requireAdmin`. Split so the signing half
 * can be tested without one.
 */
export function readAdminCookie(
  token: string | undefined,
  now: Date = new Date()
): { userId: string; issuedAt: number } | null {
  if (!token) return null;

  const parts = token.split(".");
  // base64url contains no dot, so a well-formed token has exactly two parts.
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts;
  if (!encoded || !signature) return null;

  const payload = Buffer.from(encoded, "base64url").toString("utf8");

  // Verified before anything is read out of it, so a rewritten payload never
  // reaches the parsing below.
  let expected: string;
  try {
    expected = sign(payload);
  } catch {
    // ADMIN_SECRET is unset: nothing can be verified, so nobody is signed in.
    return null;
  }
  if (!constantTimeEqual(signature, expected)) return null;

  const fields = payload.split(".");
  if (fields.length !== 4) return null;
  const [marker, userId, issuedAtRaw, expiresAtRaw] = fields;
  if (marker !== "admin" || !userId) return null;

  const issuedAt = Number(issuedAtRaw);
  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt)) return null;
  if (expiresAt <= now.getTime()) return null;

  return { userId, issuedAt };
}

/**
 * Reads the session cookie off a request.
 *
 * The Cookie header is parsed rather than reaching for Next's `cookies()`, so
 * every admin route can be driven by a plain `Request` in a test without a
 * request context to fake.
 *
 * The parse below does no cookie-value decoding (no `decodeURIComponent`,
 * nothing that would unescape a `"..."`-quoted value). That is deliberate,
 * not an oversight: the value is always the base64url output of
 * `issueAdminSession`, which contains none of the characters cookie
 * serialisation would ever escape or quote — no `=`, no `;`, no space, no
 * `"`. If something other than that base64url token is ever put in this
 * cookie, this function needs an encoding-aware parse first.
 */
export function adminCookieFrom(request: Request): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const pair of header.split(";")) {
    const [name, ...rest] = pair.trim().split("=");
    if (name === ADMIN_COOKIE) return rest.join("=");
  }
  return undefined;
}

/**
 * The signed-in user, or null.
 *
 * Reads the row on every request, which is what buys revocation a stateless
 * cookie cannot have: `disabledAt` takes effect on the next click, and a
 * password change invalidates that person's other sessions. One indexed read,
 * against a dashboard serving a handful of requests a day.
 */
export async function requireAdmin(
  request: Request,
  now: Date = new Date()
): Promise<AdminIdentity | null> {
  const claim = readAdminCookie(adminCookieFrom(request), now);
  if (!claim) return null;

  const user = await prisma.adminUser.findUnique({
    where: { id: claim.userId },
    select: {
      id: true,
      username: true,
      displayName: true,
      role: true,
      disabledAt: true,
      credentialsChangedAt: true,
    },
  });
  if (!user || user.disabledAt) return null;
  // Issued before the password last changed: a stale session.
  if (user.credentialsChangedAt.getTime() > claim.issuedAt) return null;

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
  };
}

/**
 * As `requireAdmin`, and null unless the user is an owner.
 *
 * Has no production caller today; the spec's stage 2 is the intended one.
 * Note its contract before wiring that up: this returns `null` for both "not
 * signed in" and "not an owner", collapsing what the accounts routes
 * (`app/api/admin/users/route.ts`, `app/api/admin/users/[id]/route.ts`) treat
 * as two distinct responses — 401 for the first, 403 for the second. A stage
 * 2 caller that maps a `null` here straight to 401 would answer differently
 * than the rest of the admin surface for the same "signed in, wrong role"
 * case. Either give this function the same two-value contract or map its
 * `null` to 403 at the call site, deliberately, rather than by accident.
 */
export async function requireOwner(
  request: Request,
  now: Date = new Date()
): Promise<AdminIdentity | null> {
  const user = await requireAdmin(request, now);
  return user?.role === "owner" ? user : null;
}
