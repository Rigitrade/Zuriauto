/**
 * The list with the item at `from` moved to `to`, as a new array.
 *
 * A move onto itself or off either end returns the list as it was, so a drag
 * past the last row or an arrow on the first one is simply nothing.
 */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return next;
  }
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/**
 * Where a dragged row belongs for a pointer at `y`: after every other row
 * whose middle is above it.
 *
 * Counting the other rows, rather than taking the first row whose middle is
 * below the pointer, is what stops a drag downward overshooting. Just past
 * the next row's middle is one place down; the first rule made it two, so a
 * car could not be dropped directly below its neighbour (17.10.2026).
 */
export function dropIndex(
  rows: readonly { id: string; mid: number }[],
  draggedId: string,
  y: number
): number {
  return rows.filter((row) => row.id !== draggedId && row.mid < y).length;
}

/**
 * The cars in a draft's order, each as the server last sent it.
 *
 * The draft holds ids, not cars, so the console's refresh every minute
 * freshens the rows without undoing an order still being made — the first
 * version put every car back (17.10.2026). A car the draft does not know,
 * added from another screen meanwhile, goes to the end as a new car does on
 * the server; one that has gone is dropped.
 */
export function inDraftOrder<T extends { id: string }>(
  items: readonly T[],
  draft: readonly string[] | null
): T[] {
  if (!draft) return [...items];
  const byId = new Map(items.map((item) => [item.id, item]));
  const known = new Set(draft);
  return [
    ...draft.flatMap((id) => byId.get(id) ?? []),
    ...items.filter((item) => !known.has(item.id)),
  ];
}

export function sameOrder(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}
