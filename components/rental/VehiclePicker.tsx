"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Car, Check, ChevronDown } from "lucide-react";
import { ColourDot } from "@/components/ui/colour-dot";
import { carColourName } from "@/lib/carColour";
import type { FleetVehicle } from "@/lib/rental/fleet";
import type { labelsFor, RentalLanguage } from "@/lib/rental/labels";

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
 *
 * The colour is shown beside every car, as a dot and as a word. "The white
 * one" is how the office and the customer at the kerb both refer to a fleet of
 * six identical Priuses — the plate is what the contract needs, not what a
 * person recognises — and for the cars still waiting on a photograph it is the
 * only thing on the row that distinguishes them at all.
 */

type Labels = ReturnType<typeof labelsFor>;

export interface VehiclePickerProps {
  vehicles: FleetVehicle[];
  value: string;
  onChange: (id: string) => void;
  L: Labels;
  /** Which language the colour names are read in. The labels object cannot
   *  say — it is the strings, not the choice. */
  language: RentalLanguage;
  /** Marks the control invalid for assistive technology. */
  invalid?: boolean;
  id?: string;
}

export default function VehiclePicker({
  vehicles,
  value,
  onChange,
  L,
  language,
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
        <span className="flex min-w-0 items-center gap-2">
          {selected && (
            <ColourDot colour={selected.colour} language={language} />
          )}
          <span className={selected ? "truncate" : "truncate text-slate-500"}>
            {selected
              ? `${selected.model} — ${selected.plate}`
              : L.vehicle.selectPlaceholder}
          </span>
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
          <VehiclePreview vehicle={preview} L={L} language={language} />

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
                    <span className="flex items-center gap-1.5">
                      <ColourDot
                        colour={vehicle.colour}
                        language={language}
                        className="h-2.5 w-2.5"
                      />
                      <span className="truncate text-sm font-medium text-slate-900">
                        {vehicle.model}
                      </span>
                    </span>
                    {/* The plate, and the colour in words beside it. The dot
                        alone is not a label — these screens are read at a
                        kerb in daylight, and a colour nobody can name is not
                        something a customer can confirm. */}
                    <span className="block truncate text-xs text-slate-500">
                      <span className="font-mono">{vehicle.plate}</span>
                      {carColourName(vehicle.colour, language) &&
                        ` · ${carColourName(vehicle.colour, language)}`}
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
          <SoftImage
            src={selected.photoUrl}
            alt={`${selected.model} ${selected.plate}`}
            className="h-36 bg-slate-100 sm:h-44"
          />
        </div>
      )}
    </div>
  );
}

function VehiclePreview({
  vehicle,
  L,
  language,
}: {
  vehicle: FleetVehicle | undefined;
  L: Labels;
  language: RentalLanguage;
}) {
  if (!vehicle) return null;

  const colourName = carColourName(vehicle.colour, language);

  return (
    <div className="border-b border-slate-200 bg-slate-50">
      {/* One height for both states. A car with a photograph and a car without
          have to occupy the same box: the preview follows the pointer, and a
          preview that grows by sixty pixels when it lands on a photographed
          car pushes the rows down past the pointer, which lands it on another
          row, which shrinks it again. */}
      <div className="h-40 w-full bg-slate-100">
        {vehicle.photoUrl ? (
          // Eager, unlike the thumbnails: this one is the whole point of the
          // panel, and a lazy load would make it appear after the pointer had
          // already moved on.
          <SoftImage
            src={vehicle.photoUrl}
            alt={`${vehicle.model} ${vehicle.plate}`}
            className="h-full"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-slate-400">
            <Car className="h-7 w-7" aria-hidden="true" />
            <span className="text-xs">{L.vehicle.noPhoto}</span>
          </div>
        )}
      </div>
      <div className="flex items-baseline justify-between gap-2 px-3 py-2">
        <span className="flex min-w-0 items-center gap-2">
          <ColourDot colour={vehicle.colour} language={language} />
          <span className="truncate text-sm font-medium text-slate-900">
            {vehicle.model}
          </span>
        </span>
        <span className="shrink-0 text-xs text-slate-500">
          {colourName && <span>{colourName}{" \u00b7 "}</span>}
          <span className="font-mono">{vehicle.plate}</span>
        </span>
      </div>
    </div>
  );
}

