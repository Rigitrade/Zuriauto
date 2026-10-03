import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/session";
import {
  LETTER_CONTENT_TYPE,
  MAX_LETTER_BYTES,
  MAX_LETTER_PAGES,
  isLetterKeyOf,
} from "@/lib/fines/keys";
import { pdfPageCount } from "@/lib/fines/raster";
import { getAssetStore } from "@/lib/storage";

/**
 * A letter that has been uploaded to its slot, recorded.
 *
 * The bytes are read back and checked here, because the slot only promised
 * a key: whoever PUT to it could have put anything. It must be a PDF, of the
 * size and hash the slot was asked for, with a sane number of pages.
 *
 * The same scan registered twice at once — two people at the desk with the
 * same pile — is settled by the database's unique hash, not by a check that
 * both requests could pass.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string })?.code === "P2002";
}

export async function POST(request: Request) {
  const user = await requireAdmin(request);
  if (!user) {
    return NextResponse.json({ code: "unauthorised" }, { status: 401 });
  }

  let body: { documentId?: unknown; key?: unknown; sha256?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ code: "bad-request" }, { status: 400 });
  }
  const { documentId, key, sha256 } = body;
  if (
    typeof documentId !== "string" ||
    !/^[0-9a-f-]{36}$/.test(documentId) ||
    typeof key !== "string" ||
    !isLetterKeyOf(documentId, key) ||
    typeof sha256 !== "string"
  ) {
    return NextResponse.json({ code: "bad-request" }, { status: 400 });
  }

  const store = getAssetStore();
  const object = await store.get(key);
  if (!object) {
    return NextResponse.json({ code: "not-uploaded" }, { status: 404 });
  }

  const bytes = object.body;
  const refuse = async (code: string, status: number) => {
    // A refused upload leaves nothing behind in the bucket either.
    await store.remove(key).catch(() => undefined);
    return NextResponse.json({ code }, { status });
  };

  if (bytes.byteLength > MAX_LETTER_BYTES) return refuse("too-large", 413);
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") return refuse("not-a-pdf", 415);
  if (createHash("sha256").update(bytes).digest("hex") !== sha256) return refuse("hash-mismatch", 400);

  let pages: number;
  try {
    pages = await pdfPageCount(bytes);
  } catch {
    return refuse("not-a-pdf", 415);
  }
  if (pages < 1 || pages > MAX_LETTER_PAGES) return refuse("too-many-pages", 413);

  const organisation = await prisma.organisation.findFirstOrThrow({ select: { id: true } });
  try {
    await prisma.fineDocument.create({
      data: {
        id: documentId,
        organisationId: organisation.id,
        storageKey: key,
        sha256,
        bytes: bytes.byteLength,
        pages,
        uploadedById: user.id,
        uploadedByName: user.displayName,
      },
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const existing = await prisma.fineDocument.findUnique({
      where: { organisationId_sha256: { organisationId: organisation.id, sha256 } },
      select: { id: true },
    });
    await store.remove(key).catch(() => undefined);
    return NextResponse.json({ code: "duplicate", documentId: existing?.id ?? null }, { status: 409 });
  }

  // Bytes stored under the content type the slot named, whatever the PUT
  // claimed: it has just been checked to be a PDF.
  if (object.contentType !== LETTER_CONTENT_TYPE) {
    await store.put(key, bytes, LETTER_CONTENT_TYPE);
  }

  return NextResponse.json({ documentId }, { status: 201 });
}
