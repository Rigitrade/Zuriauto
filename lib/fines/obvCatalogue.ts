/**
 * Offences from the annex to the Ordnungsbussenverordnung (OBV, SR 314.11),
 * by item number.
 *
 * The item number is the same on German, French and Italian letters, which
 * is what lets a letter from Lausanne be described in German without
 * translating anything. A German letter needs none of this: it prints the
 * official wording itself, and offences.ts uses that.
 *
 * Only the speeding group so far — the 303 items, which is what the office's
 * pile is made of. Transcribed by hand on 2026-10-03; fedlex serves the annex
 * only through its web application, which could not be fetched as text. Any
 * item not listed falls back to the letter's own wording, labelled with its
 * language. Extend from the official text at
 * https://www.fedlex.admin.ch (SR 314.11, Anhang 1) when a new item appears.
 */

export interface CatalogueEntry {
  de: string;
  en: string;
}

const SPEEDING_DE = "Überschreiten der allgemeinen, fahrzeugbedingten oder signalisierten Höchstgeschwindigkeit";
const SPEEDING_EN = "Exceeding the general, vehicle-specific or signposted speed limit";

const WHERE = {
  "1": { de: "innerorts", en: "in a built-up area" },
  "2": { de: "ausserorts und auf Autostrassen", en: "outside built-up areas and on expressways" },
  "3": { de: "auf Autobahnen", en: "on motorways" },
} as const;

const BANDS = ["1–5", "6–10", "11–15", "16–20", "21–25"];
const LETTERS = ["a", "b", "c", "d", "e"];
/** How many bands each group has in the annex. */
const BANDS_PER_GROUP = { "1": 3, "2": 4, "3": 5 } as const;

function speeding(): Record<string, CatalogueEntry> {
  const entries: Record<string, CatalogueEntry> = {};
  for (const group of ["1", "2", "3"] as const) {
    for (let band = 0; band < BANDS_PER_GROUP[group]; band += 1) {
      entries[`303.${group}.${LETTERS[band]}`] = {
        de: `${SPEEDING_DE} ${WHERE[group].de} um ${BANDS[band]} km/h`,
        en: `${SPEEDING_EN} ${WHERE[group].en} by ${BANDS[band]} km/h`,
      };
    }
  }
  return entries;
}

export const OBV_CATALOGUE: Record<string, CatalogueEntry> = {
  ...speeding(),
};
