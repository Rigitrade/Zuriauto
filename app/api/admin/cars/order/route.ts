import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { carOrderSchema, saveCarOrder } from "@/lib/admin/carOrder";
import { requireAdmin } from "@/lib/admin/session";

/**
 * The office's order of the fleet, dragged into place on the vehicles screen.
 * The pickup form's car list follows it (see lib/admin/carOrder.ts).
 *
 * 409 when the list is not the whole fleet once each: another screen added
 * or removed a car since this one loaded, and the office reloads.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  const user = await requireAdmin(request);
  if (!user) {
    return NextResponse.json({ code: "unauthorised" }, { status: 401 });
  }

  let parsed;
  try {
    parsed = carOrderSchema.safeParse(await request.json());
  } catch {
    return NextResponse.json({ code: "bad-request" }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json({ code: "bad-request" }, { status: 400 });
  }

  const organisation = await prisma.organisation.findFirst({ select: { id: true } });
  if (!organisation) {
    return NextResponse.json({ code: "not-configured" }, { status: 503 });
  }

  const outcome = await saveCarOrder(prisma, organisation.id, parsed.data.ids);
  if (!outcome.ok) {
    return NextResponse.json({ code: outcome.code }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
