/**
 * What the renter is told they did, in German and English.
 *
 * Three sources, best first:
 *   - a German police letter prints the official wording — used as it is;
 *   - a French or Italian one cites an OBV item number, looked up in the
 *     catalogue;
 *   - anything else keeps the letter's own words, labelled with their
 *     language, rather than a translation nobody checked.
 * Private charges have no catalogue; they get a category.
 */

import { OBV_CATALOGUE } from "./obvCatalogue";
import type { FineLanguage, IssuerKind } from "./types";

export type PrivateCategory = "NO_PERMIT" | "OVERSTAY" | "NO_TICKET" | "OTHER";

const PRIVATE_WORDING: Record<PrivateCategory, { de: string; en: string }> = {
  NO_PERMIT: {
    de: "Parkieren ohne Berechtigung auf Privatgrund",
    en: "Parking on private property without permission",
  },
  OVERSTAY: {
    de: "Überschreiten der erlaubten Parkzeit",
    en: "Exceeding the permitted parking time",
  },
  NO_TICKET: {
    de: "Parkieren ohne gültiges Parkticket",
    en: "Parking without a valid ticket",
  },
  OTHER: {
    de: "Umtriebsentschädigung eines privaten Parkplatzbetreibers",
    en: "Charge from a private car park operator",
  },
};

export function privateCategory(text: string): PrivateCategory {
  if (/parkzeit|temps de stationnement|durata|überschritten|d[ée]pass/i.test(text)) return "OVERSTAY";
  if (/ticket|billet|biglietto/i.test(text)) return "NO_TICKET";
  if (/ohne berechtigung|sans autorisation|senza autorizzazione|besitzesst/i.test(text)) return "NO_PERMIT";
  return "OTHER";
}

const LANGUAGE_NAME = {
  de: { de: "Deutsch", en: "German" },
  fr: { de: "Französisch", en: "French" },
  it: { de: "Italienisch", en: "Italian" },
} as const;

export interface OffenceWording {
  de: string;
  en: string;
  fromCatalogue: boolean;
}

export function offenceWording(input: {
  code: string | null;
  original: string | null;
  language: FineLanguage | null;
  issuerKind: IssuerKind | null;
}): OffenceWording {
  const { code, original, language, issuerKind } = input;

  if (issuerKind === "PRIVATE") {
    return { ...PRIVATE_WORDING[privateCategory(original ?? "")], fromCatalogue: false };
  }

  const entry = code ? OBV_CATALOGUE[code] : undefined;
  if (language === "de" && original) {
    return {
      de: original,
      en: entry?.en ?? labelled(code, original, "de").en,
      fromCatalogue: false,
    };
  }
  if (entry) return { ...entry, fromCatalogue: true };
  return { ...labelled(code, original, language ?? "de"), fromCatalogue: false };
}

function labelled(
  code: string | null,
  original: string | null,
  language: FineLanguage
): { de: string; en: string } {
  const text = original ?? "—";
  const name = LANGUAGE_NAME[language];
  return {
    de: `${code ? `Ziffer ${code} ` : ""}(Originaltext, ${name.de}): ${text}`,
    en: `${code ? `Item ${code} ` : ""}(original text, ${name.en}): ${text}`,
  };
}
