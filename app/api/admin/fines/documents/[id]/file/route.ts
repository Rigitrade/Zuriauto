import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/session";
import { getAssetStore } from "@/lib/storage";

/**
 * A fine letter, for the dashboard's preview.
 *
 * Audited like a contract: matched to a rental, the letter says where a named
 * person was at a given minute. Who opened it is written before the bytes are
 * read, so a failed read is still a recorded attempt. Streamed through the
 * handler, never a presigned link that could be forwarded.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin(request);
  if (!user) {
    return NextResponse.json({ code: "unauthorised" }, { status: 401 });
  }
  const { id } = await params;
  const document = await prisma.fineDocument.findUnique({
    where: { id },
    select: { storageKey: true },
  });
  if (!document) {
    return NextResponse.json({ code: "not-found" }, { status: 404 });
  }

  await prisma.assetAccess.create({
    data: { fineDocumentId: id, userId: user.id, username: user.username },
  });

  const object = await getAssetStore().get(document.storageKey);
  if (!object) {
    return NextResponse.json({ code: "gone" }, { status: 410 });
  }
  return new NextResponse(object.body as unknown as BodyInit, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": "inline; filename=busse.pdf",
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
