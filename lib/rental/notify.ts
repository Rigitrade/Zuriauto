/**
 * Deciding to send, exactly once.
 *
 * The unique constraint on `[rentalId, kind, dedupeKey]` is the idempotency —
 * not a boolean flag. `claimSend` inserts the row *before* anything is sent, so
 * two concurrent scheduler runs race on the insert and exactly one wins. The
 * loser gets a unique violation and moves on.
 *
 * A `reminderSent: boolean` set after the send, which is what the client
 * originally proposed, cannot do this: both runs read false, both send, and
 * both then set it to true.
 *
 * The consequence is that a claimed send whose delivery then fails must not be
 * silently lost — the row exists and blocks a fresh claim. So delivery state
 * lives in separate columns (`sentAt`, `error`, `attempts`) and `mailRetryPass`
 * picks the failures up. The dedupe key guards the *decision*; the columns
 * record the *outcome*.
 */

import type {
  NotificationKind,
  PrismaClient,
} from "@/generated/prisma/client";
import { zurichDayString } from "./passes";

/** Prisma's code for a unique-constraint violation. */
const UNIQUE_VIOLATION = "P2002";

export interface ClaimedSend {
  id: string;
  to: string;
}

/**
 * Reserves the right to send this exact message, or returns null.
 *
 * Null means somebody else already claimed it — a previous run, or a
 * simultaneous one. It is a normal outcome, not an error.
 */
export async function claimSend(
  client: PrismaClient,
  input: {
    organisationId: string;
    rentalId: string;
    kind: NotificationKind;
    dedupeKey: string;
    to: string;
  }
): Promise<ClaimedSend | null> {
  try {
    const row = await client.notification.create({
      data: input,
      select: { id: true, to: true },
    });
    return row;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      (error as { code?: string }).code === UNIQUE_VIOLATION
    ) {
      return null;
    }
    throw error;
  }
}

/** Records that the message went out. */
export async function markSent(
  client: PrismaClient,
  notificationId: string,
  now: Date
): Promise<void> {
  await client.notification.update({
    where: { id: notificationId },
    data: { sentAt: now, error: null, attempts: { increment: 1 } },
  });
}

/** Records that it did not, so `mailRetryPass` can try again. */
export async function markFailed(
  client: PrismaClient,
  notificationId: string,
  error: unknown
): Promise<void> {
  await client.notification.update({
    where: { id: notificationId },
    data: {
      // Truncated: an SMTP stack trace can run to kilobytes, and the useful
      // part is always at the front.
      error: String(error).slice(0, 500),
      attempts: { increment: 1 },
    },
  });
}

/**
 * Runs a send under a claim, recording either outcome.
 *
 * Returns true only when a claim was won *and* the send succeeded, which is
 * what the passes count.
 */
export async function sendOnce(
  client: PrismaClient,
  input: {
    organisationId: string;
    rentalId: string;
    kind: NotificationKind;
    dedupeKey: string;
    to: string;
  },
  now: Date,
  send: () => Promise<void>
): Promise<boolean> {
  const claim = await claimSend(client, input);
  if (!claim) return false;

  try {
    await send();
    await markSent(client, claim.id, now);
    return true;
  } catch (error) {
    console.error(
      `[notify] ${input.kind} for rental ${input.rentalId} failed:`,
      error
    );
    await markFailed(client, claim.id, error);
    return false;
  }
}

/**
 * The dedupe key for anything keyed to a rental's agreed end.
 *
 * The Zurich calendar day, never the instant. An instant would be unique on
 * every run and would therefore dedupe nothing; the day is stable across runs
 * and changes when an extension moves `endAt`, which is exactly when a fresh
 * reminder *should* be allowed.
 */
export function endAtDedupeKey(endAt: Date): string {
  return zurichDayString(endAt);
}

/** The dedupe key for anything keyed to a weekly charge. */
export function weekDedupeKey(weekNumber: number): string {
  return `week-${weekNumber}`;
}
