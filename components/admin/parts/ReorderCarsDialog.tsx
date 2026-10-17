"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import { ColourDot } from "@/components/ui/colour-dot";
import type { AdminLanguage } from "@/lib/admin/labels";
import type { Car, Labels } from "@/components/admin/types";
import { Dialog } from "./Dialog";
import { moveItem } from "./reorder";

/**
 * The fleet, in the office's order (owner, 16.10.2026).
 *
 * A list of its own rather than drag handles on the vehicles table: the table
 * is eight columns wide and scrolls sideways on a phone, which is no place to
 * drag a row up and down. Pointer events rather than HTML5 drag and drop,
 * because the latter does nothing on a touch screen; the arrows are there for
 * a keyboard, and for a single step without aiming.
 *
 * Nothing is saved until "Save order": a drag is a draft, and Close drops it.
 */
export function ReorderCarsDialog({
  cars,
  L,
  language,
  busy,
  open,
  onClose,
  onSave,
}: {
  cars: Car[];
  L: Labels;
  language: AdminLanguage;
  busy: boolean;
  open: boolean;
  onClose: () => void;
  onSave: (ids: string[]) => Promise<boolean>;
}) {
  const [order, setOrder] = useState<Car[]>(cars);
  const [dragging, setDragging] = useState<string | null>(null);
  const rows = useRef(new Map<string, HTMLLIElement>());

  // A fresh draft each time the dialog opens, from the order the server has.
  useEffect(() => {
    if (open) setOrder(cars);
  }, [open, cars]);

  const changed = order.some((car, i) => car.id !== cars[i]?.id);

  const move = (from: number, to: number) => setOrder((current) => moveItem(current, from, to));

  /** The row the pointer is over: the first whose middle is below it. */
  const indexAt = (clientY: number): number => {
    for (const [i, car] of order.entries()) {
      const row = rows.current.get(car.id);
      if (!row) continue;
      const box = row.getBoundingClientRect();
      if (clientY < box.top + box.height / 2) return i;
    }
    return order.length - 1;
  };

  const statusOf = (car: Car) =>
    L.fleet.statuses[car.status as keyof typeof L.fleet.statuses] ?? car.status;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={L.fleet.reorderHeading}
      closeLabel={L.fleet.close}
      footer={
        <button
          type="button"
          disabled={busy || !changed}
          onClick={async () => {
            if (await onSave(order.map((car) => car.id))) onClose();
          }}
          className="h-10 w-full rounded-md bg-[var(--admin-accent)] px-4 text-sm font-medium text-[var(--admin-accent-ink)] transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {L.fleet.saveOrder}
        </button>
      }
    >
      <p className="mb-3 text-sm text-[var(--admin-muted)]">{L.fleet.reorderHint}</p>
      <ol className="space-y-1.5">
        {order.map((car, i) => (
          <li
            key={car.id}
            ref={(row) => {
              if (row) rows.current.set(car.id, row);
              else rows.current.delete(car.id);
            }}
            className={`flex items-center gap-2 rounded-lg border bg-[var(--admin-surface)] px-2 py-2 transition-shadow ${
              dragging === car.id
                ? "border-[var(--admin-accent)] shadow-lg"
                : "border-[var(--admin-rule)]"
            } ${car.status === "retired" ? "opacity-60" : ""}`}
          >
            <button
              type="button"
              aria-label={`${L.fleet.dragHandle}: ${car.model} ${car.plate}`}
              title={L.fleet.dragHandle}
              className="grid h-9 w-8 shrink-0 cursor-grab touch-none place-items-center rounded-md text-[var(--admin-faint)] hover:bg-[var(--admin-sunk)] active:cursor-grabbing"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                setDragging(car.id);
              }}
              onPointerMove={(e) => {
                if (dragging !== car.id) return;
                const to = indexAt(e.clientY);
                if (to !== i) move(i, to);
              }}
              onPointerUp={() => setDragging(null)}
              onPointerCancel={() => setDragging(null)}
              onKeyDown={(e) => {
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  move(i, i - 1);
                } else if (e.key === "ArrowDown") {
                  e.preventDefault();
                  move(i, i + 1);
                }
              }}
            >
              <GripVertical className="h-4 w-4" aria-hidden="true" />
            </button>

            <span className="w-5 shrink-0 text-right text-xs tabular-nums text-[var(--admin-faint)]">
              {i + 1}
            </span>
            <ColourDot colour={car.colour} language={language} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{car.model}</span>
              <span className="block truncate font-mono text-xs text-[var(--admin-muted)]">
                {car.plate} · {statusOf(car)}
              </span>
            </span>

            <button
              type="button"
              aria-label={`${L.fleet.moveUp}: ${car.model} ${car.plate}`}
              title={L.fleet.moveUp}
              disabled={i === 0}
              onClick={() => move(i, i - 1)}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-[var(--admin-muted)] hover:bg-[var(--admin-sunk)] disabled:opacity-30"
            >
              <ChevronUp className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={`${L.fleet.moveDown}: ${car.model} ${car.plate}`}
              title={L.fleet.moveDown}
              disabled={i === order.length - 1}
              onClick={() => move(i, i + 1)}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-[var(--admin-muted)] hover:bg-[var(--admin-sunk)] disabled:opacity-30"
            >
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ol>
    </Dialog>
  );
}
