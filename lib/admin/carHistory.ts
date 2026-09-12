/**
 * The window a vehicle-history search asks about.
 *
 * Pure, and separate from the route, because this is the part that decides
 * whether the office is shown the right renter. A traffic fine names one
 * instant; the screen must turn that into a question the database can answer
 * without quietly widening it.
 */

import { TZDate } from "@date-fns/tz";
import { ZURICH } from "@/lib/rental/terms";

/** Null means the whole history — a different search from a window that
 *  happens to cover everything, and recorded as such in CarHistoryLookup. */
export type HistoryWindow = { from: Date; to: Date } | null;

export type WindowResult =
  | { ok: true; window: HistoryWindow }
  | { ok: false; reason: "unparseable" | "reversed" };

function instant(value: string | null): Date | null {
  if (value === null) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Reads `from` and `to` off the query string.
 *
 * Three shapes, and one of them is the whole point:
 *
 *  - Neither present: the car's whole history.
 *  - Both present: the range between them.
 *  - One present: *that single instant*, not "everything after" or
 *    "everything before". A lone `from` left open-ended would return every
 *    rental since that date, and the office reads the first row as the
 *    answer — which is how the wrong person gets the fine.
 *
 * A date that will not parse, or a window that ends before it starts, is
 * refused rather than dropped. Ignoring it would answer a question nobody
 * asked and look authoritative doing it; a reversed window in particular
 * would report that nobody had the car, which on screen is indistinguishable
 * from a genuine gap.
 */
export function parseWindow(params: URLSearchParams): WindowResult {
  const rawFrom = params.get("from");
  const rawTo = params.get("to");

  if (rawFrom === null && rawTo === null) return { ok: true, window: null };

  const from = instant(rawFrom);
  const to = instant(rawTo);

  if (rawFrom !== null && from === null) return { ok: false, reason: "unparseable" };
  if (rawTo !== null && to === null) return { ok: false, reason: "unparseable" };

  // One end stands for both: a single instant.
  const start = from ?? to;
  const end = to ?? from;
  if (start === null || end === null) return { ok: false, reason: "unparseable" };

  if (start.getTime() > end.getTime()) return { ok: false, reason: "reversed" };

  return { ok: true, window: { from: start, to: end } };
}

/** `YYYY-MM-DD`, which is what an `<input type="date">` produces. */
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

function zurichDay(
  value: string,
  time: [number, number, number, number]
): Date | null {
  const match = DAY.exec(value);
  if (!match) return null;

  const [, year, month, date] = match;
  const at = new TZDate(
    Number(year),
    Number(month) - 1,
    Number(date),
    ...time,
    ZURICH
  );
  if (Number.isNaN(at.getTime())) return null;

  // Rejects 2026-13-45, which the constructor would roll forward into a real
  // date rather than refuse — and a search silently moved to another month is
  // worse than one that will not run.
  if (at.getMonth() !== Number(month) - 1 || at.getDate() !== Number(date)) {
    return null;
  }

  return new Date(at.getTime());
}

/**
 * Midnight on that day, as the office in Zurich means it.
 *
 * Not `new Date("2026-07-12")`, which is midnight *UTC* — 02:00 in Zurich in
 * summer. A fine issued at half past midnight would then fall outside the day
 * somebody searched for, and the screen would report the previous renter.
 */
export function dayStart(value: string): Date | null {
  return zurichDay(value, [0, 0, 0, 0]);
}

/** The last millisecond of that Zurich day, so the window is inclusive of it. */
export function dayEnd(value: string): Date | null {
  return zurichDay(value, [23, 59, 59, 999]);
}

/** Lowercased, with every space and hyphen removed, so "ZH 589 864",
 *  "zh589864" and "ZH-589-864" are one string. */
function loose(value: string): string {
  return value.toLowerCase().replace(/[\s-]/g, "");
}

/**
 * Does this car answer what somebody typed?
 *
 * One box for both the plate and the model, because the office does not think
 * of them as two searches — a ticket names a plate, a colleague names "the
 * Vito", and either should find the car. Matching is loose on both sides: a
 * plate read off a fine is typed at speed, without its spaces.
 *
 * An empty search matches everything, so the screen opens on the whole fleet
 * rather than on nothing.
 */
export function matchesCar(
  car: { model: string; plate: string },
  query: string
): boolean {
  const needle = loose(query);
  if (needle === "") return true;
  return loose(car.plate).includes(needle) || loose(car.model).includes(needle);
}

/** `2026-07-12` as the office reads it. */
function printed(value: string): string {
  const [year, month, date] = value.split("-");
  return `${date}.${month}.${year}`;
}

/**
 * How the searched window should be headed on screen.
 *
 * Built from the days somebody typed, never from the instants those became.
 * Midnight on the 12th in Zurich is 22:00 on the 11th in UTC, so formatting
 * what was sent to the server would head a search of the 12th "11.07.2026" —
 * which, on the one screen whose whole job is to name a date correctly, reads
 * as the tool being wrong about the thing it was asked.
 *
 * Null means no window: the whole history.
 */
export function windowLabel(fromDay: string, toDay: string): string | null {
  const start = fromDay || toDay;
  const end = toDay || fromDay;
  if (!start || !end) return null;
  if (start === end) return printed(start);
  return `${printed(start)} – ${printed(end)}`;
}
