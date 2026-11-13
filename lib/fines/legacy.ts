/**
 * The office's fines list from before the system, taken over as history.
 *
 * Rentals then were on paper, so the system has no rental for those months
 * and a fine from them reads "nobody had the car". The list the office kept
 * — car, date, amount, place, who was driving, the fine's number, the
 * offence — is the record of who drove when. Each row becomes a fine on its
 * car, closed (HANDLED_OTHERWISE) and marked `legacySource`, with the driver
 * as the list names them in `legacyDriverName`: usually a first name, so no
 * customer is invented for it.
 *
 * Closed, because nothing about these is for the system to chase: the daily
 * passes only look at open fines, so a legacy fine never sends an email or
 * raises a fee. A new letter for the same car and minute is flagged as a
 * probable duplicate of it, which is what the office wants to know.
 *
 * Exported from Excel as CSV ("CSV UTF-8"), with a header row:
 *
 *   Kennzeichen;Datum;Zeit;Betrag;Ort;Fahrer;Nummer;Vergehen;Telefon
 *
 * Semicolons or commas, quotes where a field holds the separator. Importing
 * the same list twice adds nothing: a row already taken over (same car,
 * moment and driver) is skipped.
 */

import type { PrismaClient } from "@/generated/prisma/client";
import { zurichInstant } from "@/lib/admin/rentalPeriod";
import { normalisePlate } from "./plates";

export const LEGACY_COLUMNS = [
  "Kennzeichen",
  "Datum",
  "Zeit",
  "Betrag",
  "Ort",
  "Fahrer",
  "Nummer",
  "Vergehen",
  "Telefon",
] as const;

export const LEGACY_MAX_ROWS = 2000;

export interface LegacyRow {
  line: number;
  plate: string;
  violationAt: Date;
  timeKnown: boolean;
  amountCents: number | null;
  /** The amount as the list wrote it, when it is not one plain number ("40+90"). */
  amountText: string | null;
  location: string | null;
  driver: string;
  fineNumber: string | null;
  offence: string | null;
  speedMeasuredKmh: number | null;
  speedLimitKmh: number | null;
  phone: string | null;
}

export interface LegacyProblem {
  line: number;
  reason: "columns" | "plate" | "date" | "time" | "driver" | "unknown-plate";
  value: string;
}

/** Split CSV text into rows of fields: quotes, doubled quotes, CRLF. */
export function csvRows(text: string): string[][] {
  const source = text.replace(/^﻿/, "");
  const firstLine = source.split(/\r?\n/, 1)[0] ?? "";
  const separator = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === separator) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.map((r) => r.map((f) => f.trim()));
}

const blank = (value: string | undefined) => !value || value.trim() === "" || value.trim() === "-";
const orNull = (value: string | undefined) => (blank(value) ? null : value!.replace(/\s+/g, " ").trim());

/** "16.05.2026" or "16.5.26" → "2026-05-16". */
export function legacyDate(value: string): string | null {
  const match = /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/.exec(value.trim());
  if (!match) return null;
  const [, d, m, y] = match;
  const year = y.length === 2 ? `20${y}` : y;
  const iso = `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  const check = new Date(`${iso}T00:00:00Z`);
  // "32.07." is no date at all; "31.02." rolls over into March.
  if (Number.isNaN(check.getTime())) return null;
  return check.toISOString().slice(0, 10) === iso ? iso : null;
}

/** "22:24", "16.10", "9.55" → "HH:mm"; the list writes both separators. */
export function legacyTime(value: string): string | null {
  const match = /^(\d{1,2})\s*[:.h]\s*(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${match[2]}`;
}

