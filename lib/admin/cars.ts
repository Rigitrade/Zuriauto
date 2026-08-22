/**
 * The rules the fleet page enforces.
 *
 * Separated from the endpoints so the interesting parts — how a slug is built
 * and which status changes are permitted — can be tested without a database.
 */

import { z } from "zod";
import type { CarStatus } from "@/generated/prisma/client";

/** The one off-road state the office asked for. `maintenance` stays unused. */
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

export const newCarSchema = z.object({
  model: modelField,
  plate: plateField,
  vin: vinField,
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
    status: z.enum(["available", OFF_ROAD]).optional(),
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
  // No-ops, so a form that resubmits the current status is not an error.
  "available>available",
  "retired>retired",
]);

export function statusChangeAllowed(from: CarStatus, to: CarStatus): boolean {
  return ALLOWED.has(`${from}>${to}`);
}
