/**
 * Deciding to send a message *about a car*, exactly once.
 *
 * The twin of notify.ts, and separate for a reason that is easy to miss:
 * `Notification.rentalId` is required, and a car sitting on the forecourt has
 * no rental. Making that column nullable would have looked like the smaller
 * change and would have broken the guarantee silently — Postgres treats NULLs
 * as *distinct* in a unique index, so `[NULL, kind, dedupeKey]` inserts as
 * often as it is asked to, and the office would be told about the same
 * inspection every morning with nothing in the code looking wrong.
 *
 * So: its own table, whose `[carId, kind, dedupeKey]` is genuinely unique.
 * Everything else follows notify.ts exactly — the claim is inserted before the
 * send, so two concurrent runs race on the insert and one loses.
 */

import type {
  CarNotificationKind,
  PrismaClient,
} from "@/generated/prisma/client";

/** Prisma's code for a unique-constraint violation. */
const UNIQUE_VIOLATION = "P2002";

export interface CarSendInput {
  organisationId: string;
  carId: string;
  kind: CarNotificationKind;
  dedupeKey: string;
  to: string;
}

/**
 * Runs a send under a claim, recording either outcome.
 *
 * Returns true only when a claim was won *and* the send succeeded — which is
 * what the pass counts, and what stops a failed SMTP call being reported as a
 * warning the office never got.
 */
export async function sendOnceForCar(
  client: PrismaClient,
  input: CarSendInput,
  now: Date,
  send: () => Promise<void>
): Promise<boolean> {
  let claimId: string;
  try {
    const row = await client.carNotification.create({
      data: { ...input, createdAt: now },
      select: { id: true },
    });
    claimId = row.id;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      (error as { code?: string }).code === UNIQUE_VIOLATION
    ) {
      // Somebody already claimed this one — a previous run, or a simultaneous
      // one. A normal outcome, not an error.
      return false;
    }
    throw error;
  }

  try {
    await send();
    await client.carNotification.update({
      where: { id: claimId },
      data: { sentAt: now, error: null, attempts: { increment: 1 } },
    });
    return true;
  } catch (error) {
    console.error(`[car-notify] ${input.kind} for car ${input.carId} failed:`, error);
    await client.carNotification.update({
      where: { id: claimId },
      data: {
        // Truncated for the reason notify.ts gives: an SMTP stack trace runs
        // to kilobytes and the useful part is at the front.
        error: String(error).slice(0, 500),
        attempts: { increment: 1 },
      },
    });
    return false;
  }
}

/**
 * The dedupe key for anything keyed to an inspection date.
 *
 * The date itself, `YYYY-MM-DD`, read from the UTC parts because `mfkDate` is
 * a DATE column. Stable across runs — so a second run today is silent — and
 * different once the office records the next inspection, which is exactly when
 * a fresh warning should be allowed.
 */
export function mfkDedupeKey(mfkDate: Date): string {
  const d = String(mfkDate.getUTCDate()).padStart(2, "0");
  const m = String(mfkDate.getUTCMonth() + 1).padStart(2, "0");
  return `${mfkDate.getUTCFullYear()}-${m}-${d}`;
}
