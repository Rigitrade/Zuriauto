/**
 * The weeks of a closed rental that had not begun when it closed.
 *
 * The office decides, rental by rental (the ledger spec, decision 4): void
 * them, or keep them owed. Until it decides, today's rule holds — not chased,
 * not counted as owed — and the rental account shows them as pending.
 */

import type { PrismaClient } from "@/generated/prisma/client";
import type { Actor } from "@/lib/fines/events";
import { RETURN_CLOSE_EVENT } from "@/lib/rental/closeRental";
import { OPEN_CHARGE } from "./twint/decide";

export const CLOSE_EVENTS = [RETURN_CLOSE_EVENT, "rental.closed.manual"];

/** The first close event's moment, or null for a rental that never closed. */
export function closedAtOf(events: { type: string; createdAt: Date }[]): Date | null {
  const closes = events
    .filter((e) => CLOSE_EVENTS.includes(e.type))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return closes[0]?.createdAt ?? null;
}

/** The open weeks that had not begun at the close and nobody has decided about. */
export function pendingAfterClose(
  charges: { id: string; weekNumber: number; dueDate: Date; status: string; keptAfterReturn: boolean }[],
  closedAt: Date | null
): string[] {
  if (!closedAt) return [];
  return charges
    .filter(
      (c) =>
        c.weekNumber >= 1 &&
        !c.keptAfterReturn &&
        (OPEN_CHARGE as readonly string[]).includes(c.status) &&
        c.dueDate.getTime() >= closedAt.getTime()
    )
    .map((c) => c.id);
}

export async function decideWeeksAfterClose(
  client: PrismaClient,
  rentalId: string,
  choice: "void" | "keep",
  actor: Actor
): Promise<{ ok: true; count: number } | { ok: false; code: "conflict" | "not-found" }> {
  const rental = await client.rental.findUnique({
    where: { id: rentalId },
    select: {
      status: true,
      events: { where: { type: { in: CLOSE_EVENTS } }, select: { type: true, createdAt: true } },
      charges: { select: { id: true, weekNumber: true, dueDate: true, status: true, keptAfterReturn: true } },
    },
  });
  if (!rental) return { ok: false, code: "not-found" };
  const pending = pendingAfterClose(rental.charges, closedAtOf(rental.events));
  if (rental.status !== "COMPLETED" || pending.length === 0) return { ok: false, code: "conflict" };

  return client.$transaction(async (tx) => {
    const moved =
      choice === "void"
        ? await tx.charge.updateMany({
            where: { id: { in: pending }, status: { in: [...OPEN_CHARGE] } },
            data: { status: "VOID" },
          })
        : await tx.charge.updateMany({
            where: { id: { in: pending }, keptAfterReturn: false },
            data: { keptAfterReturn: true },
          });
    await tx.rentalEvent.create({
      data: {
        rentalId,
        type: choice === "void" ? "rental.weeks-after-close.voided" : "rental.weeks-after-close.kept",
        payload: { chargeIds: pending, actorId: actor.id, actorName: actor.displayName },
      },
    });
    return { ok: true, count: moved.count } as const;
  });
}
