import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/session";
import { officePaymentSchema, recordOfficePayment } from "@/lib/payments/office";

/** "Barzahlung erfassen": the office records a payment on a rental. See lib/payments/office.ts. */

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
  const parsed = officePaymentSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ code: "bad-request" }, { status: 400 });

  // Single tenant, as every payments route: the rental must be this organisation's.
  const id = (await params).id;
  const organisation = await prisma.organisation.findFirst({ select: { id: true } });
  const rental = organisation
    ? await prisma.rental.findFirst({ where: { id, organisationId: organisation.id }, select: { id: true } })
    : null;
  if (!rental) return NextResponse.json({ code: "not-found" }, { status: 404 });

  const result = await recordOfficePayment(prisma, rental.id, parsed.data, {
    id: user.id,
    displayName: user.displayName,
  });
  if (!result.ok) return NextResponse.json({ code: result.code }, { status: STATUS[result.code] });
  return NextResponse.json({ ok: true });
}
