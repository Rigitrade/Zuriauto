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
    // `currentMileageKm` comes back so the read stamp can be moved only when
    // the reading actually changes — see the note where it is written.
    select: { id: true, status: true, currentMileageKm: true },
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
        ...(parsed.data.mfkDate !== undefined && {
          mfkDate: parsed.data.mfkDate
            ? new Date(`${parsed.data.mfkDate}T00:00:00.000Z`)
            : null,
        }),
        ...(status !== undefined && { status }),

        // The service book. Each figure independently optional, because the
        // office learns them one at a time — the odometer at every handover,
        // the due reading once a year off a garage's sticker.
        ...(parsed.data.currentMileageKm !== undefined && {
          currentMileageKm: parsed.data.currentMileageKm,
          /**
           * The read stamp, moved only when the reading itself moved.
           *
           * Stamped by the server and never accepted from the client: the
           * whole value of this column is that it says when somebody actually
           * looked at the dashboard, and a browser that could set it could
           * claim a figure from March was read this morning.
           *
           * Compared against what is stored, because the maintenance dialog
           * posts every field it holds. Re-saving it to correct the MFK date
           * would otherwise re-date an untouched odometer reading to today —
           * which is precisely the lie this column exists to prevent.
           *
           * Cleared alongside the figure: a read time with no reading
           * describes nothing.
           */
          ...(parsed.data.currentMileageKm !== car.currentMileageKm && {
            mileageReadAt:
              parsed.data.currentMileageKm === null ? null : new Date(),
          }),
        }),
        ...(parsed.data.serviceDoneKm !== undefined && {
          serviceDoneKm: parsed.data.serviceDoneKm,
        }),
        ...(parsed.data.serviceDueKm !== undefined && {
          serviceDueKm: parsed.data.serviceDueKm,
        }),
        ...(parsed.data.serviceDoneOn !== undefined && {
          serviceDoneOn: parsed.data.serviceDoneOn
            ? new Date(`${parsed.data.serviceDoneOn}T00:00:00.000Z`)
            : null,
        }),
      },
      select: {
        id: true,
        slug: true,
        model: true,
        plate: true,
        vin: true,
        status: true,
        mfkDate: true,
        currentMileageKm: true,
        mileageReadAt: true,
        serviceDoneKm: true,
        serviceDoneOn: true,
        serviceDueKm: true,
      },
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

  try {
    await prisma.car.delete({ where: { id: car.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    // The count and delete are separate statements. If a rental is created
    // between them, the foreign key rejects the delete. Catch it to return
    // the correct 409 instead of a 500 — the foreign key is the backstop that
    // makes it a status-code issue, not a data-loss one.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === "P2003"
    ) {
      return NextResponse.json({ code: "has-history" }, { status: 409 });
    }
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === "P2025"
    ) {
      return NextResponse.json({ code: "not-found" }, { status: 404 });
    }
    console.error("[admin] could not delete the car:", error);
    return NextResponse.json({ code: "failed" }, { status: 500 });
  }
}
