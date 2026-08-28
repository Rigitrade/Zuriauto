import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/session";

/**
 * Marking a rental finished and returning its car to the fleet.
 *
 * An administrative override, and labelled as one. This is NOT the return
 * protocol: the return wizard records mileage, fuel level, damage and a
 * signature, and produces a document. This exists because until now the only
 * way to free a car that had come back was hand-written SQL, which the office
 * cannot be asked to run.
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

  const settlement = rental.contracts[0];
  const owed =
    settlement?.hasDuePayment && settlement.dueAmountCents
      ? settlement.dueAmountCents
      : null;

  await prisma.$transaction(async (tx) => {
    /**
     * The balance the renter declared becomes something the system will chase.
     *
     * Before this, "I still owe 200 francs, due the 30th" was text inside a
     * PDF: no Charge row, so the scheduler never reminded anybody and the
     * office never got an alert. The money simply depended on somebody
     * remembering.
     *
     * Raised here rather than in persistReturn on purpose. The office reads
     * the figure in the review modal first, so nobody is chased over a number
     * a customer typed and no one checked — confirming the return *is* the
     * check.
     *
     * weekNumber 0 because the weekly schedule is 1-based: a settlement is not
     * week zero of anything, and the number keeps it out of that sequence
     * while @@unique([rentalId, weekNumber]) makes a retried close idempotent
     * rather than billing twice.
     */
    if (owed !== null) {
      await tx.charge.createMany({
        data: [
          {
            organisationId: rental.organisationId,
            rentalId: rental.id,
            weekNumber: 0,
            // No date given means it is owed now, not never.
            dueDate: settlement?.dueDate ?? new Date(),
            amountCents: owed,
          },
        ],
        skipDuplicates: true,
      });
    }

    await tx.rental.update({
      where: { id: rental.id },
      data: { status: "COMPLETED" },
    });
    await tx.car.update({
      where: { id: rental.carId },
      data: { status: "available" },
    });
    await tx.rentalEvent.create({
      data: {
        rentalId: rental.id,
        // `manual` on purpose: a later reconciliation has to be able to tell an
        // override from a rental closed by the return flow.
        type: "rental.closed.manual",
        payload: {
          closedBy: user.username,
          closedByName: user.displayName,
          // On the event, so a later reconciliation can see the charge was
          // raised by this close rather than by the weekly schedule.
          settlementCents: owed,
        },
      },
    });
  });

  return NextResponse.json({ ok: true, rentalId: rental.id });
}
