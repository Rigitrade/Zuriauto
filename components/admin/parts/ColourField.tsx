"use client";

import { ColourDot } from "@/components/ui/colour-dot";
import { CAR_COLOURS } from "@/lib/carColour";
import type { AdminLanguage } from "@/lib/admin/labels";
import type { Labels } from "@/components/admin/types";

/**
 * Choosing a car's colour.
 *
 * A native `<select>` with the chosen colour's dot beside it, rather than the
 * hand-built listbox the vehicle picker had to become. That one exists because
 * an `<option>` cannot contain an image and the picker's whole point was to
 * show the photograph; here the dot sits *outside* the control, so the native
 * element is free to do what it is good at — platform keyboard behaviour, a
 * real wheel on a phone, screen-reader correctness, all for nothing.
 *
 * It is also the conservative choice after the vehicle picker: a custom
 * listbox that resizes as the highlight moves is what made that control shake
 * under the pointer, and this field would have had exactly the same shape.
 *
 * The empty option stays selectable. Clearing a colour that was entered by
 * mistake has to be possible, and the endpoint reads the empty string as
 * "clear this column" — the same convention every date field here uses.
 */
export function ColourField({
  value,
  onChange,
  L,
  language,
  label,
}: {
  /** A slug from `lib/carColour.ts`, or `""` when none is recorded. */
  value: string;
  onChange: (value: string) => void;
  L: Labels;
  language: AdminLanguage;
  /** Defaults to the optional wording, which is what both dialogs want. */
  label?: string;
}) {
  return (
    <label className="grid min-w-0 gap-1">
      <span className="text-xs text-[var(--admin-muted)]">
        {label ?? L.fleet.colourOptional}
      </span>
      <div className="flex items-center gap-2">
        {/*
          A fixed-width box for the dot, occupied or not.

          Without it the select shifts sideways by twenty pixels the first time
          a colour is chosen — the same class of bug as the picker's resizing
          preview, arrived at from the other direction.
        */}
        <span className="grid h-6 w-6 shrink-0 place-items-center">
          <ColourDot colour={value} language={language} className="h-3.5 w-3.5" />
        </span>
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-full min-w-0 rounded-md border border-[var(--admin-rule-strong)] bg-[var(--admin-surface)] px-3 text-sm outline-none focus-visible:border-[var(--admin-accent)] focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]/20"
        >
          <option value="">{L.fleet.colourChoose}</option>
          {CAR_COLOURS.map((colour) => (
            <option key={colour.slug} value={colour.slug}>
              {colour.names[language]}
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}
