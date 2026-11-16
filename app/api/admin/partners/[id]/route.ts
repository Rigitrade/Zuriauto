import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { partnerChangeSchema } from "@/lib/admin/partners";
import { requireAdmin } from "@/lib/admin/session";
import { isSiteOwner } from "@/lib/admin/siteOwner";
import { findSiteOrganisation } from "@/lib/organisation";

/**
 * ZURIAUTO's owner corrects a partner company, or switches it off and on
 * (multi-company phase D, 16.11.2026).
 *
 * - Names, office email and short name, as given when it was created. A new
 *   short name ends the old links at once (the user's decision of 16.11:
 *   no forwarding); the screen says so before saving.
 * - Switched off: its logins, its renter links and its mails stop, its
 *   records stay. Allowed with cars still out (the user's decision of 16.11);
 *   the screen warns first.
 *
 * Anyone but ZURIAUTO's owner gets "not found", as for any record outside
 * their reach. ZURIAUTO itself is never changed here.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002";
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ code: "unauthorised" }, { status: 401 });
  const notFound = NextResponse.json({ code: "not-found" }, { status: 404 });
  if (!(await isSiteOwner(user))) return notFound;

  const { id } = await context.params;
  const partner = await prisma.organisation.findUnique({ where: { id }, select: { id: true, disabledAt: true } });
  if (!partner) return notFound;
  if ((await findSiteOrganisation())?.id === partner.id) {
    return NextResponse.json({ code: "site-company" }, { status: 403 });
  }

  let parsed;
  try {
    parsed = partnerChangeSchema.safeParse(await request.json());
  } catch {
    return NextResponse.json({ code: "bad-request" }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json(
      { code: "invalid", fields: [...new Set(parsed.error.issues.map((issue) => issue.path.join(".")))] },
      { status: 400 }
    );
  }
  const change = parsed.data;

  if (change.slug && (await prisma.organisation.count({ where: { slug: change.slug, id: { not: id } } }))) {
    return NextResponse.json({ code: "slug-taken" }, { status: 409 });
  }

  try {
    const saved = await prisma.organisation.update({
      where: { id },
      data: {
        // The list and the company's own records name it by its brand.
        ...(change.brandName !== undefined ? { brandName: change.brandName, name: change.brandName } : {}),
        ...(change.legalName !== undefined ? { legalName: change.legalName } : {}),
        ...(change.officeEmail !== undefined ? { officeEmail: change.officeEmail } : {}),
        ...(change.slug !== undefined ? { slug: change.slug } : {}),
        // Switching off twice keeps the day it was first switched off.
        ...(change.disabled !== undefined
          ? { disabledAt: change.disabled ? (partner.disabledAt ?? new Date()) : null }
          : {}),
      },
      select: { id: true, name: true, slug: true, disabledAt: true },
    });
    if (change.disabled !== undefined) {
      console.info(`[admin] ${user.username} switched ${saved.slug ?? saved.name} ${change.disabled ? "off" : "on"}`);
    }
    return NextResponse.json({
      partner: { id: saved.id, name: saved.name, slug: saved.slug, disabled: saved.disabledAt !== null },
    });
  } catch (error) {
    if (isUniqueViolation(error)) return NextResponse.json({ code: "slug-taken" }, { status: 409 });
    console.error("[admin] could not change the partner company:", error);
    return NextResponse.json({ code: "failed" }, { status: 500 });
  }
}
