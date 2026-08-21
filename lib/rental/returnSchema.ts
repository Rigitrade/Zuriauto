/**
 * Validation for the vehicle return form.
 *
 * Same double duty as `schema.ts`: the browser runs it before the PDF is
 * built, the route handler runs it again before anything is emailed, so a
 * crafted request cannot skip checks the form enforces.
 */

import { z } from "zod";
import { FUEL_LEVELS } from "./fleet";

/**
 * How the customer settled the rental. Checkboxes on the form, since a rental
 * can legitimately be paid part in cash and part by card.
 */
export const PAYMENT_METHODS = ["cash", "twint", "card", "bank"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/**
 * Radio answers are carried as "yes"/"no" rather than booleans so an
 * unanswered question is distinguishable from an answered "no" — the form
 * must not default any of these on a signed document.
 */
const yesNo = z.enum(["yes", "no"], { message: "required" });

const required = (message: string) => z.string().trim().min(1, message);

export const returnDetailsSchema = z
  .object({
    vehicleId: required("vehicle"),
    mileageKm: z
      .number({ message: "mileage" })
      .int("mileage")
      .min(0, "mileage")
      .max(2_000_000, "mileage"),
    papersInside: yesNo,
    keyReturned: yesNo,
    fuelLevel: z.enum(FUEL_LEVELS),
    cleanliness: z.enum(["clean", "needsWash"], { message: "required" }),
    damages: z.string().trim().max(2000).default(""),

    tickets: yesNo,
    ticketsNote: z.string().trim().max(1000).default(""),

    fullyPaid: yesNo,
    paymentMethods: z.array(z.enum(PAYMENT_METHODS)).max(4).default([]),
    hasDuePayment: yesNo,
    /** ISO date the outstanding amount will be paid on. */
    dueDate: z.string().trim().default(""),
    dueMethod: z.enum(PAYMENT_METHODS).optional(),

    depositBack: yesNo,

    lastName: required("required").max(100),
    firstName: required("required").max(100),
    email: z.email("email").max(200),
    place: z.string().trim().max(100).default(""),
  })
  .superRefine((value, context) => {
    // A "paid in full" without a method says nothing the office can act on.
    if (value.fullyPaid === "yes" && value.paymentMethods.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["paymentMethods"],
        message: "paymentMethod",
      });
    }

    if (value.hasDuePayment === "yes") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value.dueDate)) {
        context.addIssue({
          code: "custom",
          path: ["dueDate"],
          message: "dueDate",
        });
      }
      if (!value.dueMethod) {
        context.addIssue({
          code: "custom",
          path: ["dueMethod"],
          message: "required",
        });
      }
    }
  });

export type ReturnDetails = z.infer<typeof returnDetailsSchema>;

/**
 * What the return route receives alongside the PDF, mirroring
 * `contractMetaSchema`: enough to address the emails without parsing the
 * attachment.
 */
export const returnMetaSchema = z.object({
  returnNumber: z.string().trim().min(1).max(64),
  customerName: z.string().trim().min(1).max(200),
  customerEmail: z.email().max(200),
  vehicleLabel: z.string().trim().min(1).max(200),
  plate: z.string().trim().min(1).max(40),
  mileageKm: z.number().int().min(0).max(2_000_000),
  language: z.enum(["de", "en"]),
});

export type ReturnMeta = z.infer<typeof returnMetaSchema>;

/**
 * Reference printed on the return document. Same construction as the pickup
 * contract number and for the same reason — nothing is stored in Phase 1, so
 * date + plate digits + random suffix stands in for a real sequence. The ZR
 * prefix keeps a return visually distinct from a ZA pickup in an inbox.
 */
export function buildReturnNumber(plate: string, now: Date = new Date()): string {
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

  return `ZR-${stamp}-${plateDigits}-${suffix}`;
}
