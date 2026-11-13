import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/session";
import { sentPaymentMails } from "@/lib/payments/mails";
import { planPaymentMails } from "@/lib/rental/scheduler";

/**
 * "E-Mails" on the payments page: what the next daily run will send about
 * payments (the dry run, live), and every payment email already sent.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ code: "unauthorised" }, { status: 401 });
  const organisation = await prisma.organisation.findFirst({ select: { id: true } });
  if (!organisation) return NextResponse.json({ next: [], held: false, cap: 0, sent: [] });

  const now = new Date();
  const [plan, sent] = await Promise.all([
    planPaymentMails(prisma, now, organisation.id),
    sentPaymentMails(prisma, organisation.id, now),
  ]);
  return NextResponse.json(
    {
      next: plan.rows.map((row) => ({ ...row, dueDate: row.dueDate.toISOString() })),
      held: plan.held.includes(organisation.id),
      cap: plan.cap,
      sent,
    },
    { headers: { "cache-control": "no-store" } }
  );
}
