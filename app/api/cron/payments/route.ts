import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cronAuthorised } from "@/lib/cron/auth";
import { fetchTwintMails, readMailboxConfig } from "@/lib/payments/twint/mailbox";
import { twintPaymentPass } from "@/lib/payments/twint/pass";

/**
 * Reads TWINT's payment emails and books what it can.
 *
 * Its own route, not part of the daily run: payments want minutes, the daily
 * run sends customer mail once a day. Vercel's free plan runs crons daily, so
 * the every-10-minutes trigger is an external scheduler calling this URL
 * with the same bearer secret (docs/PAYMENTS-SETUP.md). Safe to call twice.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function run(request: Request) {
  if (!cronAuthorised(request)) {
    return NextResponse.json({ code: "unauthorised" }, { status: 401 });
  }
  const config = readMailboxConfig();
  if (!config) return NextResponse.json({ ok: true, skipped: "not-configured" });

  const startedAt = Date.now();
  try {
    const counts = await twintPaymentPass({ client: prisma, fetchMails: () => fetchTwintMails(config, new Date()) });
    console.log("[cron] payments", JSON.stringify(counts));
    return NextResponse.json({ ok: true, ms: Date.now() - startedAt, ...counts });
  } catch (error) {
    // A mailbox that cannot be reached is reported, never swallowed.
    console.error("[cron] payments failed:", error);
    return NextResponse.json({ code: "failed" }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
