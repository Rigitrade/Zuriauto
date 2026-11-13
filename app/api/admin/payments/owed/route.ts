import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/session";
import { openBalances } from "@/lib/payments/account";

/** "Offene Beträge": who owes what, returned renters first. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ code: "unauthorised" }, { status: 401 });
  const organisation = await prisma.organisation.findFirst({ select: { id: true } });
  const rows = organisation ? await openBalances(prisma, organisation.id, new Date()) : [];
  return NextResponse.json({ rows }, { headers: { "cache-control": "no-store" } });
}
