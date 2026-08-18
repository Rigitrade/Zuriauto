import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { extendRental, resolveManageToken } from "@/lib/rental/manage";
import { notifyExtension } from "@/lib/rental/manageActions";

/**
 * "Keep it for N more weeks."
 *
 * The week count is the only thing taken from the browser, and the price is
 * recomputed here from the rental's own weekly rate — a number posted from a
 * form is a suggestion, not an amount owed.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const now = new Date();

  let token = "";
  let weeks = 0;
  try {
    const body = (await request.json()) as { token?: unknown; weeks?: unknown };
    token = typeof body.token === "string" ? body.token : "";
    weeks = typeof body.weeks === "number" ? body.weeks : 0;
  } catch {
    return NextResponse.json({ code: "bad-request" }, { status: 400 });
  }

  const resolved = await resolveManageToken(prisma, token, now);
  if (!resolved.ok) {
    return NextResponse.json({ code: "link-unusable" }, { status: 410 });
  }

  const result = await extendRental(prisma, {
    tokenId: resolved.tokenId,
    rentalId: resolved.rental.id,
    weeks,
    now,
  });

  if (!result.ok) {
    const status = result.reason === "token-consumed" ? 410 : 422;
    return NextResponse.json({ code: result.reason }, { status });
  }

  const customer = await prisma.customer.findFirstOrThrow({
    where: { rentals: { some: { id: resolved.rental.id } } },
    select: { firstName: true, lastName: true, phone: true },
  });

  await notifyExtension(
    {
      ...resolved.rental,
      customerName: `${customer.firstName} ${customer.lastName}`,
      customerPhone: customer.phone,
    },
    {
      weeks: result.quote.weeks,
      newEndAt: result.quote.newEndAt,
      amountCents: result.quote.amountCents,
      paymentUrl: result.paymentUrl,
    },
    now
  );

  return NextResponse.json({
    ok: true,
    weeks: result.quote.weeks,
    amountCents: result.quote.amountCents,
    newEndAt: result.quote.newEndAt.toISOString(),
    paymentUrl: result.paymentUrl,
  });
}
