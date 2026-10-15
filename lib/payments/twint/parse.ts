/**
 * TWINT's payment notification, read.
 *
 * The email is a fixed machine template: a label in one table cell, its value
 * on the lines under it. Reading it is therefore a lookup, not an
 * interpretation — which is why there is no AI here (see the spec).
 *
 * Four fields TWINT fills itself and are trusted: amount, moment, transaction
 * number, store. Three the customer types and are only evidence: name,
 * contact, Nachricht.
 */

import { zurichInstant } from "@/lib/admin/rentalPeriod";

export const LABELS = [
  "Betrag",
  "Transaktionsdatum",
  "Transaktions-Nr.",
  "Name des Stores",
  "Name",
  "Kontakt",
  "Nachricht",
] as const;
export type Label = (typeof LABELS)[number];

export interface TwintNotification {
  externalId: string;
  amountCents: number;
  currency: string;
  paidAt: Date;
  storeName: string | null;
  payerName: string | null;
  payerEmail: string | null;
  payerPhone: string | null;
  message: string | null;
}

export type ParseResult =
  | { ok: true; notification: TwintNotification }
  | { ok: false; reason: "NOT_A_PAYMENT" | "FIELD_MISSING" | "FIELD_UNREADABLE"; field?: Label };

const ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  // The apostrophe Swiss amounts group thousands with, as mail HTML writes it.
  "&rsquo;": "’",
  "&lsquo;": "‘",
  "&ndash;": "–",
  "&mdash;": "—",
};

/** One line per cell, paragraph or <br>. Single pass over entities, so
 *  "&amp;lt;" stays "&lt;" rather than becoming "<". */
export function htmlToLines(html: string): string[] {
  return html
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(td|th|tr|p|div|h[1-6]|li|table|b|strong|span)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&#x([0-9a-f]+);|&#(\d+);|&[a-z]+;/gi, (entity, hex: string | undefined, dec: string | undefined) =>
      hex
        ? String.fromCodePoint(parseInt(hex, 16))
        : dec
          ? String.fromCodePoint(Number(dec))
          : (ENTITIES[entity.toLowerCase()] ?? entity)
    )
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/**
 * The lines under each label, read one table cell at a time. TWINT puts a
 * label and its value in one cell and its footer after the last cell, so a
 * value ends with its cell: the customer's Nachricht never runs on into
 * "Bitte fügen Sie die Absenderadresse…" (it did, in every real email).
 * Within a cell a value still stops at the next label or the intro.
 */
function labelled(html: string): Partial<Record<Label, string[]>> {
  const out: Partial<Record<Label, string[]>> = {};
  const isLabel = (line: string) => (LABELS as readonly string[]).includes(line);
  for (const cell of html.split(/<\/td>/i)) {
    const lines = htmlToLines(cell);
    for (let i = 0; i < lines.length; i += 1) {
      const label = LABELS.find((l) => l === lines[i]);
      if (!label || out[label]) continue;
      const value: string[] = [];
      for (let j = i + 1; j < lines.length && !isLabel(lines[j]); j += 1) {
        if (/^Kundeninformation$|^Die Kundin oder/i.test(lines[j])) break;
        value.push(lines[j]);
      }
      out[label] = value;
    }
  }
  return out;
}

/** "CHF 1'250.00" → 125000. Null for anything that is not a positive amount. */
export function parseAmount(text: string): number | null {
  // The whole value or nothing: an amount read up to a character the pattern
  // does not know ("1&rsquo;250.00" read as "1") is a wrong amount, not a short one.
  const match = /^CHF\s*(\d{1,3}(?:['’ ]\d{3})+|\d+)(?:[.,](\d{2}))?$/i.exec(text.trim());
  if (!match) return null;
  const cents = Number(match[1].replace(/['’ ]/g, "")) * 100 + Number(match[2] ?? "0");
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

/** "05.10.2026, 10:00", Zurich wall clock → the instant. */
export function parseTwintDate(text: string): Date | null {
  const match = /^(\d{2})\.(\d{2})\.(\d{4}),?\s+(\d{2}):(\d{2})$/.exec(text.trim());
  if (!match) return null;
  const [, day, month, year, hour, minute] = match;
  // zurichInstant refuses a date that does not exist, such as 31.02.
  return zurichInstant(`${year}-${month}-${day}T${hour}:${minute}`);
}

const text = (value: string[] | undefined, joiner: string) =>
  value && value.length > 0 ? value.join(joiner) : null;

export function parseNotification(html: string): ParseResult {
  const f = labelled(html);
  if (!f["Betrag"] && !f["Transaktions-Nr."]) return { ok: false, reason: "NOT_A_PAYMENT" };

  for (const field of ["Betrag", "Transaktionsdatum", "Transaktions-Nr."] as const) {
    if (!f[field]?.length) return { ok: false, reason: "FIELD_MISSING", field };
  }

  const amountCents = parseAmount(f["Betrag"]!.join(" "));
  if (amountCents === null) return { ok: false, reason: "FIELD_UNREADABLE", field: "Betrag" };

  const paidAt = parseTwintDate(f["Transaktionsdatum"]!.join(" "));
  if (!paidAt) return { ok: false, reason: "FIELD_UNREADABLE", field: "Transaktionsdatum" };

  const externalId = f["Transaktions-Nr."]!.join("").trim();
  if (!/^[0-9a-f][0-9a-f-]{7,}$/i.test(externalId)) {
    return { ok: false, reason: "FIELD_UNREADABLE", field: "Transaktions-Nr." };
  }

  const contact = f["Kontakt"] ?? [];
  return {
    ok: true,
    notification: {
      externalId: externalId.toLowerCase(),
      amountCents,
      currency: "CHF",
      paidAt,
      storeName: text(f["Name des Stores"], " "),
      payerName: text(f["Name"], " "),
      payerEmail: contact.find((line) => line.includes("@"))?.toLowerCase() ?? null,
      payerPhone: contact.find((line) => /^\+?[\d\s()/-]{7,}$/.test(line)) ?? null,
      message: text(f["Nachricht"], "\n"),
    },
  };
}
