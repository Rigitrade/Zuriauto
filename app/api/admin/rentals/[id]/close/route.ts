import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/session";

/**
 * Marking a rental finished and returning its car to the fleet.
 *
 * An administrative override, and labelled as one. This is NOT the return
 * protocol: the return wizard records mileage, fuel level, damage and a
 * signature, and produces a document. This exists because until now the only
 * way to free a car that had come back was hand-written SQL, which the office
 * cannot be asked to run.
 *
 * Both rows move in one transaction. Half of this — a completed rental whose
 * car is still `rented`, or a freed car whose rental is still active — is worse
 * than neither, because the second is the state that lets the picker offer a
 * car somebody is driving.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin(request);
  if (!user) {
    return NextResponse.json({ code: "unauthorised" }, { status: 401 });
  }

  const { id } = await params;

  const rental = await prisma.rental.findUnique({
    where: { id },
    select: { id: true, status: true, carId: true },
  });
  if (!rental) {
    return NextResponse.json({ code: "not-found" }, { status: 404 });
  }
  if (rental.status === "COMPLETED" || rental.status === "CANCELLED") {
    // Idempotency by refusal rather than by silence: a second click should say
    // so, not report success for work it did not do.
    return NextResponse.json(
      { code: "already-closed", status: rental.status },
      { status: 409 }
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.rental.update({
      where: { id: rental.id },
      data: { status: "COMPLETED" },
    });
    await tx.car.update({
      where: { id: rental.carId },
      data: { status: "available" },
    });
    await tx.rentalEvent.create({
      data: {
        rentalId: rental.id,
        // `manual` on purpose: a later reconciliation has to be able to tell an
        // override from a rental closed by the return flow.
        type: "rental.closed.manual",
        payload: { closedBy: user.username, closedByName: user.displayName },
      },
    });
  });

  return NextResponse.json({ ok: true, rentalId: rental.id });
}
