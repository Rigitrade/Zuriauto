"use client";

import { useState } from "react";
import { TypedDateInput } from "@/components/ui/typed-date-input";

/**
 * A labelled date field for the console, typed as `DD.MM.YYYY`.
 *
 * The chrome — label, hint, the red state — around the shared
 * `TypedDateInput`, which holds the typing behaviour and the reason it exists:
 * a native `<input type="date">` renders in the browser's locale, so an office
 * laptop set to English offers `MM/DD/YYYY` for a value this console prints
 * everywhere as `DD.MM.YYYY`. On an inspection date that is not cosmetic.
 *
 * Split from the behaviour because the rental wizards need the same field in
 * entirely different clothes: these screens are built on the `--admin-*`
 * custom properties, those on the shared `Input`. One implementation of what a
 * date is, two of what one looks like.
 */
export function DateField({
  label,
  value,
  onChange,
  hint,
  placeholder,
  invalidHint,
  min,
  max,
  autoFocus,
  disabled,
  id,
}: {
  label?: string;
  /** `YYYY-MM-DD`, or `""` for no date. */
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  /** `TT.MM.JJJJ` or `DD.MM.YYYY`, from the label file. */
  placeholder: string;
  /** Shown when the field holds something that is not a usable date. */
  invalidHint?: string;
  /** `YYYY-MM-DD` bounds. Advisory — they colour the field rather than
   *  refusing the keystroke. */
  min?: string;
  max?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  id?: string;
}) {
  const [wrong, setWrong] = useState(false);

  return (
    <label className="grid min-w-0 gap-1">
      {label && (
        <span className="text-xs text-[var(--admin-muted)]">{label}</span>
      )}
      <TypedDateInput
        id={id}
        value={value}
        onChange={onChange}
        onValidityChange={setWrong}
        placeholder={placeholder}
        min={min}
        max={max}
        autoFocus={autoFocus}
        disabled={disabled}
        className={`h-10 w-full min-w-0 rounded-md border bg-[var(--admin-surface)] px-3 text-sm tabular-nums outline-none focus-visible:ring-2 disabled:opacity-40 ${
          wrong
            ? "border-[var(--admin-crit)] focus-visible:border-[var(--admin-crit)] focus-visible:ring-[var(--admin-crit)]/20"
            : "border-[var(--admin-rule-strong)] focus-visible:border-[var(--admin-accent)] focus-visible:ring-[var(--admin-accent)]/20"
        }`}
      />
      {wrong && invalidHint ? (
        <span className="text-xs text-[var(--admin-crit)]">{invalidHint}</span>
      ) : (
        hint && <span className="text-xs text-[var(--admin-faint)]">{hint}</span>
      )}
    </label>
  );
}
