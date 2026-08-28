import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/admin/password";
import { requireAdmin } from "@/lib/admin/session";
import { newUserSchema } from "@/lib/admin/users";

/**
 * The accounts an owner manages.
 *
 * Owner-only, both verbs. A staff member who could create an account could
 * mint themselves a second login, which is the reason the role exists at all.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 401 when nobody is signed in, 403 when somebody is but is not an owner.
 *
 * One lookup, not two: `requireAdmin` already carries `role`, so there is no
 * need for a second `adminUser.findUnique` (via `requireOwner`) to learn
 * something the first call already knows. Two round-trips would also open a
 * window in which the row could change between them, for no benefit.
 */
async function ownerOr(request: Request) {
  const user = await requireAdmin(request);
  if (!user) return { error: NextResponse.json({ code: "unauthorised" }, { status: 401 }) };
  if (user.role !== "owner") {
    return { error: NextResponse.json({ code: "forbidden" }, { status: 403 }) };
  }
  return { owner: user };
}

export async function GET(request: Request) {
  const { error } = await ownerOr(request);
  if (error) return error;

  // No organisationId filter — correct only because the system runs a
  // single Organisation today, the same assumption every admin route makes
  // (see the fuller note in app/api/admin/users/[id]/route.ts). If a second
  // organisation ever exists, this `findMany` would hand one organisation's
  // owner the other's entire roster; scope it by organisationId before
  // that happens.
  const users = await prisma.adminUser.findMany({
    orderBy: [{ role: "asc" }, { username: "asc" }],
    // passwordHash is absent on purpose: it never leaves the server, not even
    // to an owner.
    select: {
      id: true,
      username: true,
      displayName: true,
      role: true,
      disabledAt: true,
      lastSignInAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    users: users.map((user) => ({
      ...user,
      disabledAt: user.disabledAt?.toISOString() ?? null,
      lastSignInAt: user.lastSignInAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  const { error, owner } = await ownerOr(request);
  if (error) return error;

  let input;
  try {
    input = newUserSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ code: "bad-request" }, { status: 400 });
  }

  const organisation = await prisma.organisation.findFirst({ select: { id: true } });
  if (!organisation) {
    console.error("[admin] no organisation row — run pnpm db:seed");
    return NextResponse.json({ code: "not-configured" }, { status: 503 });
  }

  const taken = await prisma.adminUser.findFirst({
    where: { organisationId: organisation.id, username: input.username },
    select: { id: true },
  });
  if (taken) {
    return NextResponse.json({ code: "username-taken" }, { status: 409 });
  }

  try {
    const created = await prisma.adminUser.create({
      data: {
        organisationId: organisation.id,
        username: input.username,
        displayName: input.displayName,
        role: input.role,
        passwordHash: await hashPassword(input.password),
        createdById: owner!.id,
        // Explicit app-clock time, not the column's `DEFAULT CURRENT_TIMESTAMP`.
        // `issuedAt` in a session cookie is always app time; if the database
        // clock leads it even slightly, a freshly created account would sign
        // in (200, cookie set) and then fail `requireAdmin`'s comparison on
        // every request after — a lockout invisible at creation time. Setting
        // this explicitly keeps both sides of that comparison on one clock.
        credentialsChangedAt: new Date(),
      },
      select: { id: true, username: true, displayName: true, role: true },
    });

    return NextResponse.json({ user: created }, { status: 201 });
  } catch (error) {
    // P2002 is the unique constraint on [organisationId, username]. The
    // pre-check above closes the common case; this catches two owners
    // creating the same username at the same instant, which would otherwise
    // surface as a 500 instead of the 409 this endpoint already defines.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === "P2002"
    ) {
      return NextResponse.json({ code: "username-taken" }, { status: 409 });
    }
    console.error("[admin] could not create the account:", error);
    return NextResponse.json({ code: "failed" }, { status: 500 });
  }
}
