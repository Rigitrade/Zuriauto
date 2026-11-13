import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/session";
import { waiveCharge, waiveSchema } from "@/lib/payments/mails";

/** "Erlassen": an open week is not owed. It becomes VOID; nothing chases it. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ code: "unauthorised" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ code: "bad-request" }, { status: 400 });
  }
  const parsed = waiveSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ code: "bad-request" }, { status: 400 });

  const organisation = await prisma.organisation.findFirst({ select: { id: true } });
  if (!organisation) return NextResponse.json({ code: "not-found" }, { status: 404 });

  const result = await waiveCharge(prisma, {
    organisationId: organisation.id,
    chargeId: (await params).id,
    note: parsed.data.note,
    actor: { id: user.id, displayName: user.displayName },
  });
  if (!result.ok) {
    return NextResponse.json({ code: result.code }, { status: result.code === "conflict" ? 409 : 404 });
  }
  return NextResponse.json({ ok: true });
}
