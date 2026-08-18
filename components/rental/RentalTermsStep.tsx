"use client";

import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { labelsFor } from "@/lib/rental/labels";
import { formatChf, parseChf } from "@/lib/rental/money";
import { deriveEndAt, ZURICH } from "@/lib/rental/terms";

/**
 * The commercial terms, entered by whoever runs the handover.
 *
 * Held entirely as strings. A francs field mid-typing is "12." and a week
 * count mid-typing is "" — neither is a number, and forcing them through
 * `Number()` on every keystroke is what makes a form fight the person filling
 * it in. Conversion happens once, in `toRentalTerms`, at validation.
 */

export interface TermsFormState {
  type: "WEEKLY" | "FIXED_TERM";
  /** yyyy-mm-dd, from <input type="date">. */
  startDate: string;
  /** HH:MM, from <input type="time">. */
  startTime: string;
  totalWeeks: string;
  endDate: string;
  endTime: string;
  amount: string;
  deposit: string;
}

export const EMPTY_TERMS: TermsFormState = {
  type: "WEEKLY",
  // Blank rather than "now": this page is statically prerendered, so a value
  // computed at module scope would differ between server and browser and
  // hydration would complain. The wizard fills it in on mount.
  startDate: "",
  startTime: "",
  totalWeeks: "",
  endDate: "",
  endTime: "",
  amount: "",
  deposit: "0.00",
};

/** Combines the two native inputs into something `Date.parse` understands. */
function toIso(date: string, time: string): string {
  if (!date) return "";
  const parsed = new Date(`${date}T${time || "00:00"}`);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

/**
 * Shapes the form state for `rentalTermsSchema`. Validation stays there.
 *
 * An unparseable amount becomes -1 rather than 0 or NaN: the schema rejects
 * negatives, so a field someone typed "abc" into fails loudly instead of
 * silently recording a free rental.
 */
export function toRentalTerms(state: TermsFormState): unknown {
  const startAt = toIso(state.startDate, state.startTime);
  const depositCents = parseChf(state.deposit) ?? -1;

  if (state.type === "WEEKLY") {
    return {
      type: "WEEKLY",
      startAt,
      // "" would become 0 through Number(); NaN fails the schema's int check.
      totalWeeks: state.totalWeeks.trim() === "" ? NaN : Number(state.totalWeeks),
      weeklyAmountCents: parseChf(state.amount) ?? -1,
      depositCents,
    };
  }

  return {
    type: "FIXED_TERM",
    startAt,
    endAt: toIso(state.endDate, state.endTime),
    totalAmountCents: parseChf(state.amount) ?? -1,
    depositCents,
  };
}

interface Props {
  value: TermsFormState;
  onChange: (next: TermsFormState) => void;
  errors: Record<string, string>;
  L: ReturnType<typeof labelsFor>;
}

export default function RentalTermsStep({ value, onChange, errors, L }: Props) {
  const set = <K extends keyof TermsFormState>(
    key: K,
    next: TermsFormState[K]
  ) => onChange({ ...value, [key]: next });

  /**
   * Shown live so the office sees the return date before anyone signs, rather
   * than discovering it on the finished contract. Uses the same `deriveEndAt`
   * the server will, so the two cannot disagree.
   */
  const computedEnd = useMemo(() => {
    if (value.type !== "WEEKLY") return null;
    const weeks = Number(value.totalWeeks);
    const iso = toIso(value.startDate, value.startTime);
    if (!iso || !Number.isInteger(weeks) || weeks < 1) return null;
    return deriveEndAt(new Date(iso), weeks);
  }, [value.type, value.totalWeeks, value.startDate, value.startTime]);

  /** Normalise a francs field on blur, never while typing. */
  const tidy = (key: "amount" | "deposit") => (raw: string) => {
    const cents = parseChf(raw);
    if (cents !== null) set(key, formatChf(cents));
  };

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-slate-900">{L.terms.heading}</h2>

      <fieldset className="space-y-2">
        <legend className="mb-1.5 text-sm font-medium text-slate-700">
          {L.terms.type}
        </legend>
        {(
          [
            ["WEEKLY", L.terms.typeWeekly, L.terms.typeWeeklyHint],
            ["FIXED_TERM", L.terms.typeFixed, L.terms.typeFixedHint],
          ] as const
        ).map(([type, label, hint]) => (
          <label
            key={type}
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
              value.type === type
                ? "border-slate-800 bg-slate-50"
                : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <input
              type="radio"
              name="rentalType"
              className="mt-1 accent-slate-800"
              checked={value.type === type}
              onChange={() => set("type", type)}
            />
            <span>
              <span className="block text-sm font-medium text-slate-900">
                {label}
              </span>
              <span className="block text-xs text-slate-500">{hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <TermsField
        label={`${L.terms.start} – ${L.terms.startDate} / ${L.terms.startTime}`}
        error={errors.startAt}
        required
      >
        <div className="grid grid-cols-2 gap-3">
          <Input
            type="date"
            value={value.startDate}
            onChange={(e) => set("startDate", e.target.value)}
          />
          <Input
            type="time"
            value={value.startTime}
            onChange={(e) => set("startTime", e.target.value)}
          />
        </div>
      </TermsField>

      {value.type === "WEEKLY" ? (
        <TermsField
          label={L.terms.totalWeeks}
          error={errors.totalWeeks}
          hint={
            computedEnd
              ? `${L.terms.computedEnd}: ${computedEnd.toLocaleString("de-CH", {
                  dateStyle: "short",
                  timeStyle: "short",
                  timeZone: ZURICH,
                })}`
              : undefined
          }
          required
        >
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={104}
            value={value.totalWeeks}
            onChange={(e) => set("totalWeeks", e.target.value)}
          />
        </TermsField>
      ) : (
        <TermsField
          label={`${L.terms.end} – ${L.terms.endDate} / ${L.terms.endTime}`}
          error={errors.endAt}
          required
        >
          <div className="grid grid-cols-2 gap-3">
            <Input
              type="date"
              value={value.endDate}
              onChange={(e) => set("endDate", e.target.value)}
            />
            <Input
              type="time"
              value={value.endTime}
              onChange={(e) => set("endTime", e.target.value)}
            />
          </div>
        </TermsField>
      )}

      <TermsField
        label={
          value.type === "WEEKLY" ? L.terms.weeklyAmount : L.terms.totalAmount
        }
        error={errors.amount}
        required
      >
        <Input
          type="text"
          inputMode="decimal"
          value={value.amount}
          onChange={(e) => set("amount", e.target.value)}
          onBlur={(e) => tidy("amount")(e.target.value)}
        />
      </TermsField>

      <TermsField
        label={L.terms.deposit}
        hint={L.terms.depositHint}
        error={errors.deposit}
      >
        <Input
          type="text"
          inputMode="decimal"
          value={value.deposit}
          onChange={(e) => set("deposit", e.target.value)}
          onBlur={(e) => tidy("deposit")(e.target.value)}
        />
      </TermsField>
    </div>
  );
}

/**
 * A local copy of the wizard's `Field`.
 *
 * Duplicated rather than exported from `RentalPickupWizard`, because importing
 * a helper out of a 1,200-line client component to use it in a second one is
 * how circular imports start. It is nine lines.
 */
function TermsField({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-slate-700">
        {label}
        {required && <span className="-ml-1 text-rose-500">*</span>}
      </Label>
      {children}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  );
}
