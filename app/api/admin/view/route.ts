import { NextResponse } from "next/server";
import { z } from "zod";
import { ADMIN_SESSION_TTL_MS, requireAdmin } from "@/lib/admin/session";
import { isSiteOwner } from "@/lib/admin/siteOwner";
import { VIEW_COOKIE, viewablePartner, viewCookieOptions } from "@/lib/admin/view";
import { prisma } from "@/lib/db";

/**
 * ZURIAUTO's owner looks inside a partner company, read-only (multi-company
 * phase D, 16.11.2026; Ahmed's decision of 15.11: full records, read-only).
 *
 * POST opens the view: every office screen then shows the partner's records,
 * and every write is refused (middleware.ts, and `requireAdmin` behind it).
 * DELETE closes it, back to ZURIAUTO's own console.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ organisationId: z.string().min(1).max(64) }).strict();

export async function POST(request: Request) {
  // The account's own company, whatever view is already open: switching from
  // one partner to another starts from ZURIAUTO's owner, not from the view.
  const user = await requireAdmin(request, new Date(), { ownCompany: true });
  if (!user) return NextResponse.json({ code: "unauthorised" }, { status: 401 });
  if (!(await isSiteOwner(user))) return NextResponse.json({ code: "forbidden" }, { status: 403 });

  let parsed;
  try {
    parsed = bodySchema.safeParse(await request.json());
  } catch {
    return NextResponse.json({ code: "bad-request" }, { status: 400 });
  }
  if (!parsed.success) return NextResponse.json({ code: "invalid" }, { status: 400 });

  const partner = await viewablePartner(user, parsed.data.organisationId);
  if (!partner) return NextResponse.json({ code: "not-found" }, { status: 404 });

  // Who looked into which company, when: the partner agreement allows it,
  // and the log is where it can be shown.
  const company = await prisma.organisation.findUnique({ where: { id: partner }, select: { slug: true, name: true } });
  console.info(`[admin] ${user.username} opened a read-only view of ${company?.slug ?? company?.name ?? partner}`);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(VIEW_COOKIE, partner, viewCookieOptions(ADMIN_SESSION_TTL_MS / 1000));
  return response;
}

/** Back to the account's own company. Only clears a cookie, so open to all. */
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(VIEW_COOKIE, "", viewCookieOptions(0));
  return response;
}
