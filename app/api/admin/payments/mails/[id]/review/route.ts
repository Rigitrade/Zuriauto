import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/session";
import { readLifecycleMailConfig } from "@/lib/rental/lifecycleMail";
import { mailReviewSchema, reviewPaymentMail } from "@/lib/payments/mails";

/** The office answers one payment email: "Korrektur senden" or "Erledigt". */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS = {
  "bad-request": 400,
  conflict: 409,
  "not-found": 404,
  "mail-failed": 502,
  "mail-not-configured": 503,
} as const;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ code: "unauthorised" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ code: "bad-request" }, { status: 400 });
  }
  const parsed = mailReviewSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ code: "bad-request" }, { status: 400 });

  const organisation = await prisma.organisation.findFirst({ select: { id: true } });
  if (!organisation) return NextResponse.json({ code: "not-found" }, { status: 404 });

  const result = await reviewPaymentMail(prisma, {
    organisationId: organisation.id,
    notificationId: (await params).id,
    action: parsed.data.action,
    actor: { id: user.id, displayName: user.displayName },
    mail: readLifecycleMailConfig(),
    now: new Date(),
  });
  if (!result.ok) return NextResponse.json({ code: result.code }, { status: STATUS[result.code] });
  return NextResponse.json({ ok: true });
}
