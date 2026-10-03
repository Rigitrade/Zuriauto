import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/session";
import { LETTER_CONTENT_TYPE, MAX_LETTER_BYTES, fineLetterKey } from "@/lib/fines/keys";
import { uploadTarget } from "@/lib/storage/presign";

/**
 * A slot for one scanned letter: where to PUT it, under which key.
 *
 * The first of three steps — see lib/storage/presign.ts for why the file
 * goes straight to the bucket. Nothing is written here; a slot nobody uses
 * costs nothing. The hash is asked for now so the same scan is turned away
 * before it is uploaded a second time, with the document it duplicates.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await requireAdmin(request);
  if (!user) {
    return NextResponse.json({ code: "unauthorised" }, { status: 401 });
  }

  let body: { sha256?: unknown; bytes?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ code: "bad-request" }, { status: 400 });
  }
  const { sha256, bytes } = body;
  if (typeof sha256 !== "string" || !/^[0-9a-f]{64}$/.test(sha256) || typeof bytes !== "number") {
    return NextResponse.json({ code: "bad-request" }, { status: 400 });
  }
  if (bytes <= 0 || bytes > MAX_LETTER_BYTES) {
    return NextResponse.json({ code: "too-large", maxBytes: MAX_LETTER_BYTES }, { status: 413 });
  }

  const organisation = await prisma.organisation.findFirstOrThrow({ select: { id: true } });
  const existing = await prisma.fineDocument.findUnique({
    where: { organisationId_sha256: { organisationId: organisation.id, sha256 } },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ code: "duplicate", documentId: existing.id }, { status: 409 });
  }

  const documentId = randomUUID();
  const key = fineLetterKey(documentId);
  const target = await uploadTarget(key, LETTER_CONTENT_TYPE);
  return NextResponse.json({ documentId, key, ...target });
}
