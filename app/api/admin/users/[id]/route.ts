import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/admin/password";
import { requireAdmin } from "@/lib/admin/session";
import { updateUserSchema } from "@/lib/admin/users";

/**
 * Editing an account.
 *
 * Two callers with different rights, which is why this is not simply
 * owner-only: an owner may change anybody, and a staff member may change
 * exactly one field of their own account — their password. Nothing else is
 * self-service — a staff member who could set their own role could promote
 * themselves, and one who could set their own displayName could make the
 * dashboard attribute their actions to somebody else's name (see
 * `closedByName` on rental closure) while their immutable `username` stayed
 * theirs.
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
  // A staff member may change exactly one thing: their own password. Every
  // other field — role, disabled, and displayName — is owner-only, even on
  // their own account.
  const selfPasswordOnly =
    isSelf &&
    patch.password !== undefined &&
    patch.displayName === undefined &&
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
    // Scoped to all owners, not this organisation's owners — correct only
    // because the system runs a single Organisation today, the same
    // assumption every admin route makes by resolving it with `findFirst`.
    // If a second organisation ever exists, this count would include a
    // foreign owner and could wave through the exact lockout it exists to
    // prevent; re-scope it by organisationId before that happens.
    //
    // The count and the update below are also not atomic: two owners
    // demoting/disabling two different owners at the same instant could each
    // observe "there is another owner" and both succeed, leaving zero. Left
    // as-is deliberately — both actors are already-trusted owners, this is a
    // single small office, and the failure mode is recoverable via the
    // command-line script. If this guard ever needs to be a hard boundary,
    // the cheap fix is `SELECT ... FOR UPDATE` on the owner rows inside a
    // `prisma.$transaction`: it blocks instead of aborting, needs no
    // isolation-level change, and keeps the (expensive) scrypt hashing
    // outside the transaction.
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
