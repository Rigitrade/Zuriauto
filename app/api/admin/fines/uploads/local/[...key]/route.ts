import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/session";
import { notFound } from "@/lib/admin/scope";
import { MAX_LETTER_BYTES } from "@/lib/fines/keys";
import { getAssetStore } from "@/lib/storage";

/**
 * The upload slot when there is no bucket: development and tests.
 *
 * Stands in for the presigned R2 URL so the dashboard's upload code is the
 * same everywhere. It does not exist where R2 is configured or in production
 * — a function-sized upload route there would be the 4.5 MB limit this whole
 * arrangement exists to avoid.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ key: string[] }> }
) {
  if (process.env.R2_BUCKET || process.env.NODE_ENV === "production") {
    return NextResponse.json({ code: "not-found" }, { status: 404 });
  }
  const user = await requireAdmin(request);
  if (!user) {
    return NextResponse.json({ code: "unauthorised" }, { status: 401 });
  }

  const key = (await params).key.join("/");
  if (!key.startsWith("fines/")) {
    return NextResponse.json({ code: "bad-request" }, { status: 400 });
  }
  // A letter slot another company already holds is not this office's to
  // write (multi-company phase A, 15.11.2026). A fresh slot has no row yet.
  const documentId = key.split("/")[1] ?? "";
  const foreign = await prisma.fineDocument.findFirst({
    where: {
      OR: [{ storageKey: key }, { id: documentId }],
      NOT: { organisationId: user.organisationId },
    },
    select: { id: true },
  });
  if (foreign) return notFound();
  const body = new Uint8Array(await request.arrayBuffer());
  if (body.byteLength > MAX_LETTER_BYTES) {
    return NextResponse.json({ code: "too-large" }, { status: 413 });
  }

  await getAssetStore().put(key, body, request.headers.get("content-type") ?? "application/octet-stream");
  return new NextResponse(null, { status: 204 });
}
