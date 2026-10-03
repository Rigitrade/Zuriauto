/**
 * The words fine letters use, in German, French and Italian.
 *
 * Data, deliberately: when a new issuer's letter says "Fahrzeugkennzeichen"
 * where the others say "Kontrollschild", the fix is one entry here, not a
 * change to the extraction logic.
 *
 * Patterns allow for what OCR does to text — a lost accent, a mangled word
 * after a slash ("Datum / ze" for "Datum / Zeit" on Ahmed's sample) — and are
 * case-insensitive. Each label is matched at a word boundary so "Lieu" does
 * not fire inside "Milieu".
 */

import type { FineLanguage } from "./types";

/**
 * JavaScript's `\b` only knows ASCII letters, so it never fires before the
 * `Ü` of "Übertretungsort" — the label was silently unfindable. Every `\b`
 * here is a Unicode word boundary instead.
 */
const UNICODE_BOUNDARY = String.raw`(?:(?<![\p{L}\p{N}_])(?=[\p{L}\p{N}_])|(?<=[\p{L}\p{N}_])(?![\p{L}\p{N}_]))`;

const ci = (source: string) =>
  new RegExp(source.replaceAll(String.raw`\b`, UNICODE_BOUNDARY), "iu");

export const LABELS = {
  plate: ci(
    String.raw`\b(?:Kontrollschild(?:-Nr\.?)?|Fahrzeugkennzeichen|Kennzeichen|Plaque de contr[oô]le|Plaque|Numero di targa|Targa)\b`
  ),
  /** Requires the slash or "und/et/e": a bare "Datum:" is the letter's date. */
  moment: ci(
    String.raw`\b(?:Datum\s*/\s*\S+|Datum und Zeit|Tatzeit|Tatdatum|Date\s*/\s*heure|Date et heure|Data\s*/\s*ora|Data e ora)`
  ),
  place: ci(
    String.raw`\b(?:[ÜU]bertretungsort|Tatort|[ÖO]rtlichkeit|Lieu de l'infraction|Lieu|Luogo dell'infrazione|Luogo)\b`
  ),
  fineNumber: ci(
    String.raw`(?:\bOB-?Nr\.?|\bBussen-?Nr\.?|\bReferenz-?Nr\.?|\bVerf[üu]gungs-?Nr\.?|N°\s*OB\b|N°\s*d'amende|\bNo\.?\s*OB\b|\bN\.\s*MD\b|\bN\.\s*multa\b)`
  ),
  offence: ci(String.raw`\b(?:Ziffer\w*|chiffres?|cifr[ae])\b`),
  speedMeasured: ci(
    String.raw`\b(?:Gemessene Geschwindigkeit|Vitesse mesur[ée]e|Velocit[àa] misurata)`
  ),
  speedLimit: ci(
    String.raw`\b(?:Geschwindigkeitsbegrenzung|H[öo]chstgeschwindigkeit|Vitesse (?:maximale )?autoris[ée]e|Velocit[àa] massima)`
  ),
  total: ci(
    String.raw`\b(?:Total\s*Bussenbetrag|Bussenbetrag|Totalbetrag|Total|Betrag|Umtriebsentsch[äa]digung|Montant total|Montant|Importo totale|Importo)\b`
  ),
  dueDate: ci(
    String.raw`\b(?:zahlbar bis|Zahlungsfrist|f[äa]llig am|zu bezahlen bis|payable jusqu'au|[àa] payer jusqu'au|d[ée]lai de paiement|pagabile entro(?: il)?|da pagare entro(?: il)?)`
  ),
  reference: ci(String.raw`\b(?:Referenz|R[ée]f[ée]rence|Riferimento)\b`),
};

/**
 * Labels that end the value of the label before them on the same line.
 * "Übertretungsort Lufingen, Zürcherstrasse Datum / Zeit 02.07.2026" — the
 * place stops where the moment begins.
 */
export const STOP_LABELS: RegExp[] = [
  LABELS.plate,
  LABELS.moment,
  LABELS.place,
  LABELS.speedMeasured,
  LABELS.speedLimit,
  ci(String.raw`\b(?:Fahrzeugart|Fahrtrichtung|Massgebende Geschwindigkeit|Genre de v[ée]hicule|Genere di veicolo)\b`),
];

/** A letter about a fine at all, police or private. */
export const FINE_WORDS = ci(
  String.raw`(?:Kantonspolizei|Stadtpolizei|Gemeindepolizei|Polizei|Police cantonale|Police municipale|Polizia cantonale|Polizia comunale|Ordnungsbusse|Busse|amendes? d'ordre|amende|multa|multe disciplinari|Parkbusse|Umtriebsentsch[äa]digung|Kontrollgeb[üu]hr|Besitzesst[öo]rung|Parkierungsverstoss|p[ée]nalit[ée]|indemnit[ée]|penale)`
);

/** Police rather than a private company. */
export const POLICE_WORDS = ci(
  String.raw`(?:polizei|police|polizia|Ordnungsbusse|amendes? d'ordre|multa disciplinare|multe disciplinari)`
);

export const REMINDER_WORDS = ci(
  String.raw`\b(?:Mahnung|Zahlungserinnerung|Rappel|Sommation|Sollecito|Richiamo)\b`
);

/** The sentence form private letters use: "am 12.06.2026 um 14:32". */
export const MOMENT_SENTENCE = ci(
  String.raw`\b(?:am|le|il)\s+(\d{1,2}[./]\d{1,2}[./]\d{2,4})\s*,?\s*(?:um|[àa]|alle|ore)\s+(\d{1,2}\s?[:.h]\s?\d{2})`
);

/** Common words per language, for telling the letter's language apart. */
export const STOP_WORDS: Record<FineLanguage, Set<string>> = {
  de: new Set(["der", "die", "das", "und", "sie", "ihre", "ist", "nicht", "wurde", "mit", "bei", "zur", "dem", "den", "uns", "gemäss", "für"]),
  fr: new Set(["le", "la", "les", "des", "vous", "votre", "est", "pas", "du", "une", "avec", "pour", "nous", "selon", "dans"]),
  it: new Set(["il", "lo", "gli", "della", "delle", "che", "è", "non", "per", "una", "con", "sul", "dell'", "stata", "secondo", "all'interno"]),
};

/** The fine word in a QR message names the language outright. */
export const QR_LANGUAGE_HINTS: [RegExp, FineLanguage][] = [
  [ci("Ordnungsbusse|Busse"), "de"],
  [ci("amende"), "fr"],
  [ci("multa"), "it"],
];
