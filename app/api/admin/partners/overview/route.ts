import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { partnerOverview } from "@/lib/admin/partnerOverview";
import { requireAdmin } from "@/lib/admin/session";
import { isSiteOwner } from "@/lib/admin/siteOwner";

/**
 * The "Partner" page (16.11.2026): every company side by side, and one fleet
 * list across all of them. ZURIAUTO's owner only, read-only. Inside a view of
 * a partner the account is that partner's, so this answers 403 there too.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ code: "unauthorised" }, { status: 401 });
  if (!(await isSiteOwner(user))) return NextResponse.json({ code: "forbidden" }, { status: 403 });
  return NextResponse.json(await partnerOverview(prisma, new Date()));
}
