import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/session";
import { applyPaymentAction, paymentActionSchema } from "@/lib/payments/actions";

/** An office action on a payment. See lib/payments/actions.ts for each one. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS = { "bad-request": 400, conflict: 409, "not-found": 404 } as const;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ code: "unauthorised" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ code: "bad-request" }, { status: 400 });
  }
  const parsed = paymentActionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ code: "bad-request" }, { status: 400 });

  const result = await applyPaymentAction(prisma, (await params).id, parsed.data, {
    id: user.id,
    displayName: user.displayName,
  });
  if (!result.ok) return NextResponse.json({ code: result.code }, { status: STATUS[result.code] });
  return NextResponse.json({ ok: true });
}
