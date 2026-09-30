/**
 * The rules behind the bell, kept out of React so they can be tested.
 *
 * The bell itself only renders what `attentionItems` already decided. What is
 * new is that the console now re-reads the server on its own, and says how
 * much is waiting in the tab title — so a return submitted while the office
 * has /admin open in the background reaches somebody without a reload.
 */

/** How often an open, visible console re-reads the overview. A return is not
 *  an emergency measured in seconds, and nine cars is a cheap request. */
export const REFRESH_INTERVAL_MS = 60_000;

const COUNT_PREFIX = /^\(\d+\)\s+/;

/**
 * The document title with the waiting count in front, as "(2) Fleet — …".
 *
 * Strips any earlier count first, so it can be applied to whatever the title
 * currently is — including one Next.js has just reset on navigation — without
 * ever producing "(3) (2) Fleet".
 */
export function titleWithCount(title: string, count: number): string {
  const base = title.replace(COUNT_PREFIX, "");
  return count > 0 ? `(${count}) ${base}` : base;
}

/**
 * Whether a background refetch should run now.
 *
 * Not while hidden: nobody is looking, and returning to the tab refetches at
 * once anyway. Not while a write is in flight: the write refetches when it
 * lands, and a read racing it can paint the screen from before the change.
 */
export function shouldRefresh(state: { hidden: boolean; busy: boolean }): boolean {
  return !state.hidden && !state.busy;
}
