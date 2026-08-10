/**
 * Country options for the contract's address block — Europe only.
 *
 * Built from the `country-list` package already in the project rather than
 * reusing `components/createCountryOptions.tsx`. That component renders flag
 * images from flagcdn.com through react-select — an external request and about
 * 30 kB of JavaScript on a form filled in at the rental counter, often on
 * mobile data. A native select carries neither cost and matches the vehicle
 * picker already on the page.
 *
 * Names are resolved from ISO 3166-1 alpha-2 codes rather than written out,
 * because `country-list` spells several of them unexpectedly ("Russian
 * Federation", "Moldova, Republic of"). Matching on codes cannot drift; a
 * hand-typed name list would silently drop entries the package spells
 * differently.
 */

import { getName } from "country-list";

/** Where ZURIAUTO's customers actually come from, ahead of the alphabet. */
const PRIORITY_CODES = ["CH", "DE", "AT", "FR", "IT"];

/**
 * Europe, read generously: the EU and EFTA, the UK, the Western Balkans, the
 * eastern states and the microstates. Transcontinental countries are included
 * where a resident would reasonably call themselves European.
 */
const EUROPE_CODES = [
  // EU 27
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR",
  "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL",
  "PL", "PT", "RO", "SK", "SI", "ES", "SE",
  // EFTA and the UK
  "CH", "IS", "LI", "NO", "GB",
  // Western Balkans
  "AL", "BA", "ME", "MK", "RS",
  // Eastern Europe
  "BY", "MD", "UA", "RU", "TR",
  // Microstates and European territories
  "AD", "MC", "SM", "VA", "GI", "FO",
];

/**
 * Readable names where the package's official form is unwieldy.
 *
 * These are printed on the address line of a signed contract, where
 * "8001 Zurich, United Kingdom of Great Britain and Northern Ireland (the)"
 * reads as a database export rather than a document.
 */
const DISPLAY_NAMES: Record<string, string> = {
  GB: "United Kingdom",
  NL: "Netherlands",
  RU: "Russia",
  MD: "Moldova",
  VA: "Vatican City",
  FO: "Faroe Islands",
  BA: "Bosnia and Herzegovina",
};

function nameFor(code: string): string | undefined {
  return DISPLAY_NAMES[code] ?? getName(code);
}

function build(): string[] {
  // `getName` returns undefined for anything the package does not carry, so a
  // code it does not recognise drops out instead of producing "undefined" in
  // the dropdown.
  const named = EUROPE_CODES.map((code) => ({
    code,
    name: nameFor(code),
  })).filter((entry): entry is { code: string; name: string } =>
    Boolean(entry.name)
  );

  const priority = PRIORITY_CODES.map(
    (code) => named.find((entry) => entry.code === code)?.name
  ).filter((name): name is string => Boolean(name));

  const rest = named
    .map((entry) => entry.name)
    .filter((name) => !priority.includes(name))
    .sort((a, b) => a.localeCompare(b));

  return [...priority, ...rest];
}

export const COUNTRIES: string[] = build();

/** Separator index, so the select can draw a rule after the priority block. */
export const PRIORITY_COUNT = PRIORITY_CODES.filter((code) => {
  const name = nameFor(code);
  return Boolean(name) && COUNTRIES.includes(name as string);
}).length;

export const DEFAULT_COUNTRY = "Switzerland";

export function isKnownCountry(value: string): boolean {
  return COUNTRIES.includes(value);
}
