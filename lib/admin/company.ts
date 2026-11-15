import { z } from "zod";

/**
 * What a company's owner may set about the company (multi-company phase B,
 * 15.11.2026): the details its documents and mails carry. The company's name
 * and its short name in links are Ahmed's to set (phase D), so they are not
 * here, and a request naming them is refused.
 *
 * Every field is optional in a request, and an empty string clears it.
 */

/** One line of text: trimmed, no line breaks (it ends up in mail headers). */
const line = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((value) => !/[\r\n]/.test(value), "one line")
    .transform((value) => (value === "" ? null : value))
    .nullable();

const EMAIL = /^[^\s@,]+@[^\s@,]+\.[^\s@,]{2,}$/;

/** "a@b.ch, c@d.ch": each checked, lower-cased, joined the same way. */
const emailList = z
  .string()
  .trim()
  .max(300)
  .transform((value) =>
    value
      .split(",")
      .map((address) => address.trim().toLowerCase())
      .filter(Boolean)
  )
  .refine((addresses) => addresses.every((address) => EMAIL.test(address)), "email")
  .transform((addresses) => (addresses.length ? addresses.join(", ") : null))
  .nullable();

/** A website as the documents print it: "meier-cars.ch", no scheme or slash. */
const website = z
  .string()
  .trim()
  .max(100)
  .transform((value) => value.toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, ""))
  .refine((value) => value === "" || /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(value), "website")
  .transform((value) => (value === "" ? null : value))
  .nullable();

/** A payment page: https only, since a renter pays on it. */
const paymentLink = z
  .string()
  .trim()
  .max(500)
  .refine((value) => value === "" || /^https:\/\/[^\s]+$/.test(value), "https")
  .transform((value) => (value === "" ? null : value))
  .nullable();

export const companySettingsSchema = z
  .object({
    brandName: line(60),
    legalName: line(120),
    street: line(120),
    postalCode: line(12),
    city: line(80),
    uid: line(30),
    phone: line(40),
    officeEmail: emailList,
    signerName: line(80),
    website,
    signingPlace: line(80),
    paymentUrl: paymentLink,
    twintUrl: paymentLink,
  })
  .partial()
  .strict();

export type CompanySettingsInput = z.infer<typeof companySettingsSchema>;

/** The columns the settings page shows and saves. */
export const COMPANY_SETTINGS_COLUMNS = {
  brandName: true,
  legalName: true,
  street: true,
  postalCode: true,
  city: true,
  uid: true,
  phone: true,
  officeEmail: true,
  signerName: true,
  website: true,
  signingPlace: true,
  paymentUrl: true,
  twintUrl: true,
} as const;
