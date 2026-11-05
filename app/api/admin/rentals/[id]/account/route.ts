import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/session";
import { rentalAccount } from "@/lib/payments/account";

/** The Mietkonto: a rental's deposit, weeks, balance after the return and totals. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ code: "unauthorised" }, { status: 401 });

  // Single tenant, as every payments route: the rental must be this organisation's.
  const id = (await params).id;
  const organisation = await prisma.organisation.findFirst({ select: { id: true } });
  const owned = organisation
    ? await prisma.rental.findFirst({ where: { id, organisationId: organisation.id }, select: { id: true } })
    : null;
  const account = owned ? await rentalAccount(prisma, id, new Date()) : null;
  if (!account) return NextResponse.json({ code: "not-found" }, { status: 404 });
  return NextResponse.json({ account }, { headers: { "cache-control": "no-store" } });
}
