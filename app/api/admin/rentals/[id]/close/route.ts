import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/session";
import { closeRental, RentalAlreadyClosed } from "@/lib/rental/closeRental";

/**
 * Marking a rental finished and returning its car to the fleet.
 *
 * An administrative override, and labelled as one. This is NOT the return
 * protocol: the return wizard records mileage, fuel level, damage and a
 * signature, produces a document, and since 2026-09-30 closes the rental by
 * itself. This is for a car that came back without one — and for returns
 * submitted before that change, which are still waiting here.
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
    select: {
      id: true,
      status: true,
      carId: true,
      organisationId: true,
      // The return protocol's settlement, if the renter submitted one.
      contracts: {
        where: { kind: "RETURN_ADDENDUM" },
        orderBy: { signedAt: "desc" },
        take: 1,
        select: { hasDuePayment: true, dueAmountCents: true, dueDate: true },
      },
    },
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

  // A return submitted before returns closed their own rentals is still
  // waiting here, and its declared balance is raised on this close. See
  // lib/rental/closeRental.ts.
  const settlement = rental.contracts[0];

  try {
    await prisma.$transaction((tx) =>
      closeRental(tx, {
        organisationId: rental.organisationId,
        rentalId: rental.id,
        carId: rental.carId,
        fromStatuses: ["ACTIVE", "EXTENSION_REQUESTED", "RETURN_SUBMITTED"],
        settlement:
          settlement?.hasDuePayment && settlement.dueAmountCents
            ? { amountCents: settlement.dueAmountCents, dueDate: settlement.dueDate }
            : null,
        event: {
          // `manual` on purpose: a later reconciliation has to be able to tell
          // an override from a rental closed by the return flow.
          type: "rental.closed.manual",
          payload: { closedBy: user.username, closedByName: user.displayName },
        },
        now: new Date(),
      })
    );
  } catch (error) {
    // Closed between the read above and this write — by a second click, or by
    // the renter's return landing in the same moment.
    if (error instanceof RentalAlreadyClosed) {
      return NextResponse.json({ code: "already-closed" }, { status: 409 });
    }
    throw error;
  }

  return NextResponse.json({ ok: true, rentalId: rental.id });
}
