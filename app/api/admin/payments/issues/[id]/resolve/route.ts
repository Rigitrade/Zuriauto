import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/session";
import { resolveMailIssue } from "@/lib/payments/actions";

/** The office has looked at a TWINT email nothing was booked from. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ code: "unauthorised" }, { status: 401 });
  const result = await resolveMailIssue(prisma, (await params).id, { id: user.id, displayName: user.displayName });
  if (!result.ok) return NextResponse.json({ code: result.code }, { status: 409 });
  return NextResponse.json({ ok: true });
}
