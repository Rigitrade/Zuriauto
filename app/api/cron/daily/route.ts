import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { runDailyPasses } from "@/lib/rental/scheduler";

/**
 * The daily run.
 *
 * One handler calling pure passes, which is what makes the trigger swappable:
 * Vercel Cron, a GitHub Actions schedule, cron-job.org or a manual curl all
 * call this same URL. Vercel Cron on the free tier is roughly daily, which is
 * adequate for a 24-hour notice — see the note on REMINDER_LOOKAHEAD_HOURS for
 * why the reminder window is 48 hours wide rather than 24.
 *
 * Safe to call twice. Every pass is idempotent by construction, and there is a
 * test that runs the whole day twice and asserts one send.
 */

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. */
function authorised(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  // Fail closed. An unset secret must not mean an open trigger — this endpoint
  // sends email to real customers.
  if (!expected) return false;

  const header = request.headers.get("authorization") ?? "";
  const supplied = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!supplied) return false;

  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}

function baseUrl(request: Request): string {
  if (process.env.SITE_URL) return process.env.SITE_URL;
  // Falling back to the request host keeps preview deployments working, where
  // the links have to point at the deployment that sent them.
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

async function run(request: Request) {
  if (!authorised(request)) {
    return NextResponse.json({ code: "unauthorised" }, { status: 401 });
  }

  const startedAt = Date.now();

  try {
    const summary = await runDailyPasses({
      client: prisma,
      now: new Date(),
      baseUrl: baseUrl(request),
    });

    console.log("[cron] daily run", JSON.stringify(summary));

    return NextResponse.json({
      ok: true,
      ms: Date.now() - startedAt,
      ...summary,
    });
  } catch (error) {
    // Logged and reported, never swallowed: a cron whose failures are silent
    // is indistinguishable from one that is not running at all.
    console.error("[cron] daily run failed:", error);
    return NextResponse.json({ code: "failed" }, { status: 500 });
  }
}

// GET because that is what Vercel Cron issues; POST so a human can curl it
// without remembering which verb it wanted.
export const GET = run;
export const POST = run;
