import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/session";
import { paymentDetail } from "@/lib/payments/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ code: "unauthorised" }, { status: 401 });
  const detail = await paymentDetail(prisma, (await params).id);
  if (!detail) return NextResponse.json({ code: "not-found" }, { status: 404 });
  return NextResponse.json(detail, { headers: { "cache-control": "no-store" } });
}
