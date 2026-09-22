"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Car, Check, ChevronDown } from "lucide-react";
import type { FleetVehicle } from "@/lib/rental/fleet";
import type { labelsFor } from "@/lib/rental/labels";

/**
 * Choosing a car, with its photograph.
 *
 * This replaces a native `<select>`, which is not a decision taken lightly: a
 * native select is keyboard-accessible, screen-reader-correct and renders as
 * the platform's own wheel on a phone, all for free. It also cannot contain an
 * image. An `<option>` may hold text and nothing else, in every browser, and
 * no amount of CSS changes that — so showing the car alongside its plate means
 * building the listbox by hand.
 *
 * Having built it, the photograph is shown three ways rather than only on
 * hover:
 *
 *   - a thumbnail on every row, because hover does not exist on the phone the
 *     office actually uses at the kerb;
 *   - a large preview above the list, which follows the *highlighted* row —
 *     hovering with a mouse and arrowing with a keyboard highlight the same
 *     thing, so the feature works without a pointer;
 *   - the selected car's photograph under the closed field, so the confirmation
 *     of what was picked is the car itself and not a plate somebody has to
 *     recognise.
 *
 * A car with no photograph is not a broken state and must not look like one:
 * the row shows a silhouette and the preview says so in words. Photographs are
 * arriving from the client in batches, so most of the fleet will be in exactly
 * that condition for a while.
 */

type Labels = ReturnType<typeof labelsFor>;

export interface VehiclePickerProps {
  vehicles: FleetVehicle[];
  value: string;
  onChange: (id: string) => void;
  L: Labels;
  /** Marks the control invalid for assistive technology. */
  invalid?: boolean;
  id?: string;
}

