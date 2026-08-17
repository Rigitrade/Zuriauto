import { config } from "dotenv";

/**
 * Nothing but the environment.
 *
 * Kept in its own setup file, listed before `setup.ts`, so that no import in
 * this module graph can reach the Prisma client before DATABASE_URL is set.
 */
config({ path: ".env.test" });
