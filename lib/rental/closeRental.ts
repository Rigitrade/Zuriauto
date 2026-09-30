/**
 * Ending a rental and putting its car back in the picker.
 *
 * One implementation for the two ways a rental ends: the renter's own return
 * form (`persistReturn`), and the office's close button in /admin. They used to
 * be one path — every return waited for the office — and from the owner's
 * decision of 2026-09-30 a submitted return closes the rental itself. Two
 * copies of "complete, free, raise what is owed" would drift apart, and the
 * drift would be a car that is free while its rental is still open.
 *
 * Runs inside the caller's transaction. The rental moves first, conditionally,
 * with the allowed statuses repeated in the WHERE: two submissions, or a
 * submission racing a click, can both read an open rental, and only one of
 * them may close it. The loser throws, which rolls its whole transaction back
 * — addendum, signature rows and all — rather than leaving a second return
 * document hanging off a rental somebody else already closed.
 */

import type { Prisma } from "@/generated/prisma/client";

/** The event a return writes when it closes its own rental. The scheduler
 *  keys on it to keep chasing weeks already driven — see isOwedAfterReturn. */
export const RETURN_CLOSE_EVENT = "rental.closed.return";

/** Thrown when the rental was no longer in a status this close accepts. */
export class RentalAlreadyClosed extends Error {
  constructor(rentalId: string) {
    super(`Rental ${rentalId} was already closed.`);
    this.name = "RentalAlreadyClosed";
  }
}

export interface CloseRentalInput {
  organisationId: string;
  rentalId: string;
  carId: string;
  /** Statuses the rental may be closed from. */
  fromStatuses: readonly ("ACTIVE" | "EXTENSION_REQUESTED" | "RETURN_SUBMITTED")[];
  /** What the renter declared still owing at the return, if anything. */
  settlement: { amountCents: number; dueDate: Date | null } | null;
  /** `rental.closed.return` or `rental.closed.manual`, so a reconciliation
   *  can tell the two apart. */
  event: { type: string; payload: Record<string, unknown> };
  now: Date;
}

export async function closeRental(
  tx: Prisma.TransactionClient,
  input: CloseRentalInput
): Promise<{ settlementCents: number | null }> {
  const moved = await tx.rental.updateMany({
    where: { id: input.rentalId, status: { in: [...input.fromStatuses] } },
    data: { status: "COMPLETED" },
  });
  if (moved.count === 0) throw new RentalAlreadyClosed(input.rentalId);

  /**
   * The balance the renter declared becomes something the system will chase.
   *
   * weekNumber 0 because the weekly schedule is 1-based: a settlement is not
   * week zero of anything, and the number keeps it out of that sequence while
   * @@unique([rentalId, weekNumber]) makes a retry idempotent rather than
   * billing twice.
   */
  const owed =
    input.settlement && input.settlement.amountCents > 0
      ? input.settlement
      : null;
  if (owed) {
    await tx.charge.createMany({
      data: [
        {
          organisationId: input.organisationId,
          rentalId: input.rentalId,
          weekNumber: 0,
          // No date given means it is owed now, not never.
          dueDate: owed.dueDate ?? input.now,
          amountCents: owed.amountCents,
        },
      ],
      skipDuplicates: true,
    });
  }

  await tx.car.update({
    where: { id: input.carId },
    data: { status: "available" },
  });

  await tx.rentalEvent.create({
    data: {
      rentalId: input.rentalId,
      type: input.event.type,
      // The caller's clock, not the database's: for a return this is the
      // moment the car came back, which decides the weeks still owed.
      createdAt: input.now,
      payload: {
        ...input.event.payload,
        settlementCents: owed?.amountCents ?? null,
      } as Prisma.InputJsonValue,
    },
  });

  return { settlementCents: owed?.amountCents ?? null };
}
