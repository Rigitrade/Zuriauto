/**
 * Whether what was read is believable, and whether it is enough to act on.
 *
 * The OCR misread 2026 as 2028 on Ahmed's sample. Nothing about the text said
 * so; only the date being in the future did. These checks are that kind of
 * argument — each one a reason a correctly read letter could not say this —
 * and a field that fails one is downgraded to DOUBTFUL rather than corrected.
 * Guessing the right year would be the same mistake the OCR made.
 */

import { zurichDayString } from "@/lib/rental/passes";
import { NUMERIC_DATE, TIME } from "./dates";
import type { Check, Extraction, Field, FieldStatus } from "./types";

/** A fine is not paid by post two years after the fact. */
export const MAX_AGE_DAYS = 730;
/** CHF 10,000: above any fixed fine; a misread decimal point lands here. */
export const MAX_AMOUNT_CENTS = 1_000_000;
/** Tesseract's own word confidence, 0–100, below which a read is a guess. */
export const LOW_WORD_CONFIDENCE = 60;

export interface ValidationContext {
  now: Date;
  /** The lowest OCR confidence among the words of a value, if known. */
  wordConfidence?: (value: string) => number | null;
}

function doubt<T>(f: Field<T>): Field<T> {
  return f.status === "READ" || f.status === "CONFIRMED"
    ? { ...f, status: "DOUBTFUL" }
    : f;
}

function daysBetween(fromIso: string, toIso: string): number {
  return (Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000;
}

/**
 * The words a value was printed as — and only those. Judging the whole line
 * would doubt a clean date because a marker stroke beside it read as garbage
 * with confidence 0, which is what happened on Ahmed's sample.
 */
function printedForm(key: string, value: string, snippet: string): string {
  if (key === "plateText") return value.replace(" ", "");
  if (key === "violationDate") return NUMERIC_DATE.exec(snippet)?.[0] ?? value;
  if (key === "violationTime") {
    return TIME.exec(snippet.replace(NUMERIC_DATE, " "))?.[0] ?? value;
  }
  return value;
}

export function validateExtraction(
  input: Extraction,
  ctx: ValidationContext
): Extraction {
  const x: Extraction = { ...input };
  const checks: Check[] = [];
  const record = (name: string, passed: boolean, detail: string) => {
    checks.push({ name, passed, detail });
    return passed;
  };

  const today = zurichDayString(ctx.now);
  const date = x.violationDate.value;
  const letter = x.letterDate.value;

  if (date) {
    let ok = record("violation-not-in-future", date <= today, `${date} ≤ ${today}`);
    if (letter) {
      ok = record("violation-before-letter", date <= letter, `${date} ≤ ${letter}`) && ok;
    }
    const age = daysBetween(date, letter ?? today);
    ok = record("violation-recent", age <= MAX_AGE_DAYS, `${Math.round(age)} days ≤ ${MAX_AGE_DAYS}`) && ok;
    if (!ok) x.violationDate = doubt(x.violationDate);
  }

  const amount = x.amountCents.value;
  if (amount !== null) {
    const inRange = record(
      "amount-in-range",
      amount > 0 && amount < MAX_AMOUNT_CENTS,
      `0 < ${amount} < ${MAX_AMOUNT_CENTS}`
    );
    if (!inRange) x.amountCents = doubt(x.amountCents);

    if (x.amountCents.source === "qr" && x.printedAmountCents !== null) {
      record(
        "qr-matches-printed-total",
        x.printedAmountCents === amount,
        `slip ${amount}, printed ${x.printedAmountCents}`
      );
    }
  }

  if (x.dueDate.value && letter && x.dueDate.value < letter) {
    record("due-after-letter", false, `${x.dueDate.value} ≥ ${letter}`);
    x.dueDate = doubt(x.dueDate);
  }

  if (ctx.wordConfidence) {
    for (const key of ["plateText", "violationDate", "violationTime", "location"] as const) {
      const f = x[key];
      if (f.source !== "ocr" || f.status !== "READ" || !f.snippet || !f.value) continue;
      const raw = printedForm(key, String(f.value), f.snippet);
      const confidence = ctx.wordConfidence(raw);
      if (confidence !== null && confidence < LOW_WORD_CONFIDENCE) {
        record(`${key}-legible`, false, `word confidence ${confidence} < ${LOW_WORD_CONFIDENCE}`);
        x[key] = doubt(f) as never;
      }
    }
  }

  x.checks = [...input.checks, ...checks];
  return x;
}

export type ExtractionProblem =
  | "NOT_A_FINE"
  | "QR_DISAGREES"
  | "FIELDS_MISSING"
  | "FIELDS_DOUBTFUL";

/**
 * Why the system should not act on this letter alone, or null when it may.
 *
 * Required: the plate (matched to our fleet — passed in, since matching
 * happens against the database), the moment, the amount, something that
 * identifies this fine among others (its number or the slip's reference), and
 * the kind. The plate must be CONFIRMED: a fine never goes to a renter on a
 * plate the system only guessed.
 */
export function requiredFieldsProblem(
  x: Extraction,
  plateStatus: FieldStatus
): ExtractionProblem | null {
  if (x.kind === "NOT_A_FINE") return "NOT_A_FINE";
  if (x.kind === "UNREADABLE") return "FIELDS_MISSING";

  if (x.checks.some((check) => check.name === "qr-matches-printed-total" && !check.passed)) {
    return "QR_DISAGREES";
  }

  const identifiers = [x.fineNumber.status, x.paymentReference.status];
  const required = [plateStatus, x.violationDate.status, x.amountCents.status];

  if (required.includes("MISSING") || identifiers.every((s) => s === "MISSING")) {
    return "FIELDS_MISSING";
  }
  if (
    plateStatus !== "CONFIRMED" ||
    required.includes("DOUBTFUL") ||
    x.violationTime.status === "DOUBTFUL" ||
    identifiers.every((s) => s === "DOUBTFUL" || s === "MISSING")
  ) {
    return "FIELDS_DOUBTFUL";
  }
  return null;
}
