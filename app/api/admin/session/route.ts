import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { passwordMatches } from "@/lib/admin/password";
import { rateLimited } from "@/lib/rental/rateLimit";
import {
  ADMIN_COOKIE,
  ADMIN_SESSION_TTL_MS,
  issueAdminSession,
} from "@/lib/admin/session";

/**
 * Signing in and out of the fleet page.
 *
 * A username and password are posted once and exchanged for a signed cookie,
 * so credentials do not travel on every subsequent request. See
 * lib/admin/session.ts for why the signing key is not `APPLY_SECRET`.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** How many sign-in attempts one address gets in ten minutes. */
const SIGNIN_MAX = 10;

const credentialsSchema = z.object({
  username: z.string().trim().toLowerCase().min(1).max(64),
  password: z.string().min(1).max(200),
});

/**
 * A real hash of a value nobody knows, verified when no user matched.
 *
 * Without it, an unknown username returns in a millisecond while a known one
 * takes the scrypt work — which turns the login into a way to enumerate who
 * works here. Generated once at module load, so it costs nothing per request.
 */
const DUMMY_HASH =
  "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

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
  let credentials;
  try {
    credentials = credentialsSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ code: "bad-request" }, { status: 400 });
  }

  // Its own budget, so a burst here cannot lock the office out of the pickup
  // form and vice versa.
  if (
    await rateLimited(prisma, clientIp(request), new Date(), {
      scope: "signin",
      max: SIGNIN_MAX,
    })
  ) {
    return NextResponse.json({ code: "rate-limited" }, { status: 429 });
  }

  const user = await prisma.adminUser.findFirst({
    where: { username: credentials.username, disabledAt: null },
    select: {
      id: true,
      username: true,
      displayName: true,
      role: true,
      passwordHash: true,
    },
  });

  // One answer for a wrong password, an unknown username, a disabled account
  // and an unconfigured server: a caller learns only that they are not in.
  //
  // The hash is verified even when no user was found, against a dummy of the
  // same shape, so the response time does not reveal which usernames exist.
  const hash = user?.passwordHash ?? DUMMY_HASH;
  const ok = await passwordMatches(credentials.password, hash);
  if (!user || !ok) {
    return NextResponse.json({ code: "unauthorised" }, { status: 401 });
  }

  await prisma.adminUser.update({
    where: { id: user.id },
    data: { lastSignInAt: new Date() },
  });

  const response = NextResponse.json({
    ok: true,
    user: {
      username: user.username,
      displayName: user.displayName,
      role: user.role,
    },
  });
  response.cookies.set(
    ADMIN_COOKIE,
    issueAdminSession(user.id),
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
