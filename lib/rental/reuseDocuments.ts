/**
 * Carrying a returning customer's identity documents onto a new contract.
 *
 * Copies rather than shares. Hanging one Asset row off two contracts is the
 * obvious way to "reuse" a file and the wrong one: it turns a per-contract
 * deletion sweep into reference counting, and makes every retention question a
 * question about who else still points at the object. Copying keeps the
 * invariant that a contract owns its own set on its own clock, and costs a few
 * hundred kilobytes per rental.
 *
 * The copy is server-side, so the bytes never pass through a function — which
 * is also why the browser is never sent them.
 */

import type { PrismaClient } from "@/generated/prisma/client";
import {
  assetKey,
  extensionFor,
  type AssetStore,
  type StoredAsset,
} from "@/lib/storage";
import { REUSABLE_KINDS } from "./findCustomers";

export async function copyDocumentsForward(
  client: PrismaClient,
  store: AssetStore,
  submissionId: string,
  sourceContractId: string
): Promise<StoredAsset[]> {
  const source = await client.asset.findMany({
    where: { contractId: sourceContractId, kind: { in: [...REUSABLE_KINDS] } },
    select: { kind: true, storageKey: true, contentType: true, bytes: true },
  });

  // Checked here as well as at lookup time. The lookup decided what to offer
  // up to half an hour ago; this is the moment a contract is about to claim the
  // documents exist, and a partial set would make that claim false.
  if (source.length !== REUSABLE_KINDS.length) {
    throw new Error(
      `Cannot reuse documents from ${sourceContractId}: incomplete set ` +
        `(${source.length} of ${REUSABLE_KINDS.length})`
    );
  }

  return Promise.all(
    source.map(async (asset) => {
      const key = assetKey(
        submissionId,
        asset.kind,
        extensionFor(asset.contentType)
      );
      await store.copy(asset.storageKey, key, asset.contentType);
      // Every column comes from the source row, so nothing has to be
      // re-inspected in the bucket.
      return {
        kind: asset.kind,
        storageKey: key,
        contentType: asset.contentType,
        bytes: asset.bytes,
      };
    })
  );
}
