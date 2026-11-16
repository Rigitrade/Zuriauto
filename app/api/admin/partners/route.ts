import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/admin/password";
import { newPartnerSchema } from "@/lib/admin/partners";
import { requireAdmin } from "@/lib/admin/session";
import { isSiteOwner } from "@/lib/admin/siteOwner";

/**
 * Partner companies, created from Konten by ZURIAUTO's owner (15.11.2026).
 *
 * A new partner gets its company row with the minimum its documents and mails
 * need, and one owner account. Its owner then fills in the rest under Firma,
 * adds staff under Konten and cars under Flotte, all inside its own company.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function siteOwnerOr(request: Request) {
  const user = await requireAdmin(request);
  if (!user) return { error: NextResponse.json({ code: "unauthorised" }, { status: 401 }) };
  if (!(await isSiteOwner(user))) {
    return { error: NextResponse.json({ code: "forbidden" }, { status: 403 }) };
  }
  return { owner: user };
}

export async function GET(request: Request) {
  const { error, owner } = await siteOwnerOr(request);
  if (error) return error;

  const partners = await prisma.organisation.findMany({
    where: { id: { not: owner!.organisationId } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      brandName: true,
      legalName: true,
      officeEmail: true,
      disabledAt: true,
      createdAt: true,
      adminUsers: {
        where: { role: "owner", disabledAt: null },
        orderBy: { createdAt: "asc" },
        select: { username: true, displayName: true },
      },
      // Running rentals, for the warning before switching a partner off.
      _count: { select: { cars: true, rentals: { where: { status: "ACTIVE" } } } },
    },
  });

  return NextResponse.json({
    partners: partners.map(({ adminUsers, _count, createdAt, disabledAt, ...partner }) => ({
      ...partner,
      createdAt: createdAt.toISOString(),
      owners: adminUsers,
      cars: _count.cars,
      activeRentals: _count.rentals,
      disabled: disabledAt !== null,
    })),
  });
}

function isUniqueViolation(error: unknown): error is { code: "P2002"; meta?: { target?: unknown } } {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002";
}

export async function POST(request: Request) {
  const { error, owner } = await siteOwnerOr(request);
  if (error) return error;

  let parsed;
  try {
    parsed = newPartnerSchema.safeParse(await request.json());
  } catch {
    return NextResponse.json({ code: "bad-request" }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json(
      { code: "invalid", fields: [...new Set(parsed.error.issues.map((issue) => issue.path.join(".")))] },
      { status: 400 }
    );
  }
  const input = parsed.data;

  // Checked first for a clear answer; the unique indexes below catch a race.
  if (await prisma.organisation.count({ where: { slug: input.slug } })) {
    return NextResponse.json({ code: "slug-taken" }, { status: 409 });
  }
  if (await prisma.adminUser.count({ where: { username: input.owner.username } })) {
    return NextResponse.json({ code: "username-taken" }, { status: 409 });
  }

  const passwordHash = await hashPassword(input.owner.password);
  try {
    // One transaction: never a company without its owner.
    const created = await prisma.$transaction(async (tx) => {
      const partner = await tx.organisation.create({
        data: {
          name: input.brandName,
          slug: input.slug,
          brandName: input.brandName,
          legalName: input.legalName,
          officeEmail: input.officeEmail,
        },
        select: { id: true, name: true, slug: true },
      });
      const user = await tx.adminUser.create({
        data: {
          organisationId: partner.id,
          username: input.owner.username,
          displayName: input.owner.displayName,
          role: "owner",
          passwordHash,
          createdById: owner!.id,
          // App-clock time, as for any new account (see the users route).
          credentialsChangedAt: new Date(),
        },
        select: { username: true },
      });
      return { partner, owner: user };
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (isUniqueViolation(error)) {
      const target = JSON.stringify(error.meta?.target ?? "");
      return NextResponse.json(
        { code: target.includes("slug") ? "slug-taken" : "username-taken" },
        { status: 409 }
      );
    }
    console.error("[admin] could not create the partner company:", error);
    return NextResponse.json({ code: "failed" }, { status: 500 });
  }
}
