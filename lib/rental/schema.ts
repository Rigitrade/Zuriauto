/**
 * Validation for the pickup contract.
 *
 * The same schema runs in the browser before the PDF is built and again in the
 * route handler before anything is emailed, so a crafted request cannot skip
 * checks the form enforces.
 */

import { z } from "zod";
import { isKnownCountry } from "./countries";
import { FUEL_LEVELS } from "./fleet";

const required = (message: string) => z.string().trim().min(1, message);

/** Contract data as captured by the form. Images are carried separately. */
export const contractDetailsSchema = z.object({
  vehicleId: required("vehicle"),
  mileageKm: z
    .number({ message: "mileage" })
    .int("mileage")
    .min(0, "mileage")
    // A car reading over two million km is a typo, not a vehicle.
    .max(2_000_000, "mileage"),
  fuelLevel: z.enum(FUEL_LEVELS),
  existingDamage: z.string().trim().max(2000).default(""),

  lastName: required("required").max(100),
  firstName: required("required").max(100),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "birthDate")
    .refine((value) => !Number.isNaN(Date.parse(value)), "birthDate")
    .refine((value) => ageOn(value) >= 18, "minor")
    .refine((value) => ageOn(value) < 120, "birthDate"),
  street: required("required").max(200),
  postalCode: required("required").max(20),
  city: required("required").max(100),
  // Validated against the list rather than accepted as free text, so the
  // address on a signed contract cannot say "Schweizz".
  country: required("country").refine(isKnownCountry, "country"),
  mobile: required("required").max(40),
  email: z.email("email").max(200),

  gtcAccepted: z.literal(true, { message: "gtc" }),
  gtcVersion: required("required"),
  gtcLanguage: z.enum(["de", "en", "fr"]),
  /** ISO timestamp recorded the moment the box was ticked. */
  acceptedAt: z.string().min(1),
  place: z.string().trim().max(100).default(""),
});

export type ContractDetails = z.infer<typeof contractDetailsSchema>;

/**
 * Whole years elapsed on today's date. Kept separate from the schema so the
 * age rules read as rules rather than date arithmetic.
 */
export function ageOn(birthDate: string, today: Date = new Date()): number {
  const born = new Date(birthDate);
  let age = today.getFullYear() - born.getFullYear();
  const monthDelta = today.getMonth() - born.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < born.getDate())) {
    age -= 1;
  }
  return age;
}

/**
 * What the route handler receives alongside the PDF. It exists so the email
 * subject and recipient can be built without parsing the attachment.
 */
export const contractMetaSchema = z.object({
  contractNumber: z.string().trim().min(1).max(64),
  customerName: z.string().trim().min(1).max(200),
  customerEmail: z.email().max(200),
  vehicleLabel: z.string().trim().min(1).max(200),
  plate: z.string().trim().min(1).max(40),
  mileageKm: z.number().int().min(0).max(2_000_000),
  language: z.enum(["de", "en"]),
});

export type ContractMeta = z.infer<typeof contractMetaSchema>;

/**
 * Builds the reference printed on the contract.
 *
 * Nothing is stored in Phase 1, so there is no sequence to draw from and no
 * way to check for collisions. Date plus plate digits plus a random suffix
 * makes a repeat vanishingly unlikely; Phase 2 replaces this with a real
 * sequence backed by the rentals table.
 */
export function buildContractNumber(plate: string, now: Date = new Date()): string {
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");

  const plateDigits = plate.replace(/\D/g, "").slice(-6) || "000000";

  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  const random = new Uint8Array(4);
  crypto.getRandomValues(random);
  for (const byte of random) suffix += alphabet[byte % alphabet.length];

  return `ZA-${stamp}-${plateDigits}-${suffix}`;
}
