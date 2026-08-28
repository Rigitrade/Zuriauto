import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/session";

/**
 * What documents a rental has, and which of them can still be opened.
 *
 * A list, never bytes. It answers "is the licence on file?" without anybody
 * looking at the licence — which is the question the office asks far more
 * often, and the one that should not cost a customer their privacy. Opening
 * an actual image is a second, audited request to /api/admin/assets/[id].
 *
 * Deleted assets are listed rather than hidden. "The passport was checked at
 * this handover and the image has since been deleted under the retention
 * policy" is a materially different answer from "no passport was ever taken",
 * and the office needs to be able to tell them apart.
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

  const rental = await prisma.rental.findUnique({
    where: { id },
    select: {
      id: true,
      contracts: {
        orderBy: { signedAt: "asc" },
        select: {
          id: true,
          kind: true,
          contractNumber: true,
          signedAt: true,
          pdfKey: true,
          assets: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              kind: true,
              contentType: true,
              bytes: true,
              deletedAt: true,
            },
          },
        },
      },
    },
  });

  if (!rental) {
    return NextResponse.json({ code: "not-found" }, { status: 404 });
  }

  return NextResponse.json({
    contracts: rental.contracts.map((contract) => ({
      id: contract.id,
      kind: contract.kind,
      contractNumber: contract.contractNumber,
      signedAt: contract.signedAt.toISOString(),
      /** Whether a PDF exists, never the key itself — the key is not a
       *  secret, but nothing outside the server has any use for it. */
      hasPdf: Boolean(contract.pdfKey),
      assets: contract.assets.map((asset) => ({
        id: asset.id,
        kind: asset.kind,
        contentType: asset.contentType,
        bytes: asset.bytes,
        deletedAt: asset.deletedAt?.toISOString() ?? null,
      })),
    })),
  });
}
