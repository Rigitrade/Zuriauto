/**
 * Somewhere to put bytes.
 *
 * Kept to one method on purpose. Nothing in Phase 2 reads an object back — the
 * PDF the customer needs is the one the browser already has, and the only
 * consumer of stored images is a human opening the storage console. Adding
 * `get` and `delete` before there is a caller would be designing the Phase 5
 * dashboard from here.
 */
export interface AssetStore {
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  /**
   * Copies an existing object to a new key, server-side.
   *
   * For carrying a returning customer's identity documents onto a new
   * contract. The bytes never pass through a function — which is the whole
   * reason the reuse design does not send them to the browser — and the source
   * is left in place, because each contract owns its own set on its own
   * retention clock.
   */
  copy(fromKey: string, toKey: string, contentType: string): Promise<void>;
}
