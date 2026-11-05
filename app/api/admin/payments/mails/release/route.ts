import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/session";
import { readLifecycleMailConfig } from "@/lib/rental/lifecycleMail";
import {
  chargeOfficeOnlyPass,
  chargeReminderPass,
  weeklyChargePass,
  type SchedulerDeps,
} from "@/lib/rental/scheduler";

/**
 * "Jetzt senden": the office checked the list the safety stop held back and
 * lets it go. Runs the payment passes now, for this organisation, past the
 * cap — every other rule (office only for returned renters, old weeks, no
 * address) still applies.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function baseUrl(request: Request): string {
  if (process.env.SITE_URL) return process.env.SITE_URL;
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export async function POST(request: Request) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ code: "unauthorised" }, { status: 401 });
  const organisation = await prisma.organisation.findFirst({ select: { id: true } });
  if (!organisation) return NextResponse.json({ code: "not-found" }, { status: 404 });

  const deps: SchedulerDeps = {
    client: prisma,
    now: new Date(),
    baseUrl: baseUrl(request),
    mail: readLifecycleMailConfig(),
    releaseHoldFor: organisation.id,
  };
  const officeOnly = await chargeOfficeOnlyPass(deps);
  const requested = await weeklyChargePass(deps);
  const reminded = await chargeReminderPass(deps);
  console.log("[payments] held mails released", { by: user.displayName, officeOnly, requested, reminded });
  return NextResponse.json({ ok: true, officeOnly, requested, reminded });
}
