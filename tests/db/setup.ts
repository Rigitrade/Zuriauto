import { afterAll, beforeEach } from "vitest";
import { prisma } from "@/lib/db";

/**
 * Empties the database between tests.
 *
 * Truncating rather than dropping and re-migrating: the schema is stable
 * within a run, and re-migrating per file would dominate the suite's runtime.
 * `CASCADE` takes the foreign keys with it, so the order of the list does not
 * have to be maintained as the schema grows.
 */
export async function resetDatabase(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "Asset", "RentalEvent", "Contract", "Rental",
      "Customer", "Car", "ContractCounter", "SubmissionAttempt",
      -- No foreign key, so CASCADE from another table never reaches it.
      "CustomerLookup", "Organisation"
    RESTART IDENTITY CASCADE
  `);
}

beforeEach(resetDatabase);

// Without this the pool keeps the worker alive and Vitest waits on it.
afterAll(async () => {
  await prisma.$disconnect();
});
