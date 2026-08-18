import { assetKey, extensionFor } from "./keys";
import type { AssetStore } from "./types";

/**
 * Uploading a submission's images, kept separate from what is done with them.
 *
 * `kind` is a plain string rather than Prisma's `AssetKind` on purpose: this
 * module is about bytes and keys, and importing the database's enum here would
 * make the storage layer depend on the schema for no gain. The caller narrows.
 */
export interface PendingUpload {
  kind: string;
  body: Uint8Array;
  contentType: string;
}

export interface StoredAsset {
  kind: string;
  storageKey: string;
  contentType: string;
  bytes: number;
}

/**
 * Puts every object under one submission prefix and reports what landed where.
 *
 * Extracted rather than inlined into the pickup path, because the return
 * wizard in Phase 4 uploads damage photographs and a second signature through
 * exactly this shape. Nothing here knows what a pickup is.
 */
export async function uploadAssets(
  store: AssetStore,
  submissionId: string,
  uploads: PendingUpload[]
): Promise<StoredAsset[]> {
  return Promise.all(
    uploads.map(async (upload) => {
      const key = assetKey(
        submissionId,
        upload.kind,
        extensionFor(upload.contentType)
      );
      await store.put(key, upload.body, upload.contentType);
      return {
        kind: upload.kind,
        storageKey: key,
        contentType: upload.contentType,
        bytes: upload.body.byteLength,
      };
    })
  );
}
