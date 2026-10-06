/**
 * Fines under docs/DATA-RETENTION.md.
 *
 *  - A payment screenshot can show the renter's bank, account and balance:
 *    personal data, **five years** after the fine was closed.
 *  - The letter and the fine record are the basis of the GTC handling fee, a
 *    commercial record under OR 958f: **ten years** after closing, as the
 *    contract PDF.
 *
 * "Closed" is paid, handled otherwise or void; the clock starts at payment,
 * or at the fine's last change for the other two. An open fine is never
 * swept, however old. As in the asset sweep, the object goes before the row,
 * so a crash leaves a row pointing at nothing rather than bytes nobody will
 * ever revisit.
 */

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { PERSON_RETENTION_YEARS, RECORD_RETENTION_YEARS, retentionCutoff, SWEEP_LIMIT } from "@/lib/admin/retention";
import type { AssetStore } from "@/lib/storage";

const CLOSED = ["PAID", "HANDLED_OTHERWISE", "VOID"] as const;

function closedBefore(cutoff: Date): Prisma.FineWhereInput {
  return {
    status: { in: [...CLOSED] },
    OR: [{ paidAt: { lt: cutoff } }, { paidAt: null, updatedAt: { lt: cutoff } }],
  };
}

export interface FineSweepResult {
  proofsDeleted: number;
  finesDeleted: number;
  failed: number;
}

export async function sweepExpiredFineFiles(
  client: PrismaClient,
  store: AssetStore,
  now: Date = new Date()
): Promise<FineSweepResult> {
  let proofsDeleted = 0;
  let finesDeleted = 0;
  let failed = 0;

  const proofs = await client.finePaymentProof.findMany({
    where: { fine: closedBefore(retentionCutoff(now, PERSON_RETENTION_YEARS)) },
    take: SWEEP_LIMIT,
    select: { id: true, storageKey: true },
  });
  for (const proof of proofs) {
    try {
      await store.remove(proof.storageKey);
      await client.finePaymentProof.delete({ where: { id: proof.id } });
      proofsDeleted += 1;
    } catch (error) {
      failed += 1;
      console.error(`[retention] could not delete proof ${proof.storageKey}:`, error);
    }
  }

  const fines = await client.fine.findMany({
    where: closedBefore(retentionCutoff(now, RECORD_RETENTION_YEARS)),
    take: SWEEP_LIMIT,
    select: {
      id: true,
      documents: { select: { storageKey: true } },
      proofs: { select: { storageKey: true } },
    },
  });
  for (const fine of fines) {
    try {
      for (const { storageKey } of [...fine.documents, ...fine.proofs]) {
        await store.remove(storageKey);
      }
      await client.$transaction([
        client.fineNotification.deleteMany({ where: { fineId: fine.id } }),
        client.fineEvent.deleteMany({ where: { fineId: fine.id } }),
        client.finePaymentProof.deleteMany({ where: { fineId: fine.id } }),
        client.actionToken.deleteMany({ where: { fineId: fine.id } }),
        client.fineDocument.deleteMany({ where: { fineId: fine.id } }),
        client.fine.delete({ where: { id: fine.id } }),
      ]);
      finesDeleted += 1;
    } catch (error) {
      failed += 1;
      console.error(`[retention] could not delete fine ${fine.id}:`, error);
    }
  }

  return { proofsDeleted, finesDeleted, failed };
}
