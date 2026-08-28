/**
 * Per-IP submission limiting, backed by the database.
 *
 * Replaces a module-scope `Map` whose own comment admitted the problem: it
 * reset on every cold start and was not shared between concurrent instances,
 * so on a serverless platform it blunted a naive script and little else.
 *
 * Two entry points share the same window/scope arithmetic: `rateLimited`
 * records an attempt and reports whether the budget is spent, for a caller
 * that wants to charge every attempt (the pickup form, where every submission
 * — successful or not — is the thing worth limiting). `rateLimitExceeded`
 * only reports, for a caller that wants to charge failures alone (sign-in,
 * where a correct password must not spend the budget a wrong one would).
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

export interface RateLimitOptions {
  /** Which fence is asking. Budgets never cross scopes. */
  scope?: string;
  max?: number;
  windowMs?: number;
}

interface ResolvedOptions {
  scope: string;
  max: number;
  windowMs: number;
}

function resolveOptions(options: RateLimitOptions): ResolvedOptions {
  return {
    scope: options.scope ?? "pickup",
    max: options.max ?? RATE_LIMIT.max,
    windowMs: options.windowMs ?? RATE_LIMIT.windowMs,
  };
}

/** Expired rows are deleted on the way past, which keeps the table bounded
 * without a scheduled job. Swept across every scope: an expired row is
 * expired whoever wrote it. */
async function sweepExpired(client: PrismaClient, windowStart: Date): Promise<void> {
  await client.submissionAttempt.deleteMany({
    where: { createdAt: { lt: windowStart } },
  });
}

async function countInWindow(
  client: PrismaClient,
  ipHash: string,
  scope: string,
  windowStart: Date
): Promise<number> {
  return client.submissionAttempt.count({
    where: { scope, ipHash, createdAt: { gte: windowStart } },
  });
}

/**
 * Records this attempt and reports whether it should be refused.
 *
 * Records first, then counts, so a failure between the two cannot be turned
 * into a free attempt.
 *
 * `now` stays the third parameter and `options` the fourth so that adding
 * scopes did not have to touch every existing call.
 */
export async function rateLimited(
  client: PrismaClient,
  ip: string,
  now: Date = new Date(),
  options: RateLimitOptions = {}
): Promise<boolean> {
  const { scope, max, windowMs } = resolveOptions(options);
  const ipHash = hashIp(ip);
  const windowStart = new Date(now.getTime() - windowMs);

  await sweepExpired(client, windowStart);

  await client.submissionAttempt.create({
    data: { ipHash, scope, createdAt: now },
  });

  const attempts = await countInWindow(client, ipHash, scope, windowStart);
  return attempts > max;
}

/**
 * Reports whether the budget is already spent, without recording an attempt.
 *
 * For a caller that only wants to charge failures — a correct password must
 * not itself spend the budget meant for wrong ones — the check has to happen
 * before the thing that might fail, and only the failure path records.
 */
export async function rateLimitExceeded(
  client: PrismaClient,
  ip: string,
  now: Date = new Date(),
  options: RateLimitOptions = {}
): Promise<boolean> {
  const { scope, max, windowMs } = resolveOptions(options);
  const ipHash = hashIp(ip);
  const windowStart = new Date(now.getTime() - windowMs);

  await sweepExpired(client, windowStart);

  const attempts = await countInWindow(client, ipHash, scope, windowStart);
  return attempts > max;
}
