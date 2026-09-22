import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { statusChangeAllowed, updateCarSchema } from "@/lib/admin/cars";
import { MARKED_OUT_BY } from "@/lib/admin/markOut";
import { requireAdmin } from "@/lib/admin/session";
import { isPlaceholderEmail } from "@/lib/rental/placeholder";

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
        ...(parsed.data.colour !== undefined && {
          colour: parsed.data.colour || null,
        }),
        ...(parsed.data.mfkDate !== undefined && {
          mfkDate: parsed.data.mfkDate
            ? new Date(`${parsed.data.mfkDate}T00:00:00.000Z`)
            : null,
        }),
        // The inspection that already happened. Independently optional from
        // the one that is due: the office types the next date off the
        // certificate the day it arrives, and fills the previous one in later
        // from the file.
        ...(parsed.data.mfkLastDate !== undefined && {
          mfkLastDate: parsed.data.mfkLastDate
            ? new Date(`${parsed.data.mfkLastDate}T00:00:00.000Z`)
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
    select: {
      id: true,
      rentals: {
        select: {
          id: true,
          createdBy: true,
          customerId: true,
          _count: { select: { contracts: true } },
        },
      },
    },
  });
  if (!car) {
    return NextResponse.json({ code: "not-found" }, { status: 404 });
  }

  /**
   * A rental the office wrote by hand and nobody ever signed is not history.
   *
   * `has-history` protects the question this whole table exists to answer —
   * who was driving ZH 589 864 on the 12th — and a signed contract is what
   * makes that answerable. A rental created by the "mark as rented out"
   * button carries no contract, no charge and a placeholder renter: it
   * records that somebody pressed a button, and nothing else.
   *
   * Without this the button was a one-way door. Press it on the wrong car,
   * close the rental again, and the car could never be deleted — the mistake
   * left a permanent mark that only said a mistake had been made. That is how
   * a test vehicle called ZH 666666 became undeletable.
   *
   * Contracts are the discriminator, not the status. A marked-out car that
   * was properly handed back has a RETURN_ADDENDUM — signed, with mileage and
   * a signature on it — and that is real history, so it keeps the car.
   */
  const disposable = car.rentals.filter(
    (rental) =>
      rental.createdBy === MARKED_OUT_BY && rental._count.contracts === 0
  );
  if (car.rentals.length > disposable.length) {
    return NextResponse.json({ code: "has-history" }, { status: 409 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      for (const rental of disposable) {
        await tx.rentalEvent.deleteMany({ where: { rentalId: rental.id } });
        await tx.rental.delete({ where: { id: rental.id } });
        // The placeholder customer exists only to satisfy the rental's
        // required relation — one per marked-out car, never shared. It goes
        // with the rental, unless something else has since been hung off it.
        const others = await tx.rental.count({
          where: { customerId: rental.customerId },
        });
        if (others === 0) {
          const customer = await tx.customer.findUnique({
            where: { id: rental.customerId },
            select: { email: true },
          });
          if (isPlaceholderEmail(customer?.email)) {
            await tx.customer.delete({ where: { id: rental.customerId } });
          }
        }
      }
      await tx.car.delete({ where: { id: car.id } });
    });
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
