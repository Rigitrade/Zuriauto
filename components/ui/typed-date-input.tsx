"use client";

import { useEffect, useRef, useState } from "react";
import {
  formatDateInput,
  parseTypedDate,
  toTypedDate,
} from "@/lib/rental/dateInput";

/**
 * A date, typed as `DD.MM.YYYY`, with no opinion about how it looks.
 *
 * The input element and the typing behaviour, and nothing else — no label, no
 * hint, no colours. Both consoles need the same behaviour and neither can use
 * the other's chrome: the admin screens are built on `--admin-*` custom
 * properties and the rental wizards on the shared `Input`. Writing the
 * behaviour twice is how the two would come to disagree about whether
 * "31.02.2026" is a date.
 *
 * Why typed rather than `<input type="date">` at all: the native control
 * renders in the **browser's** locale, not the page's. On a machine set to
 * English it offers `MM/DD/YYYY`, so 03.12.2026 is typed at a Swiss desk and
 * read back as 12 March. Every date this application *prints* is `DD.MM.YYYY`,
 * which made the native input the one place where reading a date and entering
 * one disagreed — on values that decide when a car comes off the road and when
 * a rental is overdue.
 *
 * The value in and out is `YYYY-MM-DD`, exactly what the native input
 * produced, so no caller's submit path and no endpoint's validation changes.
 */
export function TypedDateInput({
  value,
  onChange,
  onValidityChange,
  className,
  placeholder,
  min,
  max,
  disabled,
  autoFocus,
  id,
  "aria-invalid": ariaInvalid,
}: {
  /** `YYYY-MM-DD`, or `""` for no date. */
  value: string;
  /** Called with `YYYY-MM-DD` once a full, real date is typed, and with `""`
   *  when the field is emptied. Never called for a half-typed date. */
  onChange: (value: string) => void;
  /** Told whenever the field starts or stops holding something that is not a
   *  usable date, so the caller can render its own message. */
  onValidityChange?: (wrong: boolean) => void;
  className?: string;
  /** `TT.MM.JJJJ` or `DD.MM.YYYY`, from whichever label file the caller uses. */
  placeholder: string;
  /** `YYYY-MM-DD` bounds, compared as strings — which is what the ISO format is
   *  for. Advisory: they report through `onValidityChange` rather than refusing
   *  the keystroke, because a bound somebody is fighting is usually wrong. */
  min?: string;
  max?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  id?: string;
  "aria-invalid"?: boolean;
}) {
  /**
   * The text as typed, which is not derivable from `value`.
   *
   * `value` only ever holds a complete date, so a field mid-way through "28.0"
   * has nothing to render from. Deriving the text from the prop is the version
   * that makes the field impossible to type in: the third keystroke produces
   * no valid date, the parent's state does not change, and the character
   * disappears.
   */
  const [text, setText] = useState(() => toTypedDate(value));

  /**
   * Resync when the value changes underneath us — a dialog reopening on fresh
   * server data, or a form being reset after a save.
   *
   * Guarded against our own last emission, so a parent that echoes `onChange`
   * straight back does not rewrite the text being held. Without the guard,
   * typing the last digit of a date reformats the field under the cursor.
   */
  const lastEmitted = useRef(value);
  useEffect(() => {
    if (value === lastEmitted.current) return;
    lastEmitted.current = value;
    setText(toTypedDate(value));
  }, [value]);

  const parsed = parseTypedDate(text);
  // Deliberately not flagged while the field is still being filled in — only
  // once it is as long as a date needs to be. So "31.02.2026" is wrong and
  // "3" is merely unfinished.
  const malformed = text.length >= 10 && parsed === null;
  const outOfRange =
    parsed !== null &&
    ((min !== undefined && parsed < min) || (max !== undefined && parsed > max));
  const wrong = malformed || outOfRange;

  // Reported through an effect rather than from the change handler, so a value
  // arriving from outside is judged by the same rule as one typed here.
  const lastReported = useRef<boolean | null>(null);
  useEffect(() => {
    if (lastReported.current === wrong) return;
    lastReported.current = wrong;
    onValidityChange?.(wrong);
  }, [wrong, onValidityChange]);

  return (
    <input
      id={id}
      // `text`, never `date` — see the note above. `inputMode="numeric"` brings
      // up the digits on the phone at the desk without the platform's calendar
      // wheel, which is several taps to reach a year somebody can simply type.
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder}
      value={text}
      disabled={disabled}
      autoFocus={autoFocus}
      aria-invalid={ariaInvalid ?? (wrong || undefined)}
      // Ten characters is a full `DD.MM.YYYY`; the formatter caps the digits
      // at eight anyway, so this only stops a paste from looking accepted.
      maxLength={10}
      onChange={(event) => {
        const next = formatDateInput(event.target.value);
        setText(next);

        if (next === "") {
          lastEmitted.current = "";
          onChange("");
          return;
        }

        const iso = parseTypedDate(next);
        if (iso !== null) {
          lastEmitted.current = iso;
          onChange(iso);
        }
      }}
      className={className}
    />
  );
}
