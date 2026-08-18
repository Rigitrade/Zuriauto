/**
 * Per-IP submission limiting, backed by the database.
 *
 * Replaces a module-scope `Map` whose own comment admitted the problem: it
 * reset on every cold start and was not shared between concurrent instances,
 * so on a serverless platform it blunted a naive script and little else.
 */

import { createHash } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";

export const RATE_LIMIT = { max: 5, windowMs: 10 * 60 * 1000 };

/**
 * The address as stored: salted SHA-256, never the address itself.
 *
 * An IP is personal data, and a table of them accumulating indefinitely would
 * be a new obligation created for the sake of a spam check. The salt means the
 * table cannot be reversed by hashing the whole IPv4 space.
 */
export function hashIp(ip: string): string {
  return createHash("sha256")
    .update(`${process.env.RATE_LIMIT_SALT ?? ""}:${ip}`)
    .digest("hex");
}

/**
 * Records this attempt and reports whether it should be refused.
 *
 * Records first, then counts, so a failure between the two cannot be turned
 * into a free attempt. Expired rows are deleted on the way past, which keeps
 * the table bounded without a scheduled job — there is no scheduler until
 * Phase 3.
 */
export async function rateLimited(
  client: PrismaClient,
  ip: string,
  now: Date = new Date()
): Promise<boolean> {
  const ipHash = hashIp(ip);
  const windowStart = new Date(now.getTime() - RATE_LIMIT.windowMs);

  await client.submissionAttempt.deleteMany({
    where: { createdAt: { lt: windowStart } },
  });

  await client.submissionAttempt.create({ data: { ipHash, createdAt: now } });

  const attempts = await client.submissionAttempt.count({
    where: { ipHash, createdAt: { gte: windowStart } },
  });

  return attempts > RATE_LIMIT.max;
}
