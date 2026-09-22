/**
 * The rules the fleet page enforces.
 *
 * Separated from the endpoints so the interesting parts — how a slug is built
 * and which status changes are permitted — can be tested without a database.
 */

import { z } from "zod";
import type { CarStatus } from "@/generated/prisma/client";
import { CAR_COLOUR_SLUGS } from "@/lib/carColour";
import { parseChf } from "@/lib/rental/money";

/** The off-road state the office chooses by hand. `maintenance` is the other
 *  one, and is set by the MFK pass as well as from the fleet screen. */
export const OFF_ROAD = "retired" as const;

/**
 * Every combining mark, by Unicode property.
 *
 * `\p{M}` rather than a hand-written `̀-ͯ` range: the range covers
 * only Latin diacritics, and writing it means putting invisible combining
 * characters in the source, which a re-encoding can silently mangle — turning
 * Škoda into koda with no test able to explain why.
 */
const COMBINING_MARKS = /\p{M}/gu;

/** Separators become hyphens: this is the readable half of the slug. */
function slugifyWords(value: string): string {
  return value
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Separators are dropped: a plate reads as one token, as the fleet file has it. */
function slugifyPlate(value: string): string {
  return value
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/**
 * The stable key for a car, derived once at creation.
 *
 * `Car.slug` is what the pickup form submits as `vehicleId`, so it must survive
 * an edit that corrects a plate — which is why nothing recomputes it on update.
 * Uniqueness follows from `@@unique([organisationId, plate])`.
 */
export function carSlug(model: string, plate: string): string {
  return `${slugifyWords(model)}-${slugifyPlate(plate)}`;
}

/** Trimmed, inner runs of whitespace collapsed, upper-cased as the plate is worn. */
const plateField = z
  .string()
  .trim()
  .min(1, "plate")
  .max(40, "plate")
  .transform((value) => value.replace(/\s+/g, " ").toUpperCase());

const modelField = z.string().trim().min(1, "model").max(100, "model");
const vinField = z.string().trim().max(40, "vin").optional();

/**
 * A calendar day, as `<input type="date">` submits it.
 *
 * Generalised from the MFK field once the maintenance dialog added three more
 * of them — the last service, and a repair's planned and completed dates. The
 * round-trip check is the point: `2026-13-45` parses in JavaScript by rolling
 * forward into a real date, so a typo would silently become a day nobody
 * chose. Comparing the parsed value back against the string refuses it.
 *
 * `name` only names the field in the validation message, which is what the
 * endpoint returns as `issues` and the dialog shows.
 */
function dayField(name: string) {
  return z
    .string()
    .trim()
    .refine(
      (value) =>
        value === "" ||
        (/^\d{4}-\d{2}-\d{2}$/.test(value) &&
          !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)) &&
          new Date(`${value}T00:00:00.000Z`).toISOString().startsWith(value)),
      { message: name }
    )
    .optional();
}

const mfkDateField = dayField("mfkDate");
const mfkLastDateField = dayField("mfkLastDate");

/**
 * The colour, as one of the slugs in lib/carColour.ts.
 *
 * Validated against that list rather than accepted as free text, because the
 * pickers paint a swatch from it — an unrecognised value would render as an
 * empty chip, which reads as "no colour recorded" while the database says
 * otherwise. The empty string clears it, exactly as it does for every date
 * field here and for the same reason: "nobody has recorded this" is a real
 * state and has to stay reachable.
 */
const colourField = z
  .string()
  .trim()
  .refine((value) => value === "" || CAR_COLOUR_SLUGS.includes(value), {
    message: "colour",
  })
  .optional();

/**
 * An odometer reading, as the maintenance dialog submits it.
 *
 * A number *or* a string, because the same field is typed by hand and
 * sometimes resent unchanged from a payload that already parsed it. An empty
 * string clears the figure, exactly as it does for `mfkDate` and for the same
 * reason: "nobody has recorded this" is a real state, and the service warning
 * must stay silent in it rather than treating a missing reading as zero.
 *
 * Bounded at two million. A car that has genuinely covered more than that is
 * not in this fleet, and the bound is what stops a mistyped `1000000` — a
 * stuck key on the dashboard figure — from parking every service warning
 * permanently out of reach.
 */
const KM_MAX = 2_000_000;

