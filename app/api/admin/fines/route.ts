import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/session";
import { asTab, listFines } from "@/lib/fines/queries";

/** The fines section's list, by tab, with letters still being read. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await requireAdmin(request);
  if (!user) {
    return NextResponse.json({ code: "unauthorised" }, { status: 401 });
  }
  const tab = asTab(new URL(request.url).searchParams.get("tab"));
  return NextResponse.json(await listFines(prisma, tab, new Date()), {
    headers: { "cache-control": "no-store" },
  });
}
