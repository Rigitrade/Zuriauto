import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { statusChangeAllowed, updateCarSchema } from "@/lib/admin/cars";
import { requireAdmin } from "@/lib/admin/session";

/**
 * Editing a car, retiring it, or removing it.
 *
 * Deletion is available only for a car with no rental history — typically one
 * just added by mistake. Anything with a rental stays and is retired instead
 * via PATCH: every contract naming the car points at this row, so deleting one
 * would break the traffic-fine lookup — "who was driving ZH 589 864 on the
 * 12th" — and orphan signed documents under a ten-year retention obligation.
 * Retiring hides it from the picker and keeps every row pointing at it.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin(request);
  if (!user) {
    return NextResponse.json({ code: "unauthorised" }, { status: 401 });
  }

  const { id } = await params;

  let parsed;
  try {
    parsed = updateCarSchema.safeParse(await request.json());
  } catch {
    return NextResponse.json({ code: "bad-request" }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json(
      { code: "invalid", issues: parsed.error.issues.map((i) => i.message) },
      { status: 400 }
    );
  }

  const car = await prisma.car.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!car) {
    return NextResponse.json({ code: "not-found" }, { status: 404 });
  }

  const { status } = parsed.data;
  if (status && !statusChangeAllowed(car.status, status)) {
    // The case this exists for: a rented car. Freeing it here would leave a
    // rental saying someone is driving it while the picker offers it to the
    // next customer. It is freed by closing the rental instead.
    return NextResponse.json(
      { code: "status-change-refused", from: car.status, to: status },
      { status: 409 }
    );
  }

  try {
    const updated = await prisma.car.update({
      where: { id },
      data: {
        // Only what was sent. `slug` is absent on purpose: it is what the
        // pickup form submits as `vehicleId`, so it has to survive an edit
        // that corrects a plate.
        ...(parsed.data.model !== undefined && { model: parsed.data.model }),
        ...(parsed.data.plate !== undefined && { plate: parsed.data.plate }),
        ...(parsed.data.vin !== undefined && { vin: parsed.data.vin || null }),
        ...(status !== undefined && { status }),
      },
      select: { id: true, slug: true, model: true, plate: true, vin: true, status: true },
    });
    return NextResponse.json(updated);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === "P2002"
    ) {
      return NextResponse.json({ code: "duplicate-plate" }, { status: 409 });
    }
    console.error("[admin] could not update the car:", error);
    return NextResponse.json({ code: "failed" }, { status: 500 });
  }
}

/**
 * Removing a car, narrowly.
 *
 * Only a car with no rentals, which in practice means one somebody has just
 * mistyped. Anything with history stays: every rental and every contract
 * naming it points at this row, so deleting one would break the traffic-fine
 * lookup — "who was driving ZH 589 864 on the 12th" — and orphan signed
 * documents under a ten-year retention obligation.
 *
 * `retired` is the delete that is safe, and it is what the 409 points at.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin(request);
  if (!user) {
    return NextResponse.json({ code: "unauthorised" }, { status: 401 });
  }

  const { id } = await params;

  const car = await prisma.car.findUnique({
    where: { id },
    select: { id: true, _count: { select: { rentals: true } } },
  });
  if (!car) {
    return NextResponse.json({ code: "not-found" }, { status: 404 });
  }

  if (car._count.rentals > 0) {
    return NextResponse.json({ code: "has-history" }, { status: 409 });
  }

  await prisma.car.delete({ where: { id: car.id } });
  return NextResponse.json({ ok: true });
}
