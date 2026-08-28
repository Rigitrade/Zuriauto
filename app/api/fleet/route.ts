import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { FleetVehicle } from "@/lib/rental/fleet";

/**
 * The vehicles a picker may offer.
 *
 * Reads the table, so taking a car off the road is a status change rather than
 * a deploy, and a car added through /admin is offered without one either.
 *
 * Two scopes, because the pickup form and the return form are asking opposite
 * questions:
 *
 *   default        cars that are `available` — a customer must never be able
 *                  to sign a contract naming a car that is already out or in
 *                  the garage, so the others are omitted rather than shown
 *                  disabled.
 *
 *   scope=return   cars that are `rented`. The car being handed back is by
 *                  definition not available, so offering the available list on
 *                  the return form shows every car *except* the one the
 *                  customer is standing next to. `rented` covers every rental
 *                  a return can still be recorded against — ACTIVE,
 *                  EXTENSION_REQUESTED and RETURN_SUBMITTED all leave the car
 *                  rented, the last one deliberately, until the office
 *                  confirms.
 *
 * Neither scope offers a retired car, and both read the same table, so the two
 * pickers can never disagree about what the fleet is.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const scope = new URL(request.url).searchParams.get("scope");
  // Anything unrecognised falls back to the pickup list. A typo in a query
  // string must not widen what a customer may select.
  const status = scope === "return" ? "rented" : "available";

  const cars = await prisma.car.findMany({
    where: { status },
    orderBy: { slug: "asc" },
    select: { slug: true, model: true, plate: true, vin: true },
  });

  const vehicles: FleetVehicle[] = cars.map((car) => ({
    id: car.slug,
    model: car.model,
    plate: car.plate,
    vin: car.vin ?? undefined,
  }));

  return NextResponse.json({ vehicles });
}
