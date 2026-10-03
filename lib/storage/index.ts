import { createMemoryStore } from "./memory";
import { createR2Store } from "./r2";
import type { AssetStore } from "./types";

export type { AssetStore } from "./types";
export type { MemoryStore } from "./memory";
export { createMemoryStore } from "./memory";
export { uploadAssets } from "./upload";
export type { PendingUpload, StoredAsset } from "./upload";
export { assetKey, carLicenceKey, carPhotoKey, extensionFor } from "./keys";

/**
 * On globalThis rather than in a module variable: a dev server re-evaluates
 * modules on every edit, and a module-held memory store became a new, empty
 * store for whichever route was recompiled — an upload landed in one and the
 * next request read another. The Prisma client is kept the same way.
 */
const holder = globalThis as unknown as { __zuriautoAssetStore?: AssetStore };

/**
 * The store this process should use.
 *
 * Falls back to memory only when R2 is unconfigured, and refuses outright in
 * production: a deploy that silently discarded every ID scan while reporting
 * success would be far worse than one that will not start.
 */
export function getAssetStore(): AssetStore {
  if (holder.__zuriautoAssetStore) return holder.__zuriautoAssetStore;

  if (process.env.R2_BUCKET) {
    holder.__zuriautoAssetStore = createR2Store();
    return holder.__zuriautoAssetStore;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "R2 is not configured. Refusing to accept identity documents with nowhere to put them."
    );
  }

  console.warn(
    "[storage] R2 is not configured — uploads are held in memory and lost on restart."
  );
  holder.__zuriautoAssetStore = createMemoryStore();
  return holder.__zuriautoAssetStore;
}
