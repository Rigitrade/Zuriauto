import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Removing one address from the waiting list.
 *
 * POST, not GET, although the link in the email is a GET.
 *
 * The reason is that mail clients and corporate scanners fetch every link in
 * a message to check it. A GET that unsubscribed would mean some people are
 * removed from the list by their own antivirus, having never clicked
 * anything — and the symptom, "I asked to be told and never heard from you",
 * is one nobody would ever diagnose. So the link opens a page with a button,
 * and the button posts here.
 *
 * The token is the whole authorisation. It is unguessable and scoped to one
 * row, and the only thing it can do is this.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let token: unknown;
  try {
    token = (await request.json())?.token;
  } catch {
    return NextResponse.json({ code: "bad-request" }, { status: 400 });
  }

  if (typeof token !== "string" || token.length < 16) {
    return NextResponse.json({ code: "not-found" }, { status: 404 });
  }

  /**
   * A conditional update, so the answer does not depend on a prior read.
   *
   * `updateMany` rather than `update` because it reports a count instead of
   * throwing on a miss, and because an address already cancelled must still
   * answer OK: somebody clicking the link twice has got what they wanted both
   * times, and an error on the second click reads as a failure to unsubscribe.
   */
  const { count } = await prisma.availabilityAlert.updateMany({
    where: { unsubscribeToken: token, cancelledAt: null },
    data: { cancelledAt: new Date() },
  });

  if (count === 0) {
    // Either an unknown token or one already cancelled. Not distinguished:
    // the caller learns only that there is now nothing to send them, which is
    // true in both cases, and a distinct answer would let a token be probed.
    const known = await prisma.availabilityAlert.count({
      where: { unsubscribeToken: token },
    });
    if (known === 0) {
      return NextResponse.json({ code: "not-found" }, { status: 404 });
    }
  }

  return NextResponse.json({ ok: true });
}