export default function VehiclePicker({
  vehicles,
  value,
  onChange,
  L,
  invalid,
  id,
}: VehiclePickerProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const listId = `${controlId}-list`;

  const [open, setOpen] = useState(false);
  /**
   * Which row the preview is showing, as an index.
   *
   * One piece of state for both pointer and keyboard. Two — a `hovered` and a
   * `focused` — is the version that goes wrong: moving the mouse while
   * arrowing leaves the preview showing one car and the Enter key selecting
   * another.
   */
  const [highlighted, setHighlighted] = useState(-1);

  const root = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  /**
   * Whether the last highlight came from the keyboard, and where the pointer
   * was when it last actually moved.
   *
   * Both exist to break the same loop. Highlighting a row changes what the
   * preview shows, the preview is part of the panel, and anything that changes
   * the panel's geometry slides the rows under a pointer that never moved —
   * which fires `mouseenter` on a neighbour, which highlights it, which slides
   * them back. The preview is a fixed height now so it no longer moves things
   * on its own, but the list still scrolls and the panel still flips above the
   * field near the bottom of the screen, so the guard stays.
   */
  const keyboardNav = useRef(false);
  const pointer = useRef<{ x: number; y: number } | null>(null);

  const selected = useMemo(
    () => vehicles.find((vehicle) => vehicle.id === value),
    [vehicles, value]
  );

  // Opening lands on the current selection rather than at the top, so the
  // first arrow key moves from where you are.
  useEffect(() => {
    if (!open) return;
    const index = vehicles.findIndex((vehicle) => vehicle.id === value);
    keyboardNav.current = true;
    pointer.current = null;
    setHighlighted(index >= 0 ? index : 0);
  }, [open, value, vehicles]);

  // Close on an outside click or on Escape. Both, because either one alone
  // leaves a way to strand the panel open over the rest of the form.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Keeps the highlighted row in view when it moved by keyboard. `nearest`
  // rather than `center`, so arrowing one step does not jump the list — and
  // only for the keyboard: scrolling the list under a hovering pointer is the
  // shake this control used to have.
  useEffect(() => {
    if (!open || highlighted < 0 || !keyboardNav.current) return;
    const node = listRef.current?.children[highlighted] as HTMLElement | undefined;
    node?.scrollIntoView({ block: "nearest" });
  }, [open, highlighted]);

  function choose(index: number) {
    const vehicle = vehicles[index];
    if (!vehicle) return;
    onChange(vehicle.id);
    setOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }

    keyboardNav.current = true;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setHighlighted((current) => Math.min(current + 1, vehicles.length - 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setHighlighted((current) => Math.max(current - 1, 0));
        break;
      case "Home":
        event.preventDefault();
        setHighlighted(0);
        break;
      case "End":
        event.preventDefault();
        setHighlighted(vehicles.length - 1);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        choose(highlighted);
        break;
      case "Tab":
        // Tabbing away is a decision to leave, not to pick.
        setOpen(false);
        break;
    }
  }

  const preview = highlighted >= 0 ? vehicles[highlighted] : selected;

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        id={controlId}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        aria-invalid={invalid || undefined}
        aria-activedescendant={
          open && highlighted >= 0 ? `${listId}-${highlighted}` : undefined
        }
        onClick={() => setOpen((current) => !current)}
        onKeyDown={onKeyDown}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 text-left text-base outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm"
      >
        <span className={selected ? "truncate" : "truncate text-slate-500"}>
          {selected
            ? `${selected.model} — ${selected.plate}`
            : L.vehicle.selectPlaceholder}
        </span>
        <ChevronDown
          className="h-4 w-4 shrink-0 text-slate-500"
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          {/* The preview, above the list rather than beside it: the field is
              full width on a phone, and a side-by-side panel would give the
              photograph about eighty pixels. */}
          <VehiclePreview vehicle={preview} L={L} />

          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={L.vehicle.select}
            className="max-h-64 overflow-y-auto py-1"
          >
            {vehicles.map((vehicle, index) => {
              const isSelected = vehicle.id === value;
              return (
                <li
                  key={vehicle.id}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={isSelected}
                  // `onMouseDown` rather than `onClick`: the button keeps
                  // focus, and a click that first blurred it would close the
                  // panel out from under the pointer.
                  onMouseDown={(event) => {
                    event.preventDefault();
                    choose(index);
                  }}
                  // `onMouseMove` rather than `onMouseEnter`: a row that slides
                  // under a pointer which never moved fires `mouseenter` all
                  // the same, and honouring that is what made the panel
                  // shake. A real mouse move carries new coordinates.
                  onMouseMove={(event) => {
                    const last = pointer.current;
                    if (last && last.x === event.clientX && last.y === event.clientY) {
                      return;
                    }
                    pointer.current = { x: event.clientX, y: event.clientY };
                    keyboardNav.current = false;
                    setHighlighted(index);
                  }}
                  className={`flex cursor-pointer items-center gap-3 px-3 py-2 ${
                    index === highlighted ? "bg-slate-100" : ""
                  }`}
                >
                  <Thumbnail vehicle={vehicle} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-900">
                      {vehicle.model}
                    </span>
                    <span className="block truncate font-mono text-xs text-slate-500">
                      {vehicle.plate}
                    </span>
                  </span>
                  {isSelected && (
                    <Check
                      className="h-4 w-4 shrink-0 text-slate-700"
                      aria-hidden="true"
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* The chosen car, under the field. The confirmation of what was picked
          should be the car itself, not a plate to be recognised. It stays in
          the flow while the panel is open — the panel floats over it — because
          removing it would collapse the page by its own height every time the
          field is opened. */}
      {selected?.photoUrl && (
        <div className="mt-2 overflow-hidden rounded-lg border border-slate-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={selected.photoUrl}
            alt={`${selected.model} ${selected.plate}`}
            className="h-36 w-full bg-slate-100 object-cover sm:h-44"
            loading="lazy"
          />
        </div>
      )}
    </div>
  );
}

function VehiclePreview({
  vehicle,
  L,
}: {
  vehicle: FleetVehicle | undefined;
  L: Labels;
}) {
  if (!vehicle) return null;

  return (
    <div className="border-b border-slate-200 bg-slate-50">
      {/* One height for both states. A car with a photograph and a car without
          have to occupy the same box: the preview follows the pointer, and a
          preview that grows by sixty pixels when it lands on a photographed
          car pushes the rows down past the pointer, which lands it on another
          row, which shrinks it again. */}
      <div className="h-40 w-full bg-slate-100">
        {vehicle.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={vehicle.photoUrl}
            alt={`${vehicle.model} ${vehicle.plate}`}
            className="h-full w-full object-cover"
            // Eager, unlike the thumbnails: this one is the whole point of the
            // panel and a lazy load would make it appear after the pointer has
            // already moved on.
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-slate-400">
            <Car className="h-7 w-7" aria-hidden="true" />
            <span className="text-xs">{L.vehicle.noPhoto}</span>
          </div>
        )}
      </div>
      <div className="flex items-baseline justify-between gap-2 px-3 py-2">
        <span className="truncate text-sm font-medium text-slate-900">
          {vehicle.model}
        </span>
        <span className="shrink-0 font-mono text-xs text-slate-500">
          {vehicle.plate}
        </span>
      </div>
    </div>
  );
}

function Thumbnail({ vehicle }: { vehicle: FleetVehicle }) {
  return (
    <span className="grid h-10 w-14 shrink-0 place-items-center overflow-hidden rounded bg-slate-100">
      {vehicle.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={vehicle.photoUrl}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <Car className="h-4 w-4 text-slate-400" aria-hidden="true" />
      )}
    </span>
  );
}
