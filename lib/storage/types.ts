/**
 * Somewhere to put bytes.
 *
 * Deliberately small, and each method arrived with a caller. `get` came with
 * resending a contract whose email never left; `remove` with the retention
 * sweep, which is what turns docs/DATA-RETENTION.md from a document into
 * something the system actually does.
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
  /**
   * Deletes an object. Named `remove` rather than `delete`, which is a
   * reserved word and cannot be a bare method name in every call position.
   *
   * Idempotent: deleting a key that is already gone succeeds. The retention
   * sweep runs daily and may retry after a partial failure, and an object
   * that is absent is exactly the state the sweep is trying to reach.
   */
  remove(key: string): Promise<void>;
}
