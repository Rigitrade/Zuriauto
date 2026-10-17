"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
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
/** How long a row takes to slide into its new place. */
const SLIDE_MS = 160;

/**
 * Drag-and-drop ordering of table rows in place (owner, 17.10.2026: "no need
 * for a modal"). Each row is a `tr[data-row-id]` inside `bodyRef`, with a
 * handle carrying `handleProps(id)`; a drop saves at once.
 *
 * The row being dragged floats under the pointer (owner, 18.10.2026), held
 * inside the table, while the others slide aside to show where it will land;
 * let go and it settles into that place. Both are transforms only, so the
 * table's layout, and with it every measurement below, is the real order.
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
  const draggingRef = useRef<string | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const pointerY = useRef(0);
  const keyTimer = useRef<number | undefined>(undefined);
  const savedTimer = useRef<number | undefined>(undefined);
  /** How far below the dragged row's top edge it was picked up. */
  const grabOffset = useRef(0);
  /** The translation currently floating the dragged row off its place. */
  const lift = useRef(0);
  /** Each row's top within the table when last painted, to slide from. */
  const tops = useRef(new Map<string, number>());
  /** The row just let go of, which settles from where it floated. */
  const dropped = useRef<string | null>(null);

  const rows = inDraftOrder(items, draft);

  const updateDraft = (next: string[] | null) => {
    draftRef.current = next;
    setDraft(next);
  };

  /** The order on screen now, including a car the draft has not met. */
  const currentIds = () => inDraftOrder(itemsRef.current, draftRef.current).map((row) => row.id);

  // Refs only, so made once: the drag's listeners can name them without
  // being torn down and re-added on every render.
  const rowElements = useCallback(
    () => Array.from(bodyRef.current?.querySelectorAll<HTMLElement>("tr[data-row-id]") ?? []),
    []
  );
  const rowElement = useCallback(
    (id: string) => rowElements().find((row) => row.dataset.rowId === id) ?? null,
    [rowElements]
  );

  /**
   * Puts the dragged row under the pointer, kept within the table body, and
   * returns where its middle now is.
   */
  const float = useCallback((): number | null => {
    const id = draggingRef.current;
    const row = id ? rowElement(id) : null;
    const body = bodyRef.current;
    if (!row || !body) return null;
    const natural = row.getBoundingClientRect().top - lift.current;
    const box = body.getBoundingClientRect();
    const top = Math.min(
      Math.max(pointerY.current - grabOffset.current, box.top),
      box.bottom - row.offsetHeight
    );
    lift.current = top - natural;
    row.style.transform = `translateY(${lift.current}px)`;
    return top + row.offsetHeight / 2;
  }, [rowElement]);

  /**
   * Slides every row that changed place from where it was to where it is.
   *
   * Runs after every render, so it covers a drag, an arrow key, Escape and a
   * refresh that brought another office's order alike. Positions come from
   * `offsetTop`, which a transform does not move, so a row caught mid-slide
   * is measured where it is going, not where it is drawn.
   */
  useLayoutEffect(() => {
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    for (const row of rowElements()) {
      const id = row.dataset.rowId ?? "";
      if (id === draggingRef.current) continue;
      if (id === dropped.current) {
        row.style.transform = "";
        dropped.current = null;
      }
      const top = row.offsetTop;
      const before = tops.current.get(id);
      tops.current.set(id, top);
      if (!calm && before !== undefined && before !== top) {
        row.animate(
          [{ transform: `translateY(${before - top}px)` }, { transform: "translateY(0)" }],
          { duration: SLIDE_MS, easing: "ease-out" }
        );
      }
    }
    // The dragged row's own place moved with the order; keep it under the
    // pointer rather than letting it jump with its place.
    if (draggingRef.current) float();
  });

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

    /** Floats the dragged row and moves its place to where it is floating. */
    const place = () => {
      const body = bodyRef.current;
      const table = body?.closest("table");
      const middle = float();
      if (!table || middle === null) return;
      const tableTop = table.getBoundingClientRect().top;
      const others = rowElements()
        .filter((row) => row.dataset.rowId !== dragging)
        .map((row) => ({
          id: row.dataset.rowId ?? "",
          mid: tableTop + row.offsetTop + row.offsetHeight / 2,
        }));
      const order = currentIds();
      const from = order.indexOf(dragging);
      const to = dropIndex(others, dragging, middle);
      if (from >= 0 && to !== from) updateDraft(moveItem(order, from, to));
    };

    let ended = false;
    const end = (keep: boolean) => {
      if (ended) return;
      ended = true;
      // Where it was floating, so the next paint settles it from there into
      // its place instead of making it jump.
      const row = rowElement(dragging);
      const table = row?.closest("table");
      if (row && table) {
        tops.current.set(
          dragging,
          row.getBoundingClientRect().top - table.getBoundingClientRect().top
        );
        dropped.current = dragging;
      }
      lift.current = 0;
      draggingRef.current = null;
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
    // A wheel turned mid-drag moves the table, not the pointer.
    const onScroll = () => place();

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
      if (step !== 0) window.scrollBy(0, step);
      frame = window.requestAnimationFrame(scroll);
    };
    frame = window.requestAnimationFrame(scroll);

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, { passive: true });
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
      window.removeEventListener("scroll", onScroll);
      style.userSelect = before.userSelect;
      style.cursor = before.cursor;
    };
  }, [dragging, float, rowElement, rowElements]);

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
      const row = event.currentTarget.closest("tr");
      if (!row) return;
      // A slide still running would hide the float under it.
      row.getAnimations().forEach((animation) => animation.cancel());
      grabOffset.current = event.clientY - row.getBoundingClientRect().top;
      lift.current = 0;
      window.clearTimeout(keyTimer.current);
      keyTimer.current = undefined;
      pointerY.current = event.clientY;
      draggingRef.current = id;
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
