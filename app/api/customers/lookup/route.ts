import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { findCustomersByPhone } from "@/lib/rental/findCustomers";
import { normalisePhone } from "@/lib/rental/phone";
import { hashIp, rateLimited } from "@/lib/rental/rateLimit";
import { issueReuseToken } from "@/lib/rental/reuseToken";

/**
 * Who is this, and what have we already got?
 *
 * POST rather than GET so the number never lands in a URL, an access log or a
 * referrer header — it is personal data, and a query string is the one place
 * that leaks it everywhere at once.
 *
 * Origin-checked and rate-limited, but NOT fenced with a key. It used to be,
 * and the reason it no longer is decides how it must be read: the pickup form
 * that calls this is public, so the caller has no credential to send. Anything
 * this endpoint will tell an authorised caller, it will tell anybody.
 *
 * That is why it answers as narrowly as it does, and why those limits are not
 * optional decoration. It returns no image bytes and no contract id —
 * permission to reuse documents travels as a signed, expiring token instead —
 * and the per-address limiter caps how fast the remaining question ("is this
 * number one of yours?") can be asked. Do not widen the response shape here
 * without putting a fence back first.
 */

// Prisma needs Node APIs, so not the Edge runtime.
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
  // First, so a cross-site post costs nothing to reject.
  if (!sameOrigin(request)) {
    return NextResponse.json({ code: "bad-origin" }, { status: 403 });
  }

  if (await rateLimited(prisma, clientIp(request))) {
    return NextResponse.json({ code: "rate-limited" }, { status: 429 });
  }

  let phone: unknown;
  try {
    phone = (await request.json())?.phone;
  } catch {
    return NextResponse.json({ code: "bad-request" }, { status: 400 });
  }
  if (typeof phone !== "string") {
    return NextResponse.json({ code: "bad-request" }, { status: 400 });
  }

  const phoneKey = normalisePhone(phone);

  const organisation = await prisma.organisation.findFirst({
    select: { id: true },
  });
  if (!organisation) {
    console.error("[customer-lookup] no organisation row — run pnpm db:seed");
    return NextResponse.json({ code: "not-configured" }, { status: 503 });
  }

  // An unnormalisable number is not an error. It is a number nobody can be
  // found by, which is the same answer as a number nobody has rented on.
  const matches = phoneKey
    ? await findCustomersByPhone(prisma, organisation.id, phoneKey)
    : [];

  // Audited even when nothing matched — a run of empty lookups is exactly the
  // shape of someone walking the number space, and not recording those would
  // defeat the reason the table exists.
  await prisma.customerLookup.create({
    data: { phoneHash: hashIp(phoneKey ?? phone), matches: matches.length },
  });

  return NextResponse.json({
    matches: matches.map((match) => ({
      ...match,
      documentsOnFile: match.documentsOnFile
        ? {
            contractNumber: match.documentsOnFile.contractNumber,
            signedAt: match.documentsOnFile.signedAt,
            // The id stays on the server; the client gets permission instead.
            reuseToken: issueReuseToken(match.documentsOnFile.contractId),
          }
        : null,
    })),
  });
}