/**
 * A photograph that arrives rather than appears.
 *
 * The preview follows whichever row is highlighted, so moving down the list
 * replaces this image once per row. Rendered plainly that is a hard cut: the
 * box drops to its grey backing for however long the next photograph takes to
 * arrive, then the new one snaps in. Over six cars it reads as flashing, which
 * is what it was reported as.
 *
 * Two things fix it and both are needed. The previous photograph stays
 * underneath until the next has finished loading, so the box never empties —
 * that is what removes the grey flash. And the incoming one fades in over it,
 * so the swap is a change rather than a cut.
 *
 * `key={src}` remounts the element for every new source, which is deliberate:
 * it is what makes `onLoad` fire again for the next photograph rather than
 * once for the first.
 *
 * The `complete` check is for a cached image, which is most of them after the
 * first pass through the list. Those can finish before React has attached the
 * handler, so `onLoad` never fires — and without the check the photograph
 * would sit at zero opacity indefinitely: invisible, with nothing logged
 * anywhere to say why.
 */
function SoftImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  /** The height, as a utility class. The positioning belongs to this
   *  component, which stacks two images. */
  className?: string;
}) {
  /**
   * The source on screen, whether it has arrived, and what to show until it
   * does — as one object, because they have to change together.
   *
   * Three separate `useState`s were the first version of this and they were
   * wrong: the underlay was cleared by an effect the moment the new
   * photograph loaded, which is the moment its three-hundred-millisecond fade
   * *starts*. So the fade ran against the grey backing rather than against the
   * previous car, and the flash this component exists to remove came back in a
   * subtler form.
   *
   * Adjusted during render rather than in an effect — the pattern React
   * documents for state derived from a changed prop. An effect would paint one
   * frame of the new source with the old source's `loaded` flag still true,
   * which is a flicker of the wrong photograph at full opacity.
   */
  const [shown, setShown] = useState({
    src,
    loaded: false,
    /** The last source that was fully visible. */
    previous: null as string | null,
  });

  if (shown.src !== src) {
    setShown({
      src,
      loaded: false,
      // Whatever was actually on screen stays on screen. If the outgoing
      // source had not finished loading either, the one before it is still
      // the best thing to hold the space with.
      previous: shown.loaded ? shown.src : shown.previous,
    });
  }

  const node = useRef<HTMLImageElement>(null);

  /**
   * A cached photograph, which is most of them after one pass through the
   * list.
   *
   * Those can finish before React attaches the handler, so `onLoad` never
   * fires. Without asking the element directly the image would sit at zero
   * opacity indefinitely: invisible, with nothing logged anywhere to say why.
   */
  useEffect(() => {
    if (node.current?.complete) {
      setShown((current) =>
        current.src === src ? { ...current, loaded: true } : current
      );
    }
  }, [src]);

  return (
    <span className={`relative block w-full overflow-hidden ${className ?? ""}`}>
      {/* The outgoing photograph, left mounted for as long as this source is
          the current one. It costs one extra element and it is what guarantees
          the fade has something to happen over.

          `aria-hidden`, because however many images are stacked here there is
          still only one car being described. */}
      {shown.previous && shown.previous !== src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={shown.previous}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      {/* `key={src}` remounts the element for every new source, which is
          deliberate: it is what makes `onLoad` fire again for the next
          photograph rather than once for the first. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={src}
        ref={node}
        src={src}
        alt={alt}
        onLoad={() =>
          setShown((current) =>
            current.src === src ? { ...current, loaded: true } : current
          )
        }
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ease-out ${
          shown.loaded ? "opacity-100" : "opacity-0"
        }`}
      />
    </span>
  );
}

function Thumbnail({ vehicle }: { vehicle: FleetVehicle }) {
  /**
   * A plain fade-in, not the preview's cross-fade.
   *
   * A thumbnail is never replaced — one row, one car, one photograph — so
   * there is nothing to hold the space for. It only has to stop appearing as a
   * hard cut when a lazily loaded image arrives after the list is already on
   * screen.
   */
  const node = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);

  // Cached, and already finished before the handler was attached. Same case
  // the preview's note explains at length.
  useEffect(() => {
    if (node.current?.complete) setLoaded(true);
  }, []);

  return (
    <span className="grid h-10 w-14 shrink-0 place-items-center overflow-hidden rounded bg-slate-100">
      {vehicle.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={node}
          src={vehicle.photoUrl}
          alt=""
          loading="lazy"
          onLoad={() => setLoaded(true)}
          className={`h-full w-full object-cover transition-opacity duration-300 ease-out ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
        />
      ) : (
        <Car className="h-4 w-4 text-slate-400" aria-hidden="true" />
      )}
    </span>
  );
}
