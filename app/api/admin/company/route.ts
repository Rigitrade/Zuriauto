import { NextResponse } from "next/server";
import { COMPANY_SETTINGS_COLUMNS, companySettingsSchema } from "@/lib/admin/company";
import { requireAdmin } from "@/lib/admin/session";
import { prisma } from "@/lib/db";
import { findSiteOrganisation } from "@/lib/organisation";

/**
 * The signed-in owner's company details (multi-company phase B, 15.11.2026):
 * what its contracts, return reports, renter mails and police letters carry.
 *
 * Owner-only, both verbs, like the accounts: the details decide who renters
 * pay and who the police write to. Always the account's own company; there
 * is no id to point at another.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function ownerOr(request: Request) {
  const user = await requireAdmin(request);
  if (!user) return { error: NextResponse.json({ code: "unauthorised" }, { status: 401 }) };
  if (user.role !== "owner") {
    return { error: NextResponse.json({ code: "forbidden" }, { status: 403 }) };
  }
  return { owner: user };
}

async function settingsOf(organisationId: string) {
  const { name, slug, ...settings } = await prisma.organisation.findUniqueOrThrow({
    where: { id: organisationId },
    select: { name: true, slug: true, ...COMPANY_SETTINGS_COLUMNS },
  });
  // The site company's empty fields fall back to ZURIAUTO's values and the
  // MAIL_OFFICE setting; a partner's do not, so the page says which applies.
  const isSite = (await findSiteOrganisation())?.id === organisationId;
  return { name, slug, isSite, settings };
}

export async function GET(request: Request) {
  const { error, owner } = await ownerOr(request);
  if (error) return error;
  return NextResponse.json(await settingsOf(owner!.organisationId));
}

export async function PATCH(request: Request) {
  const { error, owner } = await ownerOr(request);
  if (error) return error;

  let parsed;
  try {
    parsed = companySettingsSchema.safeParse(await request.json());
  } catch {
    return NextResponse.json({ code: "bad-request" }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json(
      { code: "invalid", fields: parsed.error.issues.map((issue) => issue.path.join(".")) },
      { status: 400 }
    );
  }

  await prisma.organisation.update({
    where: { id: owner!.organisationId },
    data: parsed.data,
  });
  return NextResponse.json(await settingsOf(owner!.organisationId));
}
