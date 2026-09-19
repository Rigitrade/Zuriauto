import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  availabilityAlertSchema,
  availabilityReply,
  generateUnsubscribeToken,
  normaliseAlertEmail,
} from "@/lib/rental/availability";
import { asRentalLanguage } from "@/lib/rental/labels";
import { rateLimited } from "@/lib/rental/rateLimit";

/**
 * "Tell me when a car is free."
 *
 * The one public write in the system that is not a contract, and it stores an
 * email address and nothing else. No name, no phone, no preferred model: every
 * extra field is another thing held about somebody who is not yet a customer,
 * and the only thing needed to write to them is the address.
 *
 * Nothing is sent from here. The message goes out from the daily pass, which
 * is the only place that can answer "is anything actually available" without
 * this endpoint having to guess — see `availabilityPass` in scheduler.ts.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Its own rate-limit scope, for the reason the sign-in fence has one.
 *
 * A shared budget would let somebody hammering this form lock a customer out
 * of submitting their pickup contract at the desk — two unrelated things
 * failing together because they happened to share a counter.
 *
 * Wider than the pickup budget: this is one field, and a visitor mistyping
 * their address twice and correcting it should not be turned away.
 */
const SCOPE = { scope: "availability", max: 8, windowMs: 10 * 60 * 1000 };

function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ code: "bad-request" }, { status: 400 });
  }

  const parsed = availabilityAlertSchema.safeParse(body);

  // The language is read before the validation is acted on, so the refusal is
  // written in the language the page is in.
  const language = asRentalLanguage(
    parsed.success
      ? parsed.data.language
      : typeof (body as { language?: unknown })?.language === "string"
        ? ((body as { language: string }).language)
        : undefined
  );
  const reply = availabilityReply(language);

  if (!parsed.success) {
    return NextResponse.json(
      { code: "invalid", message: reply.invalid },
      { status: 400 }
    );
  }

  if (await rateLimited(prisma, clientIp(request), new Date(), SCOPE)) {
    return NextResponse.json(
      { code: "rate-limited", message: reply.busy },
      { status: 429 }
    );
  }

  const organisation = await prisma.organisation.findFirst({
    select: { id: true },
  });
  if (!organisation) {
    console.error("[availability] no organisation row — run pnpm db:seed");
    return NextResponse.json({ code: "not-configured" }, { status: 503 });
  }

  const email = normaliseAlertEmail(parsed.data.email);

  /**
   * One row per address, rewritten rather than duplicated.
   *
   * Somebody who asks twice is asking once, and an upsert is what makes the
   * form safe to double-submit. The update deliberately resets `notifiedAt`
   * and `cancelledAt`: a person who unsubscribed in March and asks again in
   * September is making a new request, and a row left cancelled would silently
   * never be written to — the worst possible outcome for a form that just told
   * them they would hear from us.
   *
   * The token is only generated for a new row. Rotating it on every
   * re-subscribe would dead-link the unsubscribe in a mail already sitting in
   * somebody's inbox.
   */
  try {
    await prisma.availabilityAlert.upsert({
      where: { organisationId_email: { organisationId: organisation.id, email } },
      create: {
        organisationId: organisation.id,
        email,
        language,
        unsubscribeToken: generateUnsubscribeToken(),
      },
      update: { language, notifiedAt: null, cancelledAt: null },
    });
  } catch (error) {
    console.error("[availability] could not record the alert:", error);
    return NextResponse.json({ code: "failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, message: reply.queued });
}
