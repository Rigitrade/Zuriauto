import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { statusChangeAllowed, updateCarSchema } from "@/lib/admin/cars";
import { requestIsAdmin } from "@/lib/admin/session";

/**
 * Editing a car, or taking it off the road.
 *
 * There is no DELETE, deliberately. A car with rentals against it cannot be
 * removed: `driverAt` reaches back through `Rental` to attribute traffic fines,
 * and a contract naming a plate that no longer exists is a broken commercial
 * record. Retiring hides it from the picker and keeps every row pointing at it.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!requestIsAdmin(request)) {
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
