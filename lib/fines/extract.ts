/**
 * The fields of a fine letter, from its OCR text and its QR-bill.
 *
 * What the QR-bill says is taken as CONFIRMED and never second-guessed from
 * the text. What the text says under a known label is READ. A value found
 * without its label is DOUBTFUL. Nothing here decides whether a renter is
 * emailed — validate.ts does that from these statuses.
 */

import { NUMERIC_DATE, parseNumericDate, parseTime, parseWrittenDate } from "./dates";
import type { QrBill } from "./qrBill";
import {
  type Extraction,
  type Field,
  type FineLanguage,
  field,
  missing,
} from "./types";
import {
  FINE_WORDS,
  LABELS,
  MOMENT_SENTENCE,
  POLICE_WORDS,
  REMINDER_WORDS,
  STOP_LABELS,
} from "./vocabulary";

const SNIPPET_LENGTH = 160;

function snippetOf(line: string): string {
  return line.trim().slice(0, SNIPPET_LENGTH);
}

/** The first line a label appears on, and the text after the label up to
 *  the next label on that line. */
function labelled(
  lines: string[],
  label: RegExp
): { line: string; value: string } | null {
  for (const line of lines) {
    const match = label.exec(line);
    if (!match) continue;
    let value = line.slice(match.index + match[0].length);
    for (const stop of STOP_LABELS) {
      if (stop === label) continue;
      const next = stop.exec(value);
      if (next && next.index > 0) value = value.slice(0, next.index);
    }
    // Also the quote OCR leaves where a label's last letter touched a mark:
    // "Übertretungsort‘ Lufingen".
    return { line, value: value.replace(/^[\s:.\-–'‘’"„“]+/, "").trim() };
  }
  return null;
}

/**
 * A fine number: consecutive tokens that each carry a digit.
 * "830557506 017 4 Bis jetzt" → "830557506 017 4"; "PP-2026-118734" stays.
 */
function numberTokens(value: string): string | null {
  const tokens: string[] = [];
  for (const token of value.trim().split(/\s+/)) {
    if (/^[A-Z0-9][A-Z0-9.\-/]*$/i.test(token) && /\d/.test(token)) {
      tokens.push(token);
    } else {
      break;
    }
  }
  const joined = tokens.join(" ");
  return joined.length >= 5 ? joined : null;
}

const QR_FINE_NUMBER = [
  // The Kantonspolizei's OB number: nine digits, three, one.
  /(\d{9}\s?\d{3}\s?\d)(?!\d)/,
  /(?:Ordnungsbusse|Busse|Amende(?: d'ordre)?|Multa(?: disciplinare)?|Referenz|R[ée]f\.?|Rif\.?)\s*(?:Nr\.?|N°|N\.)?\s*:?\s*([A-Z0-9][A-Z0-9 .\-/]{4,})/i,
];

function fineNumberFrom(text: string, qr: QrBill | null, lines: string[]): Field<string> {
  if (qr?.message) {
    for (const pattern of QR_FINE_NUMBER) {
      const match = pattern.exec(qr.message);
      if (match) {
        const value = numberTokens(match[1]) ?? match[1].trim();
        return field(value, "CONFIRMED", "qr", qr.message);
      }
    }
  }
  const found = labelled(lines, LABELS.fineNumber);
  const value = found && numberTokens(found.value);
  return value ? field(value, "READ", "ocr", snippetOf(found.line)) : missing();
}

/** "CHF 40.00", "40,00", "Fr. 120.–" → cents. */
function amountIn(text: string): number | null {
  const match = /(?:CHF|Fr\.)?\s*(\d{1,6})(?:[.,](\d{2}|–|-))?(?!\d)/.exec(text);
  if (!match) return null;
  const cents = match[2] && /\d{2}/.test(match[2]) ? Number(match[2]) : 0;
  return Number(match[1]) * 100 + cents;
}

function printedTotal(lines: string[]): { cents: number; line: string } | null {
  // A line naming a *total* first; a plain "Betrag" second.
  const ordered = [
    ...lines.filter((line) => /total|montant total|importo totale/i.test(line)),
    ...lines,
  ];
  for (const line of ordered) {
    const match = LABELS.total.exec(line);
    if (!match) continue;
    const after = line.slice(match.index + match[0].length);
    if (!/\d+[.,]\d{2}|\d+\.–/.test(after)) continue;
    const cents = amountIn(after.replace(/^[^\d]*?(?=(CHF|Fr\.)?\s*\d)/, ""));
    if (cents !== null) return { cents, line };
  }
  return null;
}

function plateFrom(lines: string[]): Field<string> {
  const found = labelled(lines, LABELS.plate);
  if (!found) return missing();
  const match = /\b([A-Z]{2})\s?(\d[\d ]{0,8}\d|\d)\b/.exec(found.value);
  if (!match) return missing();
  return field(
    `${match[1]} ${match[2].replace(/\s/g, "")}`,
    "READ",
    "ocr",
    snippetOf(found.line)
  );
}

function momentFrom(text: string, lines: string[]): {
  date: Field<string>;
  time: Field<string>;
} {
  const found = labelled(lines, LABELS.moment);
  if (found) {
    const date = parseNumericDate(found.value);
    if (date) {
      const rest = found.value.replace(NUMERIC_DATE, " ");
      const time = parseTime(rest);
      const snippet = snippetOf(found.line);
      return {
        date: field(date, "READ", "ocr", snippet),
        time: time ? field(time, "READ", "ocr", snippet) : missing(),
      };
    }
  }

  for (const line of lines) {
    const sentence = MOMENT_SENTENCE.exec(line);
    if (!sentence) continue;
    const date = parseNumericDate(sentence[1]);
    const time = parseTime(sentence[2]);
    if (date) {
      const snippet = snippetOf(line);
      return {
        date: field(date, "READ", "ocr", snippet),
        time: time ? field(time, "READ", "ocr", snippet) : missing(),
      };
    }
  }

  // No label and no sentence: the only date-and-time pair on the page, if
  // there is exactly one, as a guess.
  const pairs = [
    ...text.matchAll(/(\d{1,2}[./]\d{1,2}[./]\d{2,4})\D{1,4}(\d{1,2}[:.h]\d{2})/g),
  ];
  if (pairs.length === 1) {
    const date = parseNumericDate(pairs[0][1]);
    const time = parseTime(pairs[0][2]);
    if (date) {
      return {
        date: field(date, "DOUBTFUL", "ocr", pairs[0][0]),
        time: time ? field(time, "DOUBTFUL", "ocr", pairs[0][0]) : missing(),
      };
    }
  }
  return { date: missing(), time: missing() };
}

function placeFrom(lines: string[]): Field<string> {
  const found = labelled(lines, LABELS.place);
  const value = found?.value.replace(/[\s,;|[\]]+$/, "").trim();
  return found && value ? field(value, "READ", "ocr", snippetOf(found.line)) : missing();
}

const TRAILING_AMOUNT = /\s+\d+[.,]\d{2}\s*$/;

/** A line that starts something else rather than continuing a description. */
function isLabelledLine(line: string): boolean {
  // "Höchstgeschwindigkeit" is a speed label and also the offence's own
  // wording; it labels a line only when a km/h value follows.
  const speedLabels = [LABELS.speedMeasured, LABELS.speedLimit];
  return (
    STOP_LABELS.some(
      (label) => label.test(line) && (!speedLabels.includes(label) || /\d+\s*km/i.test(line))
    ) ||
    LABELS.total.test(line) ||
    LABELS.offence.test(line) ||
    LABELS.fineNumber.test(line) ||
    LABELS.dueDate.test(line)
  );
}

/**
 * The offence's wording, which letters wrap. Two shapes, both seen on real
 * letters: the description runs on to a second line that ends with the
 * amount, or the amount sits on the first line and a word or two wraps
 * below it ("… Höchstgeschwindigkeit 40.00" / "innerorts"). Up to two
 * continuation lines are joined, stopping at anything labelled.
 */
function wrappedDescription(lines: string[], start: number, first: string): string {
  const parts = [first];
  for (let next = start + 1; next <= start + 2 && next < lines.length; next += 1) {
    const line = lines[next].trim();
    if (!line || isLabelledLine(line)) break;
    const hadAmount = TRAILING_AMOUNT.test(parts.join(" "));
    // After the amount, only a short wrapped tail belongs to the offence.
    if (hadAmount && (line.length > 40 || /\d/.test(line))) break;
    parts.push(line);
    if (!hadAmount && TRAILING_AMOUNT.test(line)) break;
  }
  return parts
    .map((part) => part.replace(TRAILING_AMOUNT, ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function offenceFrom(lines: string[]): { code: Field<string>; text: Field<string> } {
  for (const [index, line] of lines.entries()) {
    const label = LABELS.offence.exec(line);
    if (!label) continue;
    const rest = line.slice(label.index + label[0].length);
    const match = /^\s*(\d{3})(?:\.(\d{1,2}))?(?:\.?([a-z]))?\b\s*(.*)$/.exec(rest);
    if (!match) continue;
    const code = [match[1], match[2], match[3]].filter(Boolean).join(".");
    const description = wrappedDescription(lines, index, match[4]);
    const snippet = snippetOf(line);
    return {
      code: field(code, "READ", "ocr", snippet),
      text: description ? field(description, "READ", "ocr", snippet) : missing(),
    };
  }
  return { code: missing(), text: missing() };
}

function speedFrom(lines: string[], label: RegExp): Field<number> {
  for (const line of lines) {
    // The label's own flags: its boundaries are Unicode escapes.
    const match = new RegExp(
      label.source + String.raw`\D{0,6}?(\d{2,3})\s*km`,
      label.flags
    ).exec(line);
    if (match) return field(Number(match[1]), "READ", "ocr", snippetOf(line));
  }
  return missing();
}

function dateUnder(lines: string[], label: RegExp): Field<string> {
  for (const line of lines) {
    const match = label.exec(line);
    if (!match) continue;
    const after = line.slice(match.index + match[0].length);
    const date = parseNumericDate(after) ?? parseWrittenDate(after);
    if (date) return field(date, "READ", "ocr", snippetOf(line));
  }
  return missing();
}

function letterDateFrom(lines: string[]): Field<string> {
  for (const line of lines) {
    const date = parseWrittenDate(line);
    if (date) return field(date, "READ", "ocr", snippetOf(line));
  }
  return missing();
}

function referenceFrom(qr: QrBill | null, lines: string[]): Field<string> {
  if (qr && qr.referenceType !== "NON" && qr.reference) {
    return field(qr.reference, "CONFIRMED", "qr", qr.reference);
  }
  for (const line of lines) {
    const match = LABELS.reference.exec(line);
    if (!match || LABELS.fineNumber.test(line)) continue;
    const digits = line.slice(match.index + match[0].length).replace(/\s/g, "");
    const reference = /^\d{20,27}/.exec(digits)?.[0];
    if (reference) return field(reference, "READ", "ocr", snippetOf(line));
  }
  return missing();
}

export function extractFields(
  text: string,
  qr: QrBill | null,
  language: FineLanguage | null
): Extraction {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  const everything = `${text}\n${qr?.creditorName ?? ""}\n${qr?.message ?? ""}`;

  const readable = text.replace(/\s/g, "").length >= 30;
  const isFine = FINE_WORDS.test(everything);
  const kind = !readable
    ? "UNREADABLE"
    : !isFine
      ? "NOT_A_FINE"
      : REMINDER_WORDS.test(text)
        ? "REMINDER"
        : "NOTICE";

  const issuerKind =
    kind === "NOTICE" || kind === "REMINDER"
      ? POLICE_WORDS.test(qr?.creditorName ?? "") || POLICE_WORDS.test(text)
        ? "POLICE"
        : "PRIVATE"
      : null;

  const printed = printedTotal(lines);
  const amountCents: Field<number> =
    qr?.amountCents != null
      ? field(qr.amountCents, "CONFIRMED", "qr", `${qr.amountCents / 100} ${qr.currency}`)
      : printed
        ? field(printed.cents, "READ", "ocr", snippetOf(printed.line))
        : missing();

  const moment = momentFrom(text, lines);
  const offence = offenceFrom(lines);

  return {
    language,
    kind,
    issuerKind,
    issuerName: qr?.creditorName
      ? field(qr.creditorName, "CONFIRMED", "qr", qr.creditorName)
      : missing(),
    issuerIban: qr?.iban ? field(qr.iban, "CONFIRMED", "qr", qr.iban) : missing(),
    fineNumber: fineNumberFrom(text, qr, lines),
    paymentReference: referenceFrom(qr, lines),
    amountCents,
    printedAmountCents: printed?.cents ?? null,
    plateText: plateFrom(lines),
    violationDate: moment.date,
    violationTime: moment.time,
    location: placeFrom(lines),
    offenceCode: offence.code,
    offenceText: offence.text,
    speedMeasuredKmh: speedFrom(lines, LABELS.speedMeasured),
    speedLimitKmh: speedFrom(lines, LABELS.speedLimit),
    letterDate: letterDateFrom(lines),
    dueDate: dateUnder(lines, LABELS.dueDate),
    checks: [],
  };
}
