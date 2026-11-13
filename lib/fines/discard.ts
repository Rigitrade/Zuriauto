/**
 * Deleting a letter the office uploaded, so the same scan can go in again.
 *
 * The upload refuses a scan it already has, so a letter whose reading went
 * wrong — stuck, failed, or read into a fine nobody can use — blocked its own
 * second try (Stadtpolizei Zürich letter, 13.11.2026). This takes it out.
 *
 * Only what nobody outside the office has seen. A letter not yet attached to
 * a fine goes on its own. A letter that became a fine takes the fine with
 * it, but only while that fine is still waiting for the office: no email
 * sent to anyone, no driver named, nothing paid, no proof, and no second
 * letter (a reminder) on it. Anything else is the fine's history, corrected
 * or voided on the fine itself.
 *
 * A reading in progress is left alone: its run would otherwise write into a
 * letter that is no longer there. A claim older than STALE_CLAIM_MS belongs
 * to a run that died, as everywhere else.
 *
 * The rows go first and the stored file after, so a failed removal leaves
 * bytes behind rather than a row pointing at nothing — and the scan can be
 * uploaded again either way, under a new key.
 */

import type { PrismaClient } from "@/generated/prisma/client";
import type { AssetStore } from "@/lib/storage";
import { STALE_CLAIM_MS } from "./process";

export type DiscardOutcome =
  | { ok: true; fineDeleted: boolean }
  | { ok: false; code: "not-found" | "busy" | "has-history" };

type Removed = { ok: true; fineDeleted: boolean; storageKey: string };

export async function discardLetter(
  client: PrismaClient,
  store: AssetStore,
  documentId: string,
  now: Date = new Date()
): Promise<DiscardOutcome> {
  const outcome = await client.$transaction(async (tx): Promise<Removed | DiscardOutcome> => {
    const document = await tx.fineDocument.findUnique({
      where: { id: documentId },
      select: { id: true, status: true, claimedAt: true, storageKey: true, fineId: true },
    });
    if (!document) return { ok: false, code: "not-found" };

    const reading =
      document.status === "PROCESSING" &&
      document.claimedAt !== null &&
      now.getTime() - document.claimedAt.getTime() < STALE_CLAIM_MS;
    if (reading) return { ok: false, code: "busy" };

    if (!document.fineId) {
      await tx.fineDocument.delete({ where: { id: document.id } });
      return { ok: true, fineDeleted: false, storageKey: document.storageKey };
    }

    const fineId = document.fineId;
    const fine = await tx.fine.findUniqueOrThrow({
      where: { id: fineId },
      select: {
        status: true,
        notifiedAt: true,
        driverNamedAt: true,
        paidAt: true,
        _count: { select: { documents: true, proofs: true } },
        // The office's own alerts and digest do not count: only the office
        // saw those.
        notifications: {
          where: { sentAt: { not: null }, kind: { notIn: ["OFFICE_ALERT", "OFFICE_DIGEST"] } },
          select: { id: true },
          take: 1,
        },
      },
    });
    const untouched =
      fine.status === "NEEDS_REVIEW" &&
      fine.notifiedAt === null &&
      fine.driverNamedAt === null &&
      fine.paidAt === null &&
      fine._count.documents === 1 &&
      fine._count.proofs === 0 &&
      fine.notifications.length === 0;
    if (!untouched) return { ok: false, code: "has-history" };

    // Unsent notifications only (a send that failed), and tokens a notice
    // never carried out: what is left of a fine nobody received.
    await tx.fineNotification.deleteMany({ where: { fineId } });
    await tx.fineEvent.deleteMany({ where: { fineId } });
    await tx.actionToken.deleteMany({ where: { fineId } });
    await tx.fineDocument.delete({ where: { id: document.id } });
    await tx.fine.delete({ where: { id: fineId } });
    return { ok: true, fineDeleted: true, storageKey: document.storageKey };
  });

  if (!outcome.ok) return outcome;
  const { storageKey, fineDeleted } = outcome as Removed;
  await store.remove(storageKey).catch((error) => {
    console.error(`[fines] letter ${documentId} deleted, but its file ${storageKey} was not:`, error);
  });
  return { ok: true, fineDeleted };
}
