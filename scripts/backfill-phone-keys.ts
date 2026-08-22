/**
 * Fills Customer.phoneKey for rows written before the column existed.
 *
 * A script and not a migration because the normaliser is TypeScript:
 * reimplementing it as SQL regex would give one rule two implementations, and
 * they would drift the first time a country prefix was added. Running the real
 * function is the whole point.
 *
 * Dry by default. Pass --commit to write.
 *
 *   pnpm db:backfill-phone-keys
 *   pnpm db:backfill-phone-keys -- --commit
 */

import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { normalisePhone } from "../lib/rental/phone";

type Client = Pick<PrismaClient, "customer">;

/**
 * Returns how many rows were given a key. Exported so a test can drive it
 * against the test database rather than shelling out.
 */
export async function backfillPhoneKeys(
  client: Client,
  commit = true
): Promise<number> {
  const customers = await client.customer.findMany({
    where: { phoneKey: null },
    select: { id: true, phone: true },
  });

  let written = 0;
  for (const customer of customers) {
    const phoneKey = normalisePhone(customer.phone);
    // An unnormalisable number stays null. That row is simply not findable by
    // phone, which is the correct outcome and not an error.
    if (!phoneKey) continue;
    if (commit) {
      await client.customer.update({
        where: { id: customer.id },
        data: { phoneKey },
      });
    }
    written += 1;
  }
  return written;
}

async function main() {
  config({ path: ".env.local" });

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set.");

  const commit = process.argv.includes("--commit");
  const client = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    const pending = await client.customer.count({ where: { phoneKey: null } });
    const written = await backfillPhoneKeys(client, commit);

    console.log(
      `[backfill] ${pending} customer(s) without a phone key; ` +
        `${written} normalised, ${pending - written} unnormalisable` +
        `${commit ? "" : " (dry run)"}`
    );
    if (!commit) {
      console.log("[backfill] nothing written. Re-run with -- --commit to apply.");
    }
  } finally {
    await client.$disconnect();
  }
}

// Only when run directly, so importing this from a test does not start a job.
if (process.argv[1]?.includes("backfill-phone-keys")) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
