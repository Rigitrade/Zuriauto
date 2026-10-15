/**
 * Every fetched email through `ingestMail`, counted.
 *
 * One email that throws is logged and counted as "failed"; the rest are still
 * read. It stays in the mailbox, so the next run tries it again.
 */

import type { PrismaClient } from "@/generated/prisma/client";
import { ingestMail, type IngestOutcome, type RawMail } from "./ingest";

export async function twintPaymentPass(deps: {
  client: PrismaClient;
  fetchMails: () => Promise<RawMail[]>;
  verify?: (raw: Buffer) => Promise<boolean>;
}): Promise<Record<IngestOutcome | "failed", number>> {
  const organisation = await deps.client.organisation.findFirstOrThrow({ select: { id: true } });
  const counts: Record<IngestOutcome | "failed", number> = {
    booked: 0,
    review: 0,
    duplicate: 0,
    unsigned: 0,
    unreadable: 0,
    "other-store": 0,
    failed: 0,
  };
  for (const mail of await deps.fetchMails()) {
    try {
      counts[await ingestMail({ client: deps.client, organisationId: organisation.id, verify: deps.verify }, mail)] += 1;
    } catch (error) {
      console.error(`[twint] uid ${mail.uid} failed:`, error);
      counts.failed += 1;
    }
  }
  return counts;
}
