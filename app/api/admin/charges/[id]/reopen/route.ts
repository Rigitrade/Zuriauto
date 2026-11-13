import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/session";
import { reopenCharge } from "@/lib/payments/cutover";

/**
 * The office reopens a week the cut-over settled: the renter still owes it.
 * The daily job then requests it like any other due week.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ code: "unauthorised" }, { status: 401 });

  const id = (await params).id;
  // Single tenant, as every payments route: the week must be this organisation's.
  const organisation = await prisma.organisation.findFirst({ select: { id: true } });
  const charge = organisation
    ? await prisma.charge.findFirst({ where: { id, organisationId: organisation.id }, select: { id: true } })
    : null;
  if (!charge) return NextResponse.json({ code: "not-found" }, { status: 404 });

  const result = await reopenCharge(prisma, id, { id: user.id, displayName: user.displayName });
  if (!result.ok) {
    return NextResponse.json({ code: result.code }, { status: result.code === "conflict" ? 409 : 404 });
  }
  return NextResponse.json({ ok: true });
}
