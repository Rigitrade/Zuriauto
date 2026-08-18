import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { FleetVehicle } from "@/lib/rental/fleet";

/**
 * The vehicles the picker may offer.
 *
 * Reads the table, so taking a car off the road is a status change rather than
 * a deploy. Only `available` cars are returned: a customer must never be able
 * to sign a contract naming a car that is in the garage, so unavailable ones
 * are omitted rather than shown disabled — exactly as the fleet file already
 * filters placeholders.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const cars = await prisma.car.findMany({
    where: { status: "available" },
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
