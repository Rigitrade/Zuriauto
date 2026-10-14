import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/session";
import { paymentList, type PaymentTab } from "@/lib/payments/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TABS: PaymentTab[] = ["review", "booked", "all"];

export async function GET(request: Request) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ code: "unauthorised" }, { status: 401 });
  const asked = new URL(request.url).searchParams.get("tab") as PaymentTab | null;
  const tab = asked && TABS.includes(asked) ? asked : "review";
  return NextResponse.json({ payments: await paymentList(prisma, tab) }, { headers: { "cache-control": "no-store" } });
}
