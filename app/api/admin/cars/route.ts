import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { carSlug, newCarSchema } from "@/lib/admin/cars";
import { requireAdmin } from "@/lib/admin/session";

/**
 * Adding a car to the fleet.
 *
 * The picker already reads the table — `/api/fleet/` returns whatever is
 * `available` — so a car added here is offerable at the desk immediately,
 * without a deploy. `lib/rental/fleet.ts` remains the seed's source and the
 * wizard's offline fallback, not the authority.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await requireAdmin(request);
  if (!user) {
    return NextResponse.json({ code: "unauthorised" }, { status: 401 });
  }

  let parsed;
  try {
    parsed = newCarSchema.safeParse(await request.json());
  } catch {
    return NextResponse.json({ code: "bad-request" }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json(
      { code: "invalid", issues: parsed.error.issues.map((i) => i.message) },
      { status: 400 }
    );
  }

  const organisation = await prisma.organisation.findFirst({
    select: { id: true },
  });
  if (!organisation) {
    return NextResponse.json({ code: "not-configured" }, { status: 503 });
  }

  const { model, plate, vin } = parsed.data;

  try {
    const car = await prisma.car.create({
      data: {
        organisationId: organisation.id,
        // Derived once, here. Never recomputed on edit — see lib/admin/cars.ts.
        slug: carSlug(model, plate),
        model,
        plate,
        vin: vin || null,
      },
      select: { id: true, slug: true, plate: true },
    });
    return NextResponse.json(car, { status: 201 });
  } catch (error) {
    // P2002 is the unique constraint on [organisationId, plate] or the slug.
    // Answered as a conflict rather than surfacing as a 500, so the page can
    // say "that plate is already on the fleet".
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === "P2002"
    ) {
      return NextResponse.json({ code: "duplicate-plate" }, { status: 409 });
    }
    console.error("[admin] could not add the car:", error);
    return NextResponse.json({ code: "failed" }, { status: 500 });
  }
}
