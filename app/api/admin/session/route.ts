import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { passwordMatches } from "@/lib/admin/password";
import { rateLimited, rateLimitExceeded } from "@/lib/rental/rateLimit";
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

/**
 * How many failed sign-in attempts one address gets in ten minutes.
 *
 * Only failures are charged — the office sits behind one NAT address with up
 * to ten accounts, and ten correct sign-ins on the same morning must not
 * lock the desk out of its own dashboard.
 */
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

  const ip = clientIp(request);
  const now = new Date();
  // Its own scope, so a burst here cannot lock the office out of the pickup
  // form and vice versa.
  const limitOptions = { scope: "signin", max: SIGNIN_MAX };

  // Checked, not recorded: a run of correct passwords must not spend the
  // budget by itself. Only a failure below records an attempt.
  if (await rateLimitExceeded(prisma, ip, now, limitOptions)) {
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

  // One answer for a wrong password, an unknown username and a disabled
  // account: a caller learns only that they are not in.
  //
  // The hash is verified even when no user was found, against a dummy of the
  // same shape, so the response time does not reveal which usernames exist.
  const hash = user?.passwordHash ?? DUMMY_HASH;
  const ok = await passwordMatches(credentials.password, hash);
  if (!user || !ok) {
    await rateLimited(prisma, ip, now, limitOptions);
    return NextResponse.json({ code: "unauthorised" }, { status: 401 });
  }

  // The same "one answer" rule extends to a server that cannot sign anybody
  // in: issueAdminSession() throws when ADMIN_SECRET is unset, and a caller
  // who typed the right password must learn no more than "not in" — not a
  // 500 that tells them the credentials were the part that worked. Not
  // charged against the rate limit: this is a misconfiguration, not a guess.
  let token: string;
  try {
    token = issueAdminSession(user.id);
  } catch {
    return NextResponse.json({ code: "unauthorised" }, { status: 401 });
  }

  // Only stamped once a session has actually been issued — a sign-in that
  // produced no cookie is not a sign-in.
  await prisma.adminUser.update({
    where: { id: user.id },
    data: { lastSignInAt: new Date() },
  });

  const response = NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
    },
  });
  response.cookies.set(ADMIN_COOKIE, token, cookieOptions(ADMIN_SESSION_TTL_MS / 1000));
  return response;
}

/** Signing out. Clearing the cookie is enough — the token is stateless. */
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, "", cookieOptions(0));
  return response;
}