const odometerField = z
  .union([z.number(), z.string()])
  .transform((value, ctx) => {
    if (typeof value === "string") {
      // Separators as a Swiss keyboard, a phone and a spreadsheet each
      // produce them — the same tolerance parseChf() extends to francs.
      const cleaned = value.replace(/[\s'’.]/g, "");
      if (cleaned === "") return null;
      if (!/^\d+$/.test(cleaned)) {
        ctx.addIssue({ code: "custom", message: "mileage" });
        return z.NEVER;
      }
      value = Number(cleaned);
    }
    if (!Number.isInteger(value) || value < 0 || value > KM_MAX) {
      ctx.addIssue({ code: "custom", message: "mileage" });
      return z.NEVER;
    }
    return value;
  })
  .optional();

export const newCarSchema = z.object({
  model: modelField,
  plate: plateField,
  vin: vinField,
  colour: colourField,
  mfkDate: mfkDateField,
  mfkLastDate: mfkLastDateField,
});

export type NewCar = z.infer<typeof newCarSchema>;

/**
 * An edit. Every field optional, but not all of them at once.
 *
 * `status` accepts only the two on-road states. A car becomes `rented` by a
 * handover and stops being `rented` by its rental being closed; neither is a
 * field the office types, so neither is representable here.
 */
export const updateCarSchema = z
  .object({
    model: modelField.optional(),
    plate: plateField.optional(),
    vin: vinField,
    colour: colourField,
    mfkDate: mfkDateField,
    mfkLastDate: mfkLastDateField,
    status: z.enum(["available", "maintenance", OFF_ROAD]).optional(),

    /// The service book. Every field independently optional, because the
    /// office learns these one at a time — the odometer at every handover,
    /// the due reading once a year off a sticker.
    currentMileageKm: odometerField,
    serviceDoneKm: odometerField,
    serviceDueKm: odometerField,
    serviceDoneOn: dayField("serviceDoneOn"),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "empty" });

export type UpdateCar = z.infer<typeof updateCarSchema>;

/**
 * Which status changes the office may make.
 *
 * A whitelist rather than a blacklist on purpose: anything involving `rented`
 * is refused by omission, so adding a status to the enum later cannot silently
 * make a new transition reachable.
 */
const ALLOWED = new Set([
  "available>retired",
  "retired>available",
  // The garage. `maintenance` was unused until the MFK pass started setting it
  // by itself — and a status the system can apply but the office cannot clear
  // would strand a car off the road with no way back through the dashboard.
  "available>maintenance",
  "maintenance>available",
  "maintenance>retired",
  "retired>maintenance",
  // No-ops, so a form that resubmits the current status is not an error.
  "available>available",
  "retired>retired",
  "maintenance>maintenance",
]);

export function statusChangeAllowed(from: CarStatus, to: CarStatus): boolean {
  return ALLOWED.has(`${from}>${to}`);
}

// ---------------------------------------------------------------------
// Repairs.
//
// The client's sketch showed two lines beneath the fleet table —
// "Repairs_done: bumpers, back right wheel replaced" and "Repairs-planned:
// windshield". Two text boxes would have been a smaller change and the wrong
// one: they cannot say when something was done, cannot be sorted, and lose
// the previous entry every time somebody types over them. A car's repair
// history is the first thing an insurer, a buyer or a damage dispute asks
// for.
//
// So each repair is a row with a state, and "planned" and "done" are one
// lifecycle rather than two lists — see the note on the model.
// ---------------------------------------------------------------------

/** Long enough for a paragraph off a garage invoice, short enough not to be
 *  a document store. */
const detailsField = z.string().trim().min(1, "details").max(500, "details");

/**
 * A repair cost in francs, as typed.
 *
 * Parsed here rather than in the endpoint so the tolerance about separators
 * lives beside every other field's. An empty string clears it — a repair
 * whose invoice has not arrived is a normal entry, and a zero would claim it
 * was free.
 */
const costField = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (value === "") return null;
    const cents = parseChf(value);
    if (cents === null) {
      ctx.addIssue({ code: "custom", message: "cost" });
      return z.NEVER;
    }
    return cents;
  })
  .optional();

const repairStatusField = z.enum(["planned", "done"]);

export const newRepairSchema = z.object({
  details: detailsField,
  /// Defaulted rather than required: the common entry is something noticed
  /// and not yet fixed, and making the office choose on every row would slow
  /// down the one thing this screen has to be fast at.
  status: repairStatusField.default("planned"),
  plannedFor: dayField("plannedFor"),
  doneOn: dayField("doneOn"),
  mileageKm: odometerField,
  costChf: costField,
});

export type NewRepair = z.infer<typeof newRepairSchema>;

/**
 * An edit, including the one that matters: planned becoming done.
 *
 * Every field optional and at least one required, as `updateCarSchema` has
 * it, so the row's "mark done" button can send `{ status: "done" }` alone.
 */
export const updateRepairSchema = z
  .object({
    details: detailsField.optional(),
    status: repairStatusField.optional(),
    plannedFor: dayField("plannedFor"),
    doneOn: dayField("doneOn"),
    mileageKm: odometerField,
    costChf: costField,
  })
  .refine((value) => Object.keys(value).length > 0, { message: "empty" });

export type UpdateRepair = z.infer<typeof updateRepairSchema>;

/**
 * The completion date a repair should end up with.
 *
 * Marking a repair done without naming a day is the common case — somebody
 * ticks it off the morning the car comes back from the garage — and a `done`
 * row with no date would be invisible in a history read as a chronology. So
 * today fills in, but only when the office has not said otherwise, and only
 * when the repair is actually becoming done. Clearing the status back to
 * planned clears the date with it, because a planned repair that still
 * carries a completion date reads as done to everything that sorts on it.
 *
 * Returns `undefined` for "do not touch this column", which is what lets the
 * endpoint spread the result into a Prisma update.
 */
export function resolveDoneOn(input: {
  /** The status after this edit, or undefined when the edit does not touch it. */
  status?: "planned" | "done";
  /** What the row holds now. */
  currentStatus: "planned" | "done";
  /** `doneOn` as submitted: a day, an empty string to clear, or absent. */
  doneOn?: string;
  /** Today in Zurich, `YYYY-MM-DD`. Passed in, never read from the clock. */
  today: string;
}): Date | null | undefined {
  const { status, currentStatus, doneOn, today } = input;
  const becomingDone = status === "done" && currentStatus !== "done";
  const becomingPlanned = status === "planned" && currentStatus !== "planned";

  // An explicit value always wins, including the empty string that clears it.
  if (doneOn !== undefined) {
    return doneOn === "" ? null : new Date(`${doneOn}T00:00:00.000Z`);
  }
  if (becomingDone) return new Date(`${today}T00:00:00.000Z`);
  if (becomingPlanned) return null;
  return undefined;
}
