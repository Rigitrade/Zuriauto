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
import { rentalTermsSchema } from "./terms";

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

  /**
   * The commercial terms, entered at handover.
   *
   * Nested rather than flattened, so the discriminated union survives: a
   * fixed-term rental carrying a weekly amount has to be unrepresentable, and
   * flattening the two shapes into sibling optional fields would make it
   * merely discouraged.
   */
  terms: rentalTermsSchema,

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

  /**
   * The full validated detail, not a summary.
   *
   * Phase 1 sent a summary because the handler only had to address an email.
   * It now writes the system of record, and re-validating what the browser
   * claims is the whole reason this schema runs on both sides.
   */
  details: contractDetailsSchema,

  /**
   * Permission to carry an earlier contract's identity documents forward,
   * issued by the lookup endpoint. Verified in the route — the schema only
   * establishes that a string arrived.
   */
  reuseToken: z.string().trim().min(1).max(512).optional(),
  /** The staff member's confirmation that they saw the original documents. */
  identityChecked: z.boolean().optional(),
}).superRefine((value, context) => {
  // Enforced here as well as in the form, for the reason stated at the top of
  // this file: the schema runs on both sides so a crafted request cannot skip a
  // check the wizard makes. This is the same kind of rule as gtcAccepted's
  // z.literal(true) — a claim about what a person did, which has to stand
  // behind the contract afterwards.
  if (value.reuseToken && value.identityChecked !== true) {
    context.addIssue({
      code: "custom",
      path: ["identityChecked"],
      message: "identityCheck",
    });
  }
});

export type ContractMeta = z.infer<typeof contractMetaSchema>;

/**
 * Builds the reference printed on the contract when the database cannot be
 * reached.
 *
 * From Phase 2 the number normally comes from `allocateContractNumber` in
 * `lib/rental/contractNumber.ts`, backed by a real sequence. This remains as
 * the offline fallback the wizard uses when the write path is unavailable and
 * the office falls back to downloading the PDF and mailing it by hand: the
 * random suffix makes a collision with a sequenced number vanishingly
 * unlikely, and its longer shape marks it as unsequenced at a glance.
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
