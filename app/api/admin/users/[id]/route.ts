import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/admin/password";
import { requireAdmin } from "@/lib/admin/session";
import { updateUserSchema } from "@/lib/admin/users";

/**
 * Editing an account.
 *
 * Two callers with different rights, which is why this is not simply
 * owner-only: an owner may change anybody, and anybody may change their own
 * password. Nothing else is self-service — a staff member who could set their
 * own role could promote themselves.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await requireAdmin(request);
  if (!actor) {
    return NextResponse.json({ code: "unauthorised" }, { status: 401 });
  }

  const { id } = await params;

  let patch;
  try {
    patch = updateUserSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ code: "bad-request" }, { status: 400 });
  }

  const isOwner = actor.role === "owner";
  const isSelf = actor.id === id;
  // A staff member may change exactly one thing: their own password.
  const selfPasswordOnly =
    isSelf &&
    patch.password !== undefined &&
    patch.role === undefined &&
    patch.disabled === undefined;

  if (!isOwner && !selfPasswordOnly) {
    return NextResponse.json({ code: "forbidden" }, { status: 403 });
  }

  const target = await prisma.adminUser.findUnique({
    where: { id },
    select: { id: true, role: true, disabledAt: true },
  });
  if (!target) {
    return NextResponse.json({ code: "not-found" }, { status: 404 });
  }

  // The lockout guard. Without it one mis-click leaves an office with a
  // dashboard nobody can administer and no way back except the database.
  const losesOwner =
    target.role === "owner" &&
    !target.disabledAt &&
    (patch.disabled === true || patch.role === "staff");

  if (losesOwner) {
    const otherOwners = await prisma.adminUser.count({
      where: { role: "owner", disabledAt: null, id: { not: target.id } },
    });
    if (otherOwners === 0) {
      return NextResponse.json({ code: "last-owner" }, { status: 409 });
    }
  }

  const data: Record<string, unknown> = {};
  if (patch.displayName !== undefined) data.displayName = patch.displayName;
  if (patch.role !== undefined) data.role = patch.role;
  if (patch.disabled !== undefined) {
    data.disabledAt = patch.disabled ? new Date() : null;
  }
  if (patch.password !== undefined) {
    data.passwordHash = await hashPassword(patch.password);
    // Ends every session that was issued under the old password, which is the
    // point of a reset when somebody else knew it.
    data.credentialsChangedAt = new Date();
  }

  const updated = await prisma.adminUser.update({
    where: { id: target.id },
    data,
    select: { id: true, username: true, displayName: true, role: true, disabledAt: true },
  });

  return NextResponse.json({ user: updated });
}
