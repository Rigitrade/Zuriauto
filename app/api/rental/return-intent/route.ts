import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { notifyReturnIntent } from "@/lib/rental/manageActions";
import { recordReturnIntent, resolveManageToken } from "@/lib/rental/manage";

/**
 * "I will bring the car back."
 *
 * Records intent and tells the office. Deliberately does not change the
 * rental's status: the car is not back yet, and the overdue pass should still
 * fire if it never arrives. RETURN_SUBMITTED is reserved for Phase 4.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const now = new Date();

  let token = "";
  try {
    const body = (await request.json()) as { token?: unknown };
    token = typeof body.token === "string" ? body.token : "";
  } catch {
    return NextResponse.json({ code: "bad-request" }, { status: 400 });
  }

  const resolved = await resolveManageToken(prisma, token, now);
  if (!resolved.ok) {
    return NextResponse.json({ code: "link-unusable" }, { status: 410 });
  }

  const outcome = await recordReturnIntent(
    prisma,
    resolved.tokenId,
    resolved.rental.id,
    now
  );
  if (!outcome.ok) {
    return NextResponse.json({ code: "link-unusable" }, { status: 410 });
  }

  const customer = await prisma.customer.findFirstOrThrow({
    where: { rentals: { some: { id: resolved.rental.id } } },
    select: { firstName: true, lastName: true, phone: true },
  });

  // After the commit, and not awaited for its failure: the renter's action
  // stands whatever the mail server does, and mailRetryPass owns the retry.
  await notifyReturnIntent(
    {
      ...resolved.rental,
      customerName: `${customer.firstName} ${customer.lastName}`,
      customerPhone: customer.phone,
    },
    now
  );

  return NextResponse.json({ ok: true });
}
