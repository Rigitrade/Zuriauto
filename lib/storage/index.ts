import { createMemoryStore } from "./memory";
import { createR2Store } from "./r2";
import type { AssetStore } from "./types";

export type { AssetStore } from "./types";
export type { MemoryStore } from "./memory";
export { createMemoryStore } from "./memory";
export { uploadAssets } from "./upload";
export type { PendingUpload, StoredAsset } from "./upload";
export { assetKey, extensionFor } from "./keys";

let cached: AssetStore | null = null;

/**
 * The store this process should use.
 *
 * Falls back to memory only when R2 is unconfigured, and refuses outright in
 * production: a deploy that silently discarded every ID scan while reporting
 * success would be far worse than one that will not start.
 */
export function getAssetStore(): AssetStore {
  if (cached) return cached;

  if (process.env.R2_BUCKET) {
    cached = createR2Store();
    return cached;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "R2 is not configured. Refusing to accept identity documents with nowhere to put them."
    );
  }

  console.warn(
    "[storage] R2 is not configured — uploads are held in memory and lost on restart."
  );
  cached = createMemoryStore();
  return cached;
}
