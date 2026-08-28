import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/admin/password";
import { requireAdmin, requireOwner } from "@/lib/admin/session";
import { newUserSchema } from "@/lib/admin/users";

/**
 * The accounts an owner manages.
 *
 * Owner-only, both verbs. A staff member who could create an account could
 * mint themselves a second login, which is the reason the role exists at all.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 401 when nobody is signed in, 403 when somebody is but is not an owner. */
async function ownerOr(request: Request) {
  const user = await requireAdmin(request);
  if (!user) return { error: NextResponse.json({ code: "unauthorised" }, { status: 401 }) };
  const owner = await requireOwner(request);
  if (!owner) return { error: NextResponse.json({ code: "forbidden" }, { status: 403 }) };
  return { owner };
}

export async function GET(request: Request) {
  const { error } = await ownerOr(request);
  if (error) return error;

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

  const created = await prisma.adminUser.create({
    data: {
      organisationId: organisation.id,
      username: input.username,
      displayName: input.displayName,
      role: input.role,
      passwordHash: await hashPassword(input.password),
      createdById: owner!.id,
    },
    select: { id: true, username: true, displayName: true, role: true },
  });

  return NextResponse.json({ user: created }, { status: 201 });
}
