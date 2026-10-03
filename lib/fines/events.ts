/**
 * The fine's timeline — what the office reads when a renter says "I already
 * paid". Every transition, email and correction writes one.
 */

import type { Prisma, PrismaClient } from "@/generated/prisma/client";

export interface Actor {
  id: string;
  displayName: string;
}

type Client = PrismaClient | Prisma.TransactionClient;

export async function recordEvent(
  client: Client,
  fineId: string,
  type: string,
  payload: Record<string, unknown> = {},
  actor: Actor | null = null,
  at?: Date
): Promise<void> {
  await client.fineEvent.create({
    data: {
      fineId,
      type,
      payload: payload as Prisma.InputJsonValue,
      actorId: actor?.id ?? null,
      actorName: actor?.displayName ?? null,
      ...(at ? { createdAt: at } : {}),
    },
  });
}
