/**
 * Generates the weekly charge schedule for rentals created before Phase 3.
 *
 * Deliberately a script and not a migration. It decides what money to ask for,
 * and a human should read the plan before that happens — a migration would run
 * silently on deploy and start billing on the next cron.
 *
 * Dry by default. Pass --commit to write.
 *
 *   pnpm db:backfill-charges
 *   pnpm db:backfill-charges -- --commit
 */

import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { generateWeeklyCharges } from "../lib/rental/passes";
import { formatChf } from "../lib/rental/money";

async function main() {
  config({ path: ".env.local" });

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set.");

  const commit = process.argv.includes("--commit");
  const client = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    const rentals = await client.rental.findMany({
      where: {
        type: "WEEKLY",
        status: "ACTIVE",
        // Only rentals with no charges at all. A partially charged rental is
        // not something a bulk script should reason about.
        charges: { none: {} },
      },
      include: { car: true, customer: true },
    });

    if (rentals.length === 0) {
      console.log("[backfill] nothing to do — every active weekly rental has charges.");
      return;
    }

    console.log(
      `[backfill] ${rentals.length} rental(s) without charges${commit ? "" : " (dry run)"}\n`
    );

    let totalCents = 0;

    for (const rental of rentals) {
      if (rental.totalWeeks == null || rental.weeklyAmountCents == null) {
        console.warn(
          `  SKIP  ${rental.id} — weekly rental with no totalWeeks or weeklyAmountCents`
        );
        continue;
      }

      const schedule = generateWeeklyCharges({
        startAt: rental.startAt,
        fromWeek: 1,
        weeks: rental.totalWeeks,
        amountCents: rental.weeklyAmountCents,
      });

      const sum = schedule.reduce((n, c) => n + c.amountCents, 0);
      totalCents += sum;

      console.log(
        `  ${commit ? "WRITE" : " plan"}  ${rental.car.plate}  ${rental.customer.email}  ` +
          `${schedule.length} × CHF ${formatChf(rental.weeklyAmountCents)} = CHF ${formatChf(sum)}  ` +
          `first due ${schedule[0].dueDate.toISOString().slice(0, 10)}`
      );

      if (commit) {
        await client.charge.createMany({
          data: schedule.map((charge) => ({
            organisationId: rental.organisationId,
            rentalId: rental.id,
            weekNumber: charge.weekNumber,
            dueDate: charge.dueDate,
            amountCents: charge.amountCents,
            currency: rental.currency,
          })),
          skipDuplicates: true,
        });
      }
    }

    console.log(`\n[backfill] total across all rentals: CHF ${formatChf(totalCents)}`);

    if (!commit) {
      console.log("[backfill] nothing written. Re-run with --commit to apply.");
    } else {
      console.log(
        "[backfill] written. Charges whose due date has passed will be requested " +
          "on the next cron run — check the plan above before that happens."
      );
    }
  } finally {
    await client.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
