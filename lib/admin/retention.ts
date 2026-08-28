import type { PrismaClient } from "@/generated/prisma/client";
import type { AssetStore } from "@/lib/storage";

/**
 * Enforcing docs/DATA-RETENTION.md.
 *
 * That document has said, since 22 August 2026, that identity photographs are
 * held for five years and contracts for ten — and then ended with the line
 * "No deletion job exists yet. Until one ships, deletion is manual and the
 * clock is documented rather than enforced." This is that job.
 *
 * Two periods, and the ten-year one wins where they meet:
 *
 *  - **Five years, everything about the person.** Identity and licence
 *    photographs, the portrait, the signature image, condition and damage
 *    photographs. These are `Asset` rows, and they are what this sweep
 *    deletes.
 *  - **Ten years, the contract PDF and the rental records**, matching the
 *    Swiss commercial obligation under OR 958f. Those are `Contract.pdfKey`
 *    and the rows themselves, and this sweep does not touch them. Nothing is
 *    ten years old yet; when something is, it needs its own pass and a
 *    decision about what a contract PDF minus its images is worth.
 *
 * The clock runs from the **rental's end**, not from the upload. And because
 * document reuse *copies* rather than shares — each new contract gets its own
 * object on its own row — a regular customer's documents live five years past
 * their last rental without this function needing to know anything about
 * customers. That behaviour is documented in DATA-RETENTION.md as a
 * consequence; here it falls out of the data model.
 */

/** Everything about the person. */
export const PERSON_RETENTION_YEARS = 5;

/** The contract PDF and the rental records, OR 958f. Not swept yet. */
export const RECORD_RETENTION_YEARS = 10;

/** How many assets one run will delete. A daily job that cannot finish is
 *  worse than a slow one; this bounds the work and the next run continues. */
export const SWEEP_LIMIT = 200;

export function retentionCutoff(now: Date, years: number): Date {
  const cutoff = new Date(now);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - years);
  return cutoff;
}

export interface RetentionCandidate {
  /** When the rental this asset belongs to ended. Null while it is running. */
  rentalEndAt: Date | null;
  deletedAt: Date | null;
}

/**
 * Whether an asset's bytes may go.
 *
 * Strictly before the cutoff: five years to the day is still inside five
 * years, and of the two ways to be wrong, deleting early is the one that
 * destroys evidence the office is obliged to hold.
 */
export function isDueForDeletion(
  candidate: RetentionCandidate,
  cutoff: Date
): boolean {
  if (candidate.deletedAt) return false;
  // A rental still running has no clock to be past. Reading null as "long ago"
  // would delete the documents of a car that is out right now.
  if (!candidate.rentalEndAt) return false;
  return candidate.rentalEndAt.getTime() < cutoff.getTime();
}

export interface SweepResult {
  considered: number;
  deleted: number;
  /** Keys the store refused. The rows stay undeleted so the next run retries. */
  failed: number;
}

/**
 * Deletes the bytes of every person-asset past its five years.
 *
 * Order matters and is deliberate: **the object goes first, the row is
 * stamped second.** The reverse would let a crash between the two leave a row
 * marked deleted whose passport scan is still in the bucket — a lie in the
 * one direction that matters, and one nothing would ever revisit, because the
 * sweep skips rows that are already stamped.
 *
 * This way a crash leaves a deleted object and an unstamped row: the next run
 * deletes an absent key, which `remove` is idempotent about, and stamps it.
 */
export async function sweepExpiredAssets(
  client: PrismaClient,
  store: AssetStore,
  now: Date = new Date()
): Promise<SweepResult> {
  const cutoff = retentionCutoff(now, PERSON_RETENTION_YEARS);

  const candidates = await client.asset.findMany({
    where: {
      deletedAt: null,
      contract: { rental: { endAt: { lt: cutoff } } },
    },
    orderBy: { createdAt: "asc" },
    take: SWEEP_LIMIT,
    select: { id: true, storageKey: true },
  });

  let deleted = 0;
  let failed = 0;

  for (const asset of candidates) {
    try {
      await store.remove(asset.storageKey);
      await client.asset.update({
        where: { id: asset.id },
        data: { deletedAt: now },
      });
      deleted += 1;
    } catch (error) {
      // One unreachable object must not stop the rest of the sweep. Left
      // unstamped, so tomorrow's run tries again rather than the row quietly
      // becoming permanent.
      failed += 1;
      console.error(`[retention] could not delete ${asset.storageKey}:`, error);
    }
  }

  return { considered: candidates.length, deleted, failed };
}
