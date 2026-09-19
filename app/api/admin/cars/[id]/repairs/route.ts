import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { newRepairSchema, resolveDoneOn } from "@/lib/admin/cars";
import { requireAdmin } from "@/lib/admin/session";
import { zurichDayString } from "@/lib/rental/passes";

/**
 * Recording a repair against a car — planned, or already carried out.
 *
 * Listing is deliberately absent. The fleet screen already fetches every car
 * from `/api/admin/overview/`, and that endpoint carries each car's repairs
 * with it: a screen that shows ten cars would otherwise make ten more requests
 * to fill in two lines each.
 *
 * Owner and staff alike. Noting that a windscreen needs replacing is the daily
 * work of whoever is at the desk, and making them fetch an owner would mean
 * the note never gets written down.
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

  let parsed;
  try {
    parsed = newRepairSchema.safeParse(await request.json());
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
    select: { id: true, organisationId: true },
  });
  if (!car) {
    return NextResponse.json({ code: "not-found" }, { status: 404 });
  }

  const { details, status, plannedFor, doneOn, mileageKm, costChf } = parsed.data;

  /**
   * A repair entered as already done, with no date, is dated today.
   *
   * The same rule the edit path applies, through the same function, so "mark
   * done" and "add, already done" cannot drift into dating things
   * differently. `currentStatus: "planned"` because nothing exists yet — this
   * row is becoming whatever it is being created as.
   */
  const resolvedDoneOn = resolveDoneOn({
    status,
    currentStatus: "planned",
    doneOn,
    today: zurichDayString(new Date()),
  });

  const repair = await prisma.carRepair.create({
    data: {
      organisationId: car.organisationId,
      carId: car.id,
      status,
      details,
      plannedFor: plannedFor ? new Date(`${plannedFor}T00:00:00.000Z`) : null,
      doneOn: resolvedDoneOn ?? null,
      mileageKm: mileageKm ?? null,
      costCents: costChf ?? null,
      // The username rather than the display name — two people can be called
      // "Ahmed", and this has to keep resolving after an account is disabled.
      createdBy: user.username,
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

  return NextResponse.json(repair, { status: 201 });
}
