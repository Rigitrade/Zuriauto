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
