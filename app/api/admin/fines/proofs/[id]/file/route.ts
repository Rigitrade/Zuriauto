import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/session";
import { getAssetStore } from "@/lib/storage";

/**
 * A renter's payment screenshot. Audited: it can show their bank, their
 * account and their balance.
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
  const proof = await prisma.finePaymentProof.findUnique({
    where: { id },
    select: { storageKey: true, contentType: true },
  });
  if (!proof) {
    return NextResponse.json({ code: "not-found" }, { status: 404 });
  }

  await prisma.assetAccess.create({
    data: { finePaymentProofId: id, userId: user.id, username: user.username },
  });

  const object = await getAssetStore().get(proof.storageKey);
  if (!object) {
    return NextResponse.json({ code: "gone" }, { status: 410 });
  }
  return new NextResponse(object.body as unknown as BodyInit, {
    headers: {
      "content-type": proof.contentType,
      "content-disposition": "inline",
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
