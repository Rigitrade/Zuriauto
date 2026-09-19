import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveDoneOn, updateRepairSchema } from "@/lib/admin/cars";
import { requireAdmin } from "@/lib/admin/session";
import { zurichDayString } from "@/lib/rental/passes";

/**
 * Editing a repair, or removing one.
 *
 * Nested under the car rather than living at `/api/admin/repairs/[id]/`, so
 * the URL states which car a repair belongs to and the handler can check that
 * it really does. Without that check a repair id from one car would be
 * editable through another car's URL — harmless here, but the kind of gap
 * that stops being harmless the moment a second organisation exists.
 *
 * Unlike a car, a repair may genuinely be deleted. Nothing points at it, no
 * contract names it, and the common case is a line somebody typed against the
 * wrong vehicle. A retired-style soft delete would leave the office unable to
 * tidy up their own notes.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Both handlers need the same "does this repair belong to this car" answer. */
async function findRepair(carId: string, repairId: string) {
  const repair = await prisma.carRepair.findUnique({
    where: { id: repairId },
    select: { id: true, carId: true, status: true },
  });
  return repair && repair.carId === carId ? repair : null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; repairId: string }> }
) {
  const user = await requireAdmin(request);
  if (!user) {
    return NextResponse.json({ code: "unauthorised" }, { status: 401 });
  }

  const { id, repairId } = await params;

  let parsed;
  try {
    parsed = updateRepairSchema.safeParse(await request.json());
  } catch {
    return NextResponse.json({ code: "bad-request" }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json(
      { code: "invalid", issues: parsed.error.issues.map((i) => i.message) },
      { status: 400 }
    );
  }

  const repair = await findRepair(id, repairId);
  if (!repair) {
    return NextResponse.json({ code: "not-found" }, { status: 404 });
  }

  const { details, status, plannedFor, doneOn, mileageKm, costChf } = parsed.data;

  /**
   * The completion date, decided by the same function the create path uses.
   *
   * It returns `undefined` for "leave this column alone", which is why the
   * spread below tests against `undefined` rather than truthiness — `null` is
   * a value here, and means the office cleared the date.
   */
  const resolvedDoneOn = resolveDoneOn({
    status,
    currentStatus: repair.status,
    doneOn,
    today: zurichDayString(new Date()),
  });

  const updated = await prisma.carRepair.update({
    where: { id: repair.id },
    data: {
      ...(details !== undefined && { details }),
      ...(status !== undefined && { status }),
      ...(plannedFor !== undefined && {
        plannedFor: plannedFor ? new Date(`${plannedFor}T00:00:00.000Z`) : null,
      }),
      ...(resolvedDoneOn !== undefined && { doneOn: resolvedDoneOn }),
      ...(mileageKm !== undefined && { mileageKm }),
      ...(costChf !== undefined && { costCents: costChf }),
    },
    select: {
      id: true,
      status: true,
      details: true,
      plannedFor: true,
      doneOn: true,
      mileageKm: true,
      costCents: true,
      createdBy: true,
      createdAt: true,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; repairId: string }> }
) {
  const user = await requireAdmin(request);
  if (!user) {
    return NextResponse.json({ code: "unauthorised" }, { status: 401 });
  }

  const { id, repairId } = await params;

  const repair = await findRepair(id, repairId);
  if (!repair) {
    return NextResponse.json({ code: "not-found" }, { status: 404 });
  }

  try {
    await prisma.carRepair.delete({ where: { id: repair.id } });
  } catch (error) {
    // P2025 — somebody deleted it between the lookup and the delete, on
    // another tab or another phone. The caller wanted it gone and it is gone.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === "P2025"
    ) {
      return NextResponse.json({ ok: true });
    }
    console.error("[admin] could not delete the repair:", error);
    return NextResponse.json({ code: "failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
