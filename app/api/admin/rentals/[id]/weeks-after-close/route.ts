import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/session";
import { decideWeeksAfterClose } from "@/lib/payments/afterClose";

/**
 * After an early return: the office cancels the weeks that had not begun, or
 * keeps them owed. See lib/payments/afterClose.ts.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ choice: z.enum(["void", "keep"]) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ code: "unauthorised" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ code: "bad-request" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ code: "bad-request" }, { status: 400 });

  // Single tenant, as every payments route: the rental must be this organisation's.
  const id = (await params).id;
  const organisation = await prisma.organisation.findFirst({ select: { id: true } });
  const rental = organisation
    ? await prisma.rental.findFirst({ where: { id, organisationId: organisation.id }, select: { id: true } })
    : null;
  if (!rental) return NextResponse.json({ code: "not-found" }, { status: 404 });

  const result = await decideWeeksAfterClose(prisma, rental.id, parsed.data.choice, {
    id: user.id,
    displayName: user.displayName,
  });
  if (!result.ok) {
    return NextResponse.json({ code: result.code }, { status: result.code === "conflict" ? 409 : 404 });
  }
  return NextResponse.json({ ok: true, count: result.count });
}
