import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/session";
import { getAssetStore } from "@/lib/storage";

/**
 * The signed contract, as the customer received it.
 *
 * The same document the mailer attached — not regenerated. A contract is
 * evidence, and a freshly rendered copy would be a new document that merely
 * resembles the one somebody signed: different bytes, different fonts if a
 * dependency moved, and no way to prove which version the signature belongs
 * to. This reads `Contract.pdfKey` and serves what was stored at the handover.
 *
 * Audited exactly as hard as an identity image, because it *is* one.
 * `contractPdf.ts` embeds the portrait, both sides of the ID and both sides of
 * the licence into the document. Serving this outside the access log would be
 * a way to read every passport in the system without leaving a trace, which
 * would make the rest of that table decorative.
 *
 * See app/api/admin/assets/[id]/route.ts for why the bytes are proxied rather
 * than handed out as a presigned URL. The reasoning is identical and applies
 * here with more force: this file contains five identity images, not one.
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

  const contract = await prisma.contract.findUnique({
    where: { id },
    select: { id: true, contractNumber: true, pdfKey: true },
  });

  if (!contract) {
    return NextResponse.json({ code: "not-found" }, { status: 404 });
  }
  if (!contract.pdfKey) {
    return NextResponse.json({ code: "no-document" }, { status: 409 });
  }

  // Before the read, so an attempt that fails halfway is still recorded.
  await prisma.assetAccess.create({
    data: {
      contractId: contract.id,
      userId: user.id,
      username: user.username,
    },
  });

  const stored = await getAssetStore().get(contract.pdfKey);
  if (!stored) {
    console.error(
      `[admin] contract ${contract.contractNumber} has no object at ${contract.pdfKey}`
    );
    return NextResponse.json({ code: "no-document" }, { status: 409 });
  }

  return new NextResponse(Buffer.from(stored.body), {
    headers: {
      "content-type": "application/pdf",
      // Inline, and named: the office reads these in a tab, and a browser tab
      // titled with the contract number beats one titled with a cuid.
      "content-disposition": `inline; filename="${contract.contractNumber}.pdf"`,
      "cache-control": "private, no-store",
    },
  });
}
