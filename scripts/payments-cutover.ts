/**
 * The cut-over: weeks due before the payments feature went live count as
 * settled (lib/payments/cutover.ts, the ledger spec decision 1).
 *
 * Dry by default. Pass --commit to write.
 *
 *   pnpm payments:cutover -- --before 2026-10-20
 *   pnpm payments:cutover -- --before 2026-10-20 --commit
 *
 * --before is a Zurich day; weeks due before its start are settled. Run once
 * per database, on the go-live day. A second run settles nothing. The office
 * reopens any week it knows is still unpaid.
 */

import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { zurichInstant } from "../lib/admin/rentalPeriod";
import { applyCutover, planCutover } from "../lib/payments/cutover";
import { formatChf } from "../lib/rental/money";

async function main() {
  config({ path: ".env.local" });

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set.");
  console.log(`database: ${new URL(connectionString).hostname}`);

  const at = process.argv.indexOf("--before");
  const day = at === -1 ? null : process.argv[at + 1];
  const before = day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? zurichInstant(`${day}T00:00`) : null;
  if (!before) throw new Error("Pass --before YYYY-MM-DD (a Zurich day).");
  const commit = process.argv.includes("--commit");

  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    const organisation = await client.organisation.findFirstOrThrow({ select: { id: true } });
    const planned = await planCutover(client, organisation.id, before);

    const rentals = await client.rental.findMany({
      where: { id: { in: [...new Set(planned.map((c) => c.rentalId))] } },
      select: { id: true, car: { select: { plate: true } }, customer: { select: { firstName: true, lastName: true } } },
    });
    const label = new Map(
      rentals.map((r) => [r.id, `${r.car.plate} · ${r.customer.firstName} ${r.customer.lastName.slice(0, 1)}.`.trim()])
    );

    console.log(`${planned.length} open week(s) due before ${day}${commit ? "" : " (dry run)"}\n`);
    let total = 0;
    for (const rentalId of new Set(planned.map((c) => c.rentalId))) {
      const weeks = planned.filter((c) => c.rentalId === rentalId);
      const sum = weeks.reduce((s, c) => s + c.amountCents, 0);
      total += sum;
      console.log(`  ${label.get(rentalId) ?? rentalId}`);
      console.log(`    ${weeks.map((c) => `W${c.weekNumber} ${c.status}`).join(", ")} · CHF ${formatChf(sum)}`);
    }
    console.log(`\n  total CHF ${formatChf(total)}`);

    if (!commit) {
      console.log("\nDry run: nothing was changed.");
      return;
    }
    console.log(await applyCutover(client, organisation.id, before));
  } finally {
    await client.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
