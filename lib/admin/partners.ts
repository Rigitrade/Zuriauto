import { z } from "zod";
import { isValidCompanySlug } from "@/lib/company/slug";
import { newUserSchema } from "@/lib/admin/users";

/**
 * Creating a partner company from Konten (15.11.2026). Only what a partner
 * needs before its owner signs in: the name renters see, the registered name
 * that rents the car out (the lessor on the contract), its short name in
 * links, and the office address its renters' mails go out under (without it
 * no mail goes out in its name). The owner fills in the rest under Firma.
 */

/** Required, one line: these end up in mail headers and on the contract. */
const requiredLine = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((value) => !/[\r\n]/.test(value), "one line");

const EMAIL = /^[^\s@,]+@[^\s@,]+\.[^\s@,]{2,}$/;

export const newPartnerSchema = z
  .object({
    brandName: requiredLine(60),
    legalName: requiredLine(120),
    slug: z.string().trim().toLowerCase().refine(isValidCompanySlug, "slug"),
    officeEmail: z.string().trim().toLowerCase().max(200).refine((value) => EMAIL.test(value), "email"),
    owner: newUserSchema.pick({ displayName: true, username: true, password: true }).strict(),
  })
  .strict();

export type NewPartner = z.infer<typeof newPartnerSchema>;
