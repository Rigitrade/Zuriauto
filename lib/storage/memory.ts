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
  };
}
