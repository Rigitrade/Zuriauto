/**
 * The payment's timeline — how the office answers "who decided this was
 * Anna's week 3?" months later. The FineEvent pattern, keyed by payment.
 */

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { Actor } from "@/lib/fines/events";

type Client = PrismaClient | Prisma.TransactionClient;

export async function recordPaymentEvent(
  client: Client,
  paymentId: string,
  type: string,
  payload: Record<string, unknown> = {},
  actor: Actor | null = null
): Promise<void> {
  await client.paymentEvent.create({
    data: {
      paymentId,
      type,
      payload: payload as Prisma.InputJsonValue,
      actorId: actor?.id ?? null,
      actorName: actor?.displayName ?? null,
    },
  });
}
