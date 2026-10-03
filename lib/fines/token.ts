/**
 * The renter's link for confirming a fine was paid.
 *
 * The manage link's machinery — 32 random bytes, only the hash stored — with
 * one difference: it is not burned by using it. A screenshot that cannot be
 * read must be retryable from the same email, so the link stays good while
 * the fine is open and is burned only when the fine leaves the states a
 * renter can act on. A fine sent again gets a fresh link and the old one
 * stops working.
 */

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { generateToken, hashToken, tokenIsUsable } from "@/lib/rental/actionToken";

type Client = PrismaClient | Prisma.TransactionClient;

/** Long enough for a renter on holiday; short enough not to live forever. */
export const FINE_TOKEN_DAYS_AFTER_DUE = 60;
const DEFAULT_DUE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/** States in which the renter may still tell us they paid. */
export const PAYABLE_STATUSES = ["NOTIFIED", "PROOF_SUBMITTED"] as const;

export function finePayUrl(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/$/, "")}/fines/pay/?t=${token}`;
}

export async function issueFinePaymentToken(
  client: Client,
  fine: { id: string; organisationId: string; rentalId: string; dueDate: Date | null },
  now: Date
): Promise<string> {
  await burnFineTokens(client, fine.id, now);
  const due = fine.dueDate ?? new Date(now.getTime() + DEFAULT_DUE_DAYS * DAY_MS);
  const token = generateToken();
  await client.actionToken.create({
    data: {
      organisationId: fine.organisationId,
      rentalId: fine.rentalId,
      fineId: fine.id,
      purpose: "FINE_PAYMENT",
      tokenHash: hashToken(token),
      expiresAt: new Date(due.getTime() + FINE_TOKEN_DAYS_AFTER_DUE * DAY_MS),
    },
  });
  return token;
}

export async function burnFineTokens(client: Client, fineId: string, now: Date): Promise<void> {
  await client.actionToken.updateMany({
    where: { fineId, purpose: "FINE_PAYMENT", usedAt: null },
    data: { usedAt: now },
  });
}

export type ResolvedFineToken =
  | { ok: true; tokenId: string; fineId: string }
  | { ok: false };

/**
 * Unknown, expired, burned, or a fine no longer open: all one answer, so the
 * page cannot be used to learn which.
 */
export async function resolveFinePaymentToken(
  client: Client,
  token: string,
  now: Date
): Promise<ResolvedFineToken> {
  if (!token) return { ok: false };
  const row = await client.actionToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      purpose: true,
      expiresAt: true,
      usedAt: true,
      fine: { select: { id: true, status: true } },
    },
  });
  if (!row || row.purpose !== "FINE_PAYMENT" || !row.fine || !tokenIsUsable(row, now)) {
    return { ok: false };
  }
  if (!(PAYABLE_STATUSES as readonly string[]).includes(row.fine.status)) return { ok: false };
  return { ok: true, tokenId: row.id, fineId: row.fine.id };
}
