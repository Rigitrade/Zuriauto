import { config } from "dotenv";

/**
 * Nothing but the environment.
 *
 * Kept in its own setup file, listed before `setup.ts`, so that no import in
 * this module graph can reach the Prisma client before DATABASE_URL is set.
 */
config({ path: ".env.test" });

// The suites date their rentals in mid-2026, before production's reminders
// started (see remindersStart in lib/rental/passes.ts). A test about that
// cut-off sets it itself.
process.env.REMINDERS_START ??= "2000-01-01";
