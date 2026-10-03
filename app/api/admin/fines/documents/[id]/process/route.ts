import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/session";
import { STALE_CLAIM_MS } from "@/lib/fines/process";
import { runFineDocument } from "@/lib/fines/run";
import { afterResponse } from "@/lib/fines/schedule";

/**
 * "Process again" on a letter that failed: its attempts back, and another
 * read after the response. A letter already read is not read again here —
 * corrections are made on its fine.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin(request);
  if (!user) {
    return NextResponse.json({ code: "unauthorised" }, { status: 401 });
  }
  const { id } = await params;
  const reset = await prisma.fineDocument.updateMany({
    where: {
      id,
      // Waiting, failed, or a reading that died mid-way.
      OR: [
        { status: { in: ["UPLOADED", "FAILED"] } },
        { status: "PROCESSING", claimedAt: { lt: new Date(Date.now() - STALE_CLAIM_MS) } },
      ],
    },
    data: { attempts: 0 },
  });
  if (reset.count === 0) {
    return NextResponse.json({ code: "conflict" }, { status: 409 });
  }
  const scheduled = afterResponse(() => runFineDocument(id));
  return NextResponse.json({ scheduled }, { status: 202 });
}
