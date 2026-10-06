/**
 * One uploaded letter, read and routed.
 *
 * Idempotent and safe to run twice at once: the document is claimed by a
 * conditional update, so of two runners — the upload's own `after()` and the
 * daily retry pass, say — one processes it and the other is told to skip.
 * A failure is recorded on the document and retried later, up to three
 * attempts; after that the dashboard shows it as failed.
 */

import type { Prisma } from "@/generated/prisma/client";
import { attachDocument, type FineDeps } from "./attach";

export type { FineDeps } from "./attach";

export const MAX_ATTEMPTS = 3;

/**
 * A reading takes a minute or two. A PROCESSING claim older than this
 * belongs to a function that was killed — a timeout, memory — and may be
 * taken over; otherwise the letter would sit "being read" for good.
 */
export const STALE_CLAIM_MS = 10 * 60 * 1000;

/** Letters a run may claim: waiting, failed, or abandoned mid-read. */
export function claimable(now: Date): Prisma.FineDocumentWhereInput {
  return {
    attempts: { lt: MAX_ATTEMPTS },
    OR: [
      { status: { in: ["UPLOADED", "FAILED"] } },
      { status: "PROCESSING", claimedAt: { lt: new Date(now.getTime() - STALE_CLAIM_MS) } },
    ],
  };
}

export async function processFineDocument(
  deps: FineDeps,
  documentId: string
): Promise<"processed" | "skipped" | "failed"> {
  const { client, store, reader, now } = deps;

  const claimed = await client.fineDocument.updateMany({
    where: { id: documentId, ...claimable(now) },
    data: { status: "PROCESSING", claimedAt: now, attempts: { increment: 1 } },
  });
  if (claimed.count === 0) return "skipped";

  const document = await client.fineDocument.findUniqueOrThrow({
    where: { id: documentId },
    select: { id: true, organisationId: true, storageKey: true },
  });

  try {
    const object = await store.get(document.storageKey);
    if (!object) throw new Error(`The stored letter is missing: ${document.storageKey}`);

    const read = await reader.read(object.body, now);
    await client.fineDocument.update({
      where: { id: documentId },
      data: {
        status: "PROCESSED",
        processedAt: now,
        error: null,
        kind: read.extraction.kind,
        language: read.language,
        reader: reader.name,
        qrText: read.qrText,
        ocrText: read.ocrText,
        extraction: read.extraction as unknown as Prisma.InputJsonValue,
      },
    });

    await attachDocument(deps, document, read);
    return "processed";
  } catch (error) {
    console.error(`[fines] processing ${documentId} failed:`, error);
    await client.fineDocument.update({
      where: { id: documentId },
      data: { status: "FAILED", error: String(error).slice(0, 500) },
    });
    return "failed";
  }
}
