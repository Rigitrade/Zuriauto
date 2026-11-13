import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/session";
import { discardLetter } from "@/lib/fines/discard";
import { getAssetStore } from "@/lib/storage";

/**
 * Deletes an uploaded letter so the same scan can be uploaded again — with
 * its fine, while nobody has heard of that fine yet. See lib/fines/discard.ts
 * for what is refused and why.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS = { "not-found": 404, busy: 409, "has-history": 409 } as const;

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin(request);
  if (!user) {
    return NextResponse.json({ code: "unauthorised" }, { status: 401 });
  }
  const { id } = await params;
  const outcome = await discardLetter(prisma, getAssetStore(), id);
  if (!outcome.ok) {
    const code = outcome.code === "busy" ? "letter-busy" : outcome.code === "has-history" ? "letter-has-history" : outcome.code;
    return NextResponse.json({ code }, { status: STATUS[outcome.code] });
  }
  console.info(
    `[fines] letter ${id} deleted by ${user.displayName}${outcome.fineDeleted ? ", with its fine" : ""}`
  );
  return NextResponse.json({ fineDeleted: outcome.fineDeleted });
}
