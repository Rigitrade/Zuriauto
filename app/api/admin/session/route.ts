import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  ADMIN_SESSION_TTL_MS,
  adminSecretValid,
  issueAdminSession,
} from "@/lib/admin/session";

/**
 * Signing in and out of the fleet page.
 *
 * The secret is posted once and exchanged for a signed cookie, so it does not
 * travel in a URL on every subsequent request. See lib/admin/session.ts for why
 * this is not `APPLY_SECRET`.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    // Strict rather than lax: nothing should ever link into an admin action
    // from another site, so there is no navigation this would break.
    sameSite: "strict" as const,
    // Plain HTTP only in development, where there is no certificate.
    secure: process.env.NODE_ENV !== "development",
    path: "/",
    maxAge,
  };
}

export async function POST(request: Request) {
  let secret: unknown;
  try {
    secret = (await request.json())?.secret;
  } catch {
    return NextResponse.json({ code: "bad-request" }, { status: 400 });
  }

  if (typeof secret !== "string" || !adminSecretValid(secret)) {
    // One answer for a wrong secret, a missing one and an unconfigured server:
    // a caller learns only that they are not in.
    return NextResponse.json({ code: "unauthorised" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    ADMIN_COOKIE,
    issueAdminSession(),
    cookieOptions(ADMIN_SESSION_TTL_MS / 1000)
  );
  return response;
}

/** Signing out. Clearing the cookie is enough — the token is stateless. */
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, "", cookieOptions(0));
  return response;
}
