/**
 * The rules the accounts page enforces.
 *
 * Separated from the endpoints so the interesting parts — what a username may
 * contain, and what a patch is allowed to be — can be tested without a
 * database, exactly as lib/admin/cars.ts is.
 */

import { z } from "zod";

/**
 * Lowercase, and narrow on purpose.
 *
 * A username is typed at a login screen by somebody in a hurry, so anything
 * that renders two ways — accents, spaces, mixed case — is a support call.
 * Display names carry the real spelling.
 */
export const USERNAME_PATTERN = /^[a-z0-9._-]{3,32}$/;

const username = z
  .string()
  .trim()
  .toLowerCase()
  .refine((value) => USERNAME_PATTERN.test(value), "username");

/** Long enough that scrypt is not the only thing standing in the way. */
const password = z.string().min(10, "password").max(200, "password");

const displayName = z.string().trim().min(1, "displayName").max(100, "displayName");

const role = z.enum(["owner", "staff"]).default("staff");

export const newUserSchema = z.object({
  username,
  displayName,
  password,
  role,
});

export type NewUser = z.infer<typeof newUserSchema>;

/**
 * An edit. Every field optional, but not all of them at once.
 *
 * The username is absent deliberately: it is what somebody types to sign in,
 * and renaming it silently breaks their muscle memory for no gain. Create a
 * new account instead.
 */
export const updateUserSchema = z
  .object({
    displayName: displayName.optional(),
    password: password.optional(),
    role: z.enum(["owner", "staff"]).optional(),
    disabled: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "empty" });

export type UpdateUser = z.infer<typeof updateUserSchema>;
