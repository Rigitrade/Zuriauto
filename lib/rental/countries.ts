/**
 * Country options for the contract's address block.
 *
 * Built from the `country-list` package already in the project rather than
 * reusing `components/createCountryOptions.tsx`. That component renders flag
 * images from flagcdn.com through react-select — an external request and about
 * 30 kB of JavaScript on a form filled in at the rental counter, often on
 * mobile data. A native select carries neither cost and matches the vehicle
 * picker already on the page.
 *
 * The priority ordering mirrors that component, so the two forms agree about
 * which countries come first.
 */

import { getNames } from "country-list";

/** Where ZURIAUTO's customers actually come from, ahead of the alphabet. */
const PRIORITY = ["Switzerland", "Germany", "Austria", "France", "Italy"];

function build(): string[] {
  const all = getNames();
  const priority = PRIORITY.filter((name) => all.includes(name));
  const rest = all
    .filter((name) => !priority.includes(name))
    .sort((a, b) => a.localeCompare(b));
  return [...priority, ...rest];
}

export const COUNTRIES: string[] = build();

/** Separator index, so the select can draw a rule after the priority block. */
export const PRIORITY_COUNT = PRIORITY.filter((name) =>
  COUNTRIES.includes(name)
).length;

export const DEFAULT_COUNTRY = "Switzerland";

export function isKnownCountry(value: string): boolean {
  return COUNTRIES.includes(value);
}
