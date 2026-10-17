"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { dropIndex, inDraftOrder, moveItem, sameOrder } from "./reorder";

/** How near the top or bottom of the window a drag starts scrolling it. */
const EDGE_PX = 72;
/** Pixels per frame at the very edge; less further in. */
const MAX_SCROLL_PX = 14;
/** Arrow presses are gathered for this long, so three presses save once. */
const KEY_SAVE_DELAY_MS = 700;
/** How long "Order saved" stays up. */
const SAVED_NOTICE_MS = 2500;

/**
 * Drag-and-drop ordering of table rows in place (owner, 17.10.2026: "no need
 * for a modal"). Each row is a `tr[data-row-id]` inside `bodyRef`, with a
 * handle carrying `handleProps(id)`; a drop saves at once.
 *
 * Why the first version, a dialog with its own list, failed in use:
 * - It followed the pointer only while it stayed over the 32px handle. React
 *   moves the dragged row's own element when it goes down a place, which
 *   drops the pointer capture, so a drag downward stopped after one step and
 *   the row stayed drawn as dragged. Here the window listens for the drag's
 *   whole life, wherever the pointer goes.
 * - The console's refresh every minute reset the unsaved order. Here the
 *   draft is ids laid over whatever the server last sent (`inDraftOrder`).
 * - A drag downward overshot by one place (`dropIndex`).
 *
 * Pointer events rather than HTML5 drag and drop, which does nothing on a
 * touch screen; `touch-none` on the handle keeps a finger on it from
 * scrolling the page instead. Arrow keys on a focused handle move one row,
 * Escape during a drag puts everything back.
 */
export function useRowOrder<T extends { id: string }>({
  items,
  disabled,
  save,
}: {
  items: readonly T[];
  disabled: boolean;
  /** Writes the whole order; true once the server has it and has repainted. */
  save: (ids: string[]) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<string[] | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const bodyRef = useRef<HTMLTableSectionElement | null>(null);
  const handles = useRef(new Map<string, HTMLButtonElement>());
  // Read by window listeners and timers, which would otherwise see the values
  // of the render that created them.
  const draftRef = useRef<string[] | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const pointerY = useRef(0);
  const keyTimer = useRef<number | undefined>(undefined);
  const savedTimer = useRef<number | undefined>(undefined);

  const rows = inDraftOrder(items, draft);

  const updateDraft = (next: string[] | null) => {
    draftRef.current = next;
    setDraft(next);
  };

  /** The order on screen now, including a car the draft has not met. */
  const currentIds = () => inDraftOrder(itemsRef.current, draftRef.current).map((row) => row.id);

  const commit = async (ids: string[]) => {
    if (sameOrder(ids, itemsRef.current.map((item) => item.id))) {
      updateDraft(null);
      return;
    }
    setSaving(true);
    const ok = await save(ids);
    setSaving(false);
    // On success the server's order is already this one; on failure the
    // console says why and the server's order comes back.
    updateDraft(null);
    if (ok) {
      setJustSaved(true);
      window.clearTimeout(savedTimer.current);
      savedTimer.current = window.setTimeout(() => setJustSaved(false), SAVED_NOTICE_MS);
    }
  };
  // Through a ref, because `save` is a new function on every render and the
  // drag's listeners should not be torn down and re-added on each one.
  const commitRef = useRef(commit);
  commitRef.current = commit;

  // Leaving the page within the arrow keys' pause still saves what was moved.
  useEffect(
    () => () => {
      window.clearTimeout(savedTimer.current);
      if (keyTimer.current !== undefined) {
        window.clearTimeout(keyTimer.current);
        if (draftRef.current) void commitRef.current(currentIds());
      }
    },
    []
  );

  useEffect(() => {
    if (!dragging) return;

    /** Moves the dragged row to where the pointer is, measured from the DOM. */
    const place = () => {
      const body = bodyRef.current;
      if (!body) return;
      const measured = Array.from(body.querySelectorAll<HTMLElement>("tr[data-row-id]")).map(
        (row) => {
          const box = row.getBoundingClientRect();
          return { id: row.dataset.rowId ?? "", mid: box.top + box.height / 2 };
        }
      );
      const order = currentIds();
      const from = order.indexOf(dragging);
      const to = dropIndex(measured, dragging, pointerY.current);
      if (from >= 0 && to !== from) updateDraft(moveItem(order, from, to));
    };

    let ended = false;
    const end = (keep: boolean) => {
      if (ended) return;
      ended = true;
      setDragging(null);
      if (keep) void commitRef.current(currentIds());
      else updateDraft(null);
    };

    const onMove = (event: PointerEvent) => {
      pointerY.current = event.clientY;
      place();
    };
    const onUp = () => end(true);
    // The browser took the gesture over (a system swipe, a call coming in):
    // nothing the office meant to save.
    const onCancel = () => end(false);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") end(false);
    };

    // Scrolls the page while the pointer rests near its top or bottom, so a
    // car can be carried past what the screen shows.
    let frame = 0;
    const scroll = () => {
      const y = pointerY.current;
      const bottom = window.innerHeight - EDGE_PX;
      const step =
        y < EDGE_PX
          ? -Math.ceil(((EDGE_PX - y) / EDGE_PX) * MAX_SCROLL_PX)
          : y > bottom
            ? Math.ceil(((y - bottom) / EDGE_PX) * MAX_SCROLL_PX)
            : 0;
      if (step !== 0) {
        window.scrollBy(0, step);
        place();
      }
      frame = window.requestAnimationFrame(scroll);
    };
    frame = window.requestAnimationFrame(scroll);

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKey);
    const style = document.body.style;
    const before = { userSelect: style.userSelect, cursor: style.cursor };
    style.userSelect = "none";
    style.cursor = "grabbing";

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("keydown", onKey);
      style.userSelect = before.userSelect;
      style.cursor = before.cursor;
    };
  }, [dragging]);

  const blocked = disabled || saving;

  const handleProps = (id: string) => ({
    ref: (handle: HTMLButtonElement | null) => {
      if (handle) handles.current.set(id, handle);
      else handles.current.delete(id);
    },
    "aria-disabled": blocked || undefined,
    onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (blocked || dragging || event.button !== 0) return;
      // No text selection, and no click reaching the row behind.
      event.preventDefault();
      // Delivers the drag's events even outside the window; the window
      // listeners above still hear them if React moves this element.
      event.currentTarget.setPointerCapture?.(event.pointerId);
      window.clearTimeout(keyTimer.current);
      keyTimer.current = undefined;
      pointerY.current = event.clientY;
      updateDraft(currentIds());
      setDragging(id);
    },
    onKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>) => {
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      event.preventDefault();
      if (blocked || dragging) return;
      const order = currentIds();
      const from = order.indexOf(id);
      updateDraft(moveItem(order, from, from + (event.key === "ArrowUp" ? -1 : 1)));
      // Moving the row can take the focus with it; the handle keeps it, so
      // the next press moves the same car again.
      window.requestAnimationFrame(() => handles.current.get(id)?.focus());
      window.clearTimeout(keyTimer.current);
      keyTimer.current = window.setTimeout(() => {
        keyTimer.current = undefined;
        void commitRef.current(currentIds());
      }, KEY_SAVE_DELAY_MS);
    },
  });

  return { rows, bodyRef, dragging, saving, justSaved, handleProps };
}