/** "100.-", "85", "70.18", "1'250.00" → cents; anything else stays text. */
export function legacyAmount(value: string): number | null {
  const plain = value.trim().replace(/^(CHF|Fr\.?)\s*/i, "").replace(/['’]/g, "").replace(/\.-$/, "");
  if (!/^\d+([.,]\d{1,2})?$/.test(plain)) return null;
  return Math.round(Number(plain.replace(",", ".")) * 100);
}

/** "60/50 kmh" → measured 60, limit 50. */
export function legacySpeed(offence: string | null): { measured: number | null; limit: number | null } {
  const match = offence ? /^(\d{2,3})\s*\/\s*(\d{2,3})\s*km\/?h$/i.exec(offence) : null;
  return match ? { measured: Number(match[1]), limit: Number(match[2]) } : { measured: null, limit: null };
}

export function parseLegacyList(text: string): { rows: LegacyRow[]; problems: LegacyProblem[] } {
  const all = csvRows(text).filter((fields) => fields.some((f) => f !== ""));
  const rows: LegacyRow[] = [];
  const problems: LegacyProblem[] = [];
  if (all.length === 0) return { rows, problems };

  // The header row is optional; when present it is the first and is skipped.
  const hasHeader = normalisePlate(all[0][0] ?? "") === "KENNZEICHEN";
  const body = (hasHeader ? all.slice(1) : all).slice(0, LEGACY_MAX_ROWS);
  const offset = hasHeader ? 2 : 1;

  body.forEach((fields, index) => {
    const line = index + offset;
    if (fields.length < 6) {
      problems.push({ line, reason: "columns", value: fields.join(" | ") });
      return;
    }
    const [plate, date, time, amount, location, driver, fineNumber, offence, phone] = fields;
    if (!/^[A-Z]{2}\d{1,6}$/.test(normalisePlate(plate))) {
      problems.push({ line, reason: "plate", value: plate });
      return;
    }
    const day = legacyDate(date);
    if (!day) {
      problems.push({ line, reason: "date", value: date });
      return;
    }
    const clock = blank(time) ? null : legacyTime(time);
    if (!blank(time) && !clock) {
      problems.push({ line, reason: "time", value: time });
      return;
    }
    if (blank(driver)) {
      problems.push({ line, reason: "driver", value: "" });
      return;
    }
    const violationAt = zurichInstant(`${day}T${clock ?? "12:00"}`)!;
    const amountCents = blank(amount) ? null : legacyAmount(amount);
    const offenceText = orNull(offence);
    const speed = legacySpeed(offenceText);
    rows.push({
      line,
      plate: plate.replace(/\s+/g, " ").trim(),
      violationAt,
      timeKnown: clock !== null,
      amountCents,
      amountText: amountCents === null && !blank(amount) ? amount.trim() : null,
      location: orNull(location),
      driver: driver.replace(/\s+/g, " ").trim(),
      fineNumber: orNull(fineNumber),
      offence: offenceText,
      speedMeasuredKmh: speed.measured,
      speedLimitKmh: speed.limit,
      phone: orNull(phone),
    });
  });
  return { rows, problems };
}

export interface LegacyImportResult {
  /** Rows written (or, on a dry run, that would be). */
  imported: number;
  /** Rows already taken over by an earlier import. */
  already: number;
  problems: LegacyProblem[];
  /** The first rows as they will be stored, for the office to compare with the list. */
  preview: { line: number; plate: string; at: string; driver: string; amountCents: number | null; offence: string | null }[];
}

function note(row: LegacyRow): string {
  return [
    "Aus der Bussenliste vor dem System (Papiermieten).",
    row.amountText ? `Betrag laut Liste: ${row.amountText}.` : null,
    row.phone ? `Tel. laut Liste: ${row.phone}.` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Checks every row against the fleet and, unless `dry`, writes the new ones.
 * Nothing is written while any row has a problem: the office fixes the list
 * and imports it again, rather than ending up with half of it.
 */
export async function importLegacyFines(
  client: PrismaClient,
  input: { organisationId: string; text: string; source: string; dry: boolean; actor: { id: string; name: string } }
): Promise<LegacyImportResult> {
  const { rows, problems } = parseLegacyList(input.text);

  const fleet = await client.car.findMany({
    where: { organisationId: input.organisationId },
    select: { id: true, plate: true },
  });
  const carOf = new Map(fleet.map((car) => [normalisePlate(car.plate), car.id]));
  for (const row of rows) {
    if (!carOf.has(normalisePlate(row.plate))) {
      problems.push({ line: row.line, reason: "unknown-plate", value: row.plate });
    }
  }
  problems.sort((a, b) => a.line - b.line);

  const known = await client.fine.findMany({
    where: { organisationId: input.organisationId, legacySource: { not: null } },
    select: { carId: true, violationAt: true, legacyDriverName: true },
  });
  const key = (carId: string | null, at: Date | null, driver: string | null) =>
    `${carId}|${at?.toISOString()}|${(driver ?? "").toLowerCase()}`;
  const taken = new Set(known.map((f) => key(f.carId, f.violationAt, f.legacyDriverName)));

  const fresh = rows.filter((row) => {
    const carId = carOf.get(normalisePlate(row.plate));
    return carId !== undefined && !taken.has(key(carId, row.violationAt, row.driver));
  });
  const already = rows.length - fresh.length - problems.filter((p) => p.reason === "unknown-plate").length;

  const preview = fresh.slice(0, 50).map((row) => ({
    line: row.line,
    plate: row.plate,
    at: row.violationAt.toISOString(),
    driver: row.driver,
    amountCents: row.amountCents,
    offence: row.offence,
  }));

  if (input.dry || problems.length > 0) {
    return { imported: problems.length > 0 ? 0 : fresh.length, already, problems, preview };
  }

  await client.$transaction(async (tx) => {
    for (const row of fresh) {
      const fine = await tx.fine.create({
        data: {
          organisationId: input.organisationId,
          carId: carOf.get(normalisePlate(row.plate))!,
          status: "HANDLED_OTHERWISE",
          violationAt: row.violationAt,
          violationTimeKnown: row.timeKnown,
          amountCents: row.amountCents,
          location: row.location,
          fineNumber: row.fineNumber,
          offenceTextDe: row.offence,
          speedMeasuredKmh: row.speedMeasuredKmh,
          speedLimitKmh: row.speedLimitKmh,
          legacyDriverName: row.driver,
          legacySource: input.source,
          closedById: input.actor.id,
          closedNote: note(row),
        },
        select: { id: true },
      });
      // Not "fine.created": that event is what the share of letters that went
      // out on their own is counted from, and these were never letters here.
      await tx.fineEvent.create({
        data: {
          fineId: fine.id,
          type: "fine.legacy-imported",
          payload: { source: input.source, line: row.line },
          actorId: input.actor.id,
          actorName: input.actor.name,
        },
      });
    }
  }, { timeout: 60_000 });

  return { imported: fresh.length, already, problems, preview };
}

/** Legacy fines of a car near a moment: who the old list says was driving. */
export async function legacyDriversNear(
  client: PrismaClient,
  carId: string,
  at: Date,
  windowMs: number
) {
  const rows = await client.fine.findMany({
    where: {
      carId,
      legacySource: { not: null },
      violationAt: { gte: new Date(at.getTime() - windowMs), lte: new Date(at.getTime() + windowMs) },
    },
    select: { id: true, violationAt: true, violationTimeKnown: true, legacyDriverName: true, offenceTextDe: true, location: true },
  });
  const distance = (row: (typeof rows)[number]) => Math.abs(row.violationAt!.getTime() - at.getTime());
  return rows.sort((a, b) => distance(a) - distance(b));
}
