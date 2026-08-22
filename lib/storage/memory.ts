import type { AssetStore } from "./types";

export type MemoryStore = AssetStore & {
  objects: Map<string, { body: Uint8Array; contentType: string }>;
};

/**
 * The store used by tests and by development without R2 configured.
 *
 * Exposes what it holds, so a test can assert that five documents and a
 * signature were uploaded without reaching for a network mock.
 */
export function createMemoryStore(): MemoryStore {
  const objects = new Map<string, { body: Uint8Array; contentType: string }>();
  return {
    objects,
    async put(key, body, contentType) {
      objects.set(key, { body, contentType });
    },

    async copy(fromKey, toKey, contentType) {
      const source = objects.get(fromKey);
      // Loud, because the alternative is a contract recorded as carrying
      // documents that are not in the bucket.
      if (!source) throw new Error(`No such object: ${fromKey}`);
      objects.set(toKey, { body: source.body, contentType });
    },
  };
}
