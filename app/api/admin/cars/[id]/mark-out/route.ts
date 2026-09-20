import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/session";
import {
  MARKED_OUT_BY,
  markOutPeriod,
  markOutSchema,
  splitRenterName,
} from "@/lib/admin/markOut";
import {
  UNKNOWN_BIRTH_DATE,
  placeholderEmail,
} from "@/lib/rental/placeholder";

/**
 * Records that a car is out, when no contract says so.
 *
 * Cars left the yard before this system existed and on paper after it, and
 * the office cannot record their return. The return form lists cars whose
 * status is `rented`, and `persistReturn` then looks for an open rental to
 * attach the protocol to. A car with neither is missing from the first — the
 * complaint that prompted this — and merely flipping its status would be
 * worse than useless: it would appear in the picker, the renter would sign a
 * return protocol and be emailed a PDF, and `persistReturn` would answer
 * `no-open-rental` and write nothing. A handover that looks recorded and is
 * not is the one outcome to avoid.
 *
 * So this writes the missing rental. Thin on purpose: `ACTIVE`, no contract,
 * no money, a placeholder renter. The same shape the legacy import produces
 * for a return protocol whose pickup was never supplied — the identical
 * problem arriving from the other end.
 *
 * Staff as well as owners. A car is standing in the yard and somebody wants to
 * hand it back; fetching an owner to permit it would mean the return goes
 * unrecorded, which is what this exists to stop.
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

  const body = await request.json().catch(() => null);
  const parsed = markOutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { code: parsed.error.issues[0]?.message ?? "invalid" },
      { status: 400 }
    );
  }

  const period = markOutPeriod(parsed.data, new Date());
  if (!period.ok) {
    return NextResponse.json({ code: period.reason }, { status: 400 });
  }

  const car = await prisma.car.findUnique({
    where: { id },
    select: { id: true, organisationId: true, status: true, plate: true },
  });
  if (!car) {
    return NextResponse.json({ code: "not-found" }, { status: 404 });
  }

  // Only a car the fleet believes is free. Marking out one that is already
  // rented would create a second open rental for it, and `persistReturn`
  // resolves the newest — so the next return would close the wrong one and
  // leave the real rental open forever.
  if (car.status !== "available") {
    return NextResponse.json({ code: "not-available" }, { status: 409 });
  }

  // Belt and braces against the status column having drifted from reality.
  // The status check above should already cover it; this one is the invariant
  // that actually matters, so it is checked rather than assumed.
  const open = await prisma.rental.findFirst({
    where: {
      carId: car.id,
      status: { notIn: ["COMPLETED", "CANCELLED"] },
    },
    select: { id: true },
  });
  if (open) {
    return NextResponse.json({ code: "already-out" }, { status: 409 });
  }

  const { firstName, lastName } = splitRenterName(parsed.data.renterName);

  const rental = await prisma.$transaction(async (tx) => {
    /**
     * A customer row per marked-out car, never a shared one.
     *
     * The unique index is on the address, so one shared "unknown renter" would
     * mean every unrecorded rental pointed at the same row — and the office
     * filling in the real name on one would rename all of them at once.
     *
     * Every field the schema insists on, and nothing invented. The address and
     * phone stay empty, the birth date is the visible 1900 sentinel, and the
     * email cannot be delivered anywhere. See lib/rental/placeholder.ts.
     */
    const customer = await tx.customer.create({
      data: {
        organisationId: car.organisationId,
        firstName,
        lastName,
        email: placeholderEmail(randomUUID()),
        phone: "",
        birthDate: UNKNOWN_BIRTH_DATE,
        street: "",
        postalCode: "",
        city: "",
        country: "",
      },
      select: { id: true },
    });

    const created = await tx.rental.create({
      data: {
        organisationId: car.organisationId,
        carId: car.id,
        customerId: customer.id,
        createdBy: MARKED_OUT_BY,
        // FIXED_TERM, because WEEKLY would imply a weekly amount, a number of
        // weeks and a billing weekday that no document states — and the charge
        // pass would then raise invoices against a renter nobody has recorded.
        type: "FIXED_TERM",
        status: "ACTIVE",
        startAt: period.startAt,
        endAt: period.endAt,
        totalAmountCents: null,
      },
      select: { id: true },
    });

    await tx.car.update({
      where: { id: car.id },
      data: { status: "rented" },
    });

    await tx.rentalEvent.create({
      data: {
        rentalId: created.id,
        type: "rental.marked-out",
        payload: {
          by: user.username,
          at: new Date().toISOString(),
          plate: car.plate,
          renterName: lastName || null,
          reason: "Car was already out; no pickup contract exists.",
        },
      },
    });

    return created;
  });

  return NextResponse.json({ ok: true, rentalId: rental.id });
}
