"use client";

import { useMemo } from "react";
import { Input, inputClasses } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TypedDateInput } from "@/components/ui/typed-date-input";
import { paymentMethodName, type labelsFor } from "@/lib/rental/labels";
import { formatChf, parseChf } from "@/lib/rental/money";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/rental/returnSchema";
import { deriveEndAt, rentalDays, ZURICH } from "@/lib/rental/terms";

/**
 * The commercial terms, entered by whoever runs the handover.
 *
 * Held entirely as strings. A francs field mid-typing is "12." — not a
 * number, and forcing it through `Number()` on every keystroke is what makes
 * a form fight the person filling it in. Conversion happens once, in
 * `toRentalTerms`, at validation.
 */

export interface TermsFormState {
  type: "WEEKLY" | "FIXED_TERM";
  /** yyyy-mm-dd, from <input type="date">. */
  startDate: string;
  /** HH:MM, from <input type="time">. */
  startTime: string;
  /** Whole weeks, as typed. Weekly only; empty is one week. */
  totalWeeks: string;
  endDate: string;
  endTime: string;
  /** The weekly price for WEEKLY, the price per day for FIXED_TERM. */
  amount: string;
  deposit: string;
  /** Empty until the office chooses: there is no default way to pay. */
  paymentMethod: PaymentMethod | "";
}

export const EMPTY_TERMS: TermsFormState = {
  type: "WEEKLY",
  // Blank rather than "now": this page is statically prerendered, so a value
  // computed at module scope would differ between server and browser and
  // hydration would complain. The wizard fills it in on mount.
  startDate: "",
  startTime: "",
  // One week unless the renter agrees to more: the owner's choice of
  // 16.10.2026. Each later week is an extension.
  totalWeeks: "1",
  endDate: "",
  endTime: "",
  amount: "",
  deposit: "0.00",
  paymentMethod: "",
};

/** Combines the two native inputs into something `Date.parse` understands. */
function toIso(date: string, time: string): string {
  if (!date) return "";
  const parsed = new Date(`${date}T${time || "00:00"}`);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

/**
 * Empty is one week. Anything else goes to the schema as typed, so "abc"
 * (NaN) and "2.5" fail there, under the field's own message.
 */
function weeksOf(raw: string): number {
  const typed = raw.trim();
  return typed === "" ? 1 : Number(typed);
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
  // Absent rather than "", so the schema answers with its own message.
  const paymentMethod = state.paymentMethod || undefined;

  if (state.type === "WEEKLY") {
    return {
      type: "WEEKLY",
      startAt,
      totalWeeks: weeksOf(state.totalWeeks),
      weeklyAmountCents: parseChf(state.amount) ?? -1,
      depositCents,
      paymentMethod,
    };
  }

  return {
    type: "FIXED_TERM",
    startAt,
    endAt: toIso(state.endDate, state.endTime),
    dailyAmountCents: parseChf(state.amount) ?? -1,
    depositCents,
    paymentMethod,
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
   * "3 Tage × CHF 80.00 = CHF 240.00", shown live so the office sees what a
   * daily rental comes to before anyone signs, rather than discovering it on
   * the finished contract. Uses the same `rentalDays` the server will, so the
   * two cannot disagree.
   */
  const dailyTotal = useMemo(() => {
    if (value.type !== "FIXED_TERM") return null;
    const start = toIso(value.startDate, value.startTime);
    const end = toIso(value.endDate, value.endTime);
    const price = parseChf(value.amount);
    if (!start || !end || price === null || end <= start) return null;
    const days = rentalDays(new Date(start), new Date(end));
    return L.terms.dailyTotal
      .replace("{days}", `${days} ${days === 1 ? L.terms.day : L.terms.days}`)
      .replace("{price}", formatChf(price))
      .replace("{total}", formatChf(days * price));
  }, [
    value.type,
    value.startDate,
    value.startTime,
    value.endDate,
    value.endTime,
    value.amount,
    L,
  ]);

  /**
   * When a weekly rental is due back, under the number of weeks, so the office
   * reads the date the contract will print before anyone signs.
   */
  const weeklyEnd = useMemo(() => {
    if (value.type !== "WEEKLY") return null;
    const start = toIso(value.startDate, value.startTime);
    const weeks = weeksOf(value.totalWeeks);
    if (!start || !Number.isInteger(weeks) || weeks < 1 || weeks > 104) return null;
    return deriveEndAt(new Date(start), weeks).toLocaleString("de-CH", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: ZURICH,
    });
  }, [value.type, value.startDate, value.startTime, value.totalWeeks]);

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
          {/* Typed DD.MM.YYYY, not the native date control: that one renders
              in the browser's locale, so a desk laptop set to English offers
              MM/DD/YYYY for a date this contract prints the other way round.
              See TypedDateInput. */}
          <TypedDateInput
            value={value.startDate}
            onChange={(next) => set("startDate", next)}
            placeholder={L.terms.datePlaceholder}
            className={inputClasses}
          />
          <Input
            type="time"
            value={value.startTime}
            onChange={(e) => set("startTime", e.target.value)}
          />
        </div>
      </TermsField>

      {/* Optional, one week when left empty: each later week is an
          extension (the owner's choice of 16.10.2026). */}
      {value.type === "WEEKLY" && (
        <TermsField
          label={L.terms.totalWeeks}
          hint={
            weeklyEnd
              ? `${L.terms.totalWeeksHint} · ${L.terms.agreedReturn}: ${weeklyEnd}`
              : L.terms.totalWeeksHint
          }
          error={errors.totalWeeks}
        >
          <Input
            type="text"
            inputMode="numeric"
            value={value.totalWeeks}
            onChange={(e) => set("totalWeeks", e.target.value)}
          />
        </TermsField>
      )}

      {value.type === "FIXED_TERM" && (
        <TermsField
          label={`${L.terms.end} – ${L.terms.endDate} / ${L.terms.endTime}`}
          error={errors.endAt}
          required
        >
          <div className="grid grid-cols-2 gap-3">
            <TypedDateInput
              value={value.endDate}
              onChange={(next) => set("endDate", next)}
              placeholder={L.terms.datePlaceholder}
              className={inputClasses}
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
          value.type === "WEEKLY" ? L.terms.weeklyAmount : L.terms.dailyAmount
        }
        hint={dailyTotal ?? undefined}
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

      {/* Radios rather than the fuel gauge's buttons: one of four, chosen
          deliberately, with no default — a preselected "Bar" would end up on
          contracts nobody paid in cash. */}
      <fieldset className="space-y-1.5">
        <legend className="mb-1.5 text-sm font-medium text-slate-700">
          {L.terms.paidBy}
          <span className="ml-1 text-rose-500">*</span>
        </legend>
        {/* Two columns at most: four do not fit "Banküberweisung" in the
            form's width, and on a phone even two leave it touching its
            border — so there they stack, as the Mietart choices above do. */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {PAYMENT_METHODS.map((method) => (
            <label
              key={method}
              className={`flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2.5 text-sm transition-colors ${
                value.paymentMethod === method
                  ? "border-slate-800 bg-slate-50 text-slate-900"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <input
                type="radio"
                name="paymentMethod"
                className="accent-slate-800"
                checked={value.paymentMethod === method}
                onChange={() => set("paymentMethod", method)}
              />
              {paymentMethodName(L, method)}
            </label>
          ))}
        </div>
        {errors.paymentMethod && (
          <p role="alert" className="text-sm text-rose-600">
            {errors.paymentMethod}
          </p>
        )}
      </fieldset>
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
      {error && (
        <p role="alert" className="text-sm text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}
