/**
 * Somewhere to put bytes.
 *
 * Deliberately small. `get` arrived with the first real reader — resending a
 * contract whose email never left, which needs the stored PDF because the
 * browser that built it is long gone. There is still no `delete`: nothing
 * deletes an asset yet, and retention (docs/DATA-RETENTION.md) will want a
 * policy rather than a method.
 */
export interface AssetStore {
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  /**
   * Reads an object back, or null when it is not there.
   *
   * Null rather than throwing: a contract row can outlive its object — a
   * bucket restored from an older snapshot, a key written before a rename —
   * and the caller's honest answer to that is "cannot resend this one", not a
   * 500.
   */
  get(key: string): Promise<{ body: Uint8Array; contentType: string } | null>;
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
