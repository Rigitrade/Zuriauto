/**
 * Which of our cars a letter is about.
 *
 * Searched for, not read. The letter's plate line is the line most likely to
 * be damaged — Ahmed's red box destroyed it entirely on the sample — but the
 * question is never "what does this plate say", only "which of our dozen
 * plates is this". Looking for each of ours in the whole text survives
 * spacing, hyphens and a mangled label, and cannot invent a plate we do not
 * have.
 *
 * Retired cars are included by the caller: a fine arrives months after the
 * fact, and the car may have left the fleet in between.
 */

import type { FieldStatus } from "./types";

export interface FleetPlate {
  id: string;
  plate: string;
}

export function normalisePlate(plate: string): string {
  return plate.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function escape(char: string): string {
  return char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * A plate as a pattern: its characters with optional spaces, dots or hyphens
 * between them, and whole — not preceded by a letter or digit, not followed
 * by another digit — so ZH 123456 is not found inside ZH 1234567.
 */
function platePattern(plate: string): RegExp {
  const body = [...normalisePlate(plate)].map(escape).join("[\\s.\\-]?");
  return new RegExp(`(?<![A-Z0-9])${body}(?![\\s.\\-]?\\d)`, "i");
}

export function findFleetPlates(text: string, fleet: FleetPlate[]): FleetPlate[] {
  return fleet.filter((car) => platePattern(car.plate).test(text));
}

/**
 * Characters OCR confuses, folded onto one representative each, so a plate
 * read as "ZH 949G36" compares equal to ZH 949 636. Cyrillic З and Latin Z/2
 * are what Tesseract produced on real scans.
 */
const CONFUSIONS: Record<string, string> = {
  O: "0", D: "0", Q: "0",
  I: "1", L: "1",
  Z: "2", "З": "3",
  S: "5",
  G: "6",
  T: "7",
  B: "8",
};

function fold(plate: string): string {
  return [...plate.toUpperCase().replace(/[^A-Z0-9З]/g, "")]
    .map((char) => CONFUSIONS[char] ?? char)
    .join("");
}

function differences(a: string, b: string): number {
  if (a.length !== b.length) return Number.POSITIVE_INFINITY;
  let count = 0;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) count += 1;
  return count;
}

/**
 * Our one car whose plate the printed one could be a misreading of, or null.
 * One wrong character beyond the known confusions is forgiven; two cars
 * equally close is no answer at all.
 */
export function suggestPlate(
  printed: string | null,
  fleet: FleetPlate[]
): FleetPlate | null {
  if (!printed) return null;
  const folded = fold(printed);
  const close = fleet.filter((car) => differences(folded, fold(car.plate)) <= 1);
  return close.length === 1 ? close[0] : null;
}

export interface PlateMatch {
  carId: string | null;
  status: FieldStatus;
  reason: "PLATE_AMBIGUOUS" | "PLATE_NOT_IN_FLEET" | null;
  candidates: string[];
}

export function matchPlate(
  text: string,
  printed: string | null,
  fleet: FleetPlate[]
): PlateMatch {
  const found = findFleetPlates(text, fleet);
  if (found.length === 1) {
    return { carId: found[0].id, status: "CONFIRMED", reason: null, candidates: [found[0].id] };
  }
  if (found.length > 1) {
    return {
      carId: null,
      status: "DOUBTFUL",
      reason: "PLATE_AMBIGUOUS",
      candidates: found.map((car) => car.id),
    };
  }

  const suggestion = suggestPlate(printed, fleet);
  if (suggestion) {
    return { carId: suggestion.id, status: "DOUBTFUL", reason: null, candidates: [suggestion.id] };
  }

  return {
    carId: null,
    status: "MISSING",
    reason: printed ? "PLATE_NOT_IN_FLEET" : null,
    candidates: [],
  };
}
