/**
 * The reference printed on every contract.
 *
 * Replaces the Phase 1 stopgap — date plus plate digits plus a random suffix —
 * with a real sequence, which is what makes a number quotable on the phone and
 * countable in a report. The format keeps its shape, so numbers already issued
 * to customers stay recognisable.
 */

import { TZDate } from "@date-fns/tz";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { ZURICH } from "./terms";

/** `YYYYMMDD` as Zurich reckons the day, not as UTC does. */
function zurichDay(at: Date): string {
  const zoned = new TZDate(at.getTime(), ZURICH);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${zoned.getFullYear()}${pad(zoned.getMonth() + 1)}${pad(zoned.getDate())}`;
}

export function formatContractNumber(day: string, value: number): string {
  // padStart, not slice: on the day this office writes its ten-thousandth
  // contract the number should get longer, not start again at one.
  return `ZA-${day}-${String(value).padStart(4, "0")}`;
}

/**
 * Takes the next number for the day, atomically.
 *
 * `ON CONFLICT DO UPDATE ... RETURNING` is a single statement, so two
 * simultaneous handovers serialise on the counter row rather than racing.
 * Prisma has no upsert-and-increment-returning primitive, hence raw SQL.
 *
 * Accepts either the client or a transaction client, so the allocation can
 * join the contract transaction: a number handed out for a contract that then
 * rolls back would leave a gap, and a gap in a contract sequence is the kind
 * of thing an auditor asks about.
 */
export async function allocateContractNumber(
  tx: Prisma.TransactionClient | PrismaClient,
  organisationId: string,
  at: Date = new Date()
): Promise<string> {
  const day = zurichDay(at);

  const rows = await tx.$queryRaw<{ value: number }[]>`
    INSERT INTO "ContractCounter" ("organisationId", "day", "value")
    VALUES (${organisationId}, ${day}, 1)
    ON CONFLICT ("organisationId", "day")
    DO UPDATE SET "value" = "ContractCounter"."value" + 1
    RETURNING "value"
  `;

  return formatContractNumber(day, rows[0].value);
}
