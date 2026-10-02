import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rateLimited } from "@/lib/rental/rateLimit";
import { findReturnPrefill } from "@/lib/rental/returnPrefill";

/**
 * Who has this car out, so the return form can say so for them.
 *
 * Public, like the form that calls it: there is no credential a renter can be
 * relied on to hold. Read lib/rental/returnPrefill.ts before widening what
 * this answers — the accepted cost is written there.
 *
 * POST, as the desk's customer lookup is, so nothing between the browser and
 * here caches a renter's name. Origin-checked and rate-limited on its own
 * budget: a lookup must not spend the allowance the return submission needs.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

/** Rejects cross-site posts. Absent Origin (some native clients) is allowed. */
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ code: "bad-origin" }, { status: 403 });
  }

  // Thirty per ten minutes: a renter changing their mind about which Prius is
  // theirs a few times is nowhere near it, and a script reading the fleet over
  // and over is.
  if (
    await rateLimited(prisma, clientIp(request), new Date(), {
      scope: "return-prefill",
      max: 30,
    })
  ) {
    return NextResponse.json({ code: "rate-limited" }, { status: 429 });
  }

  let vehicleId: unknown;
  try {
    vehicleId = (await request.json())?.vehicleId;
  } catch {
    return NextResponse.json({ code: "bad-request" }, { status: 400 });
  }
  if (typeof vehicleId !== "string" || vehicleId === "") {
    return NextResponse.json({ code: "bad-request" }, { status: 400 });
  }

  const organisation = await prisma.organisation.findFirst({
    select: { id: true },
  });
  if (!organisation) {
    console.error("[return-prefill] no organisation row — run pnpm db:seed");
    return NextResponse.json({ code: "not-configured" }, { status: 503 });
  }

  const prefill = await findReturnPrefill(prisma, organisation.id, vehicleId);

  return NextResponse.json(
    { prefill },
    { headers: { "cache-control": "no-store" } }
  );
}
