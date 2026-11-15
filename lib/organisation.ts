import { findSiteOrganisationWith, type OrgClient } from "@/lib/organisationCore";
import { prisma } from "@/lib/db";

/**
 * Which company a request belongs to, for the code that has no signed-in
 * account to ask (multi-company phase A, 15.11.2026).
 *
 * The office console never uses this: an office request belongs to the
 * account's company (`AdminIdentity.organisationId`). This is for the public
 * forms, the public fleet and the jobs, which today serve ZURIAUTO only, and
 * for the company links (`zuriauto.ch/<slug>/pickup`) that phase C adds.
 */

export { isValidCompanySlug } from "@/lib/company/slug";

export class NoOrganisation extends Error {
  constructor() {
    super("No organisation row: run pnpm db:seed.");
    this.name = "NoOrganisation";
  }
}

/**
 * The company the public site serves: `SITE_ORGANISATION_ID` when set, else
 * the company with slug `zuriauto`, else the oldest. Never "any company":
 * with two companies in the database that would be a coin toss.
 */
export async function siteOrganisation(
  client: OrgClient = prisma
): Promise<{ id: string; slug: string | null }> {
  const found = await findSiteOrganisation(client);
  if (!found) throw new NoOrganisation();
  return found;
}

/** As `siteOrganisation`, but null on an empty database, for the routes
 *  that answer that with their own 503. */
export async function findSiteOrganisation(
  client: OrgClient = prisma
): Promise<{ id: string; slug: string | null } | null> {
  return findSiteOrganisationWith(client);
}

/** The company a public link names, or null. */
export async function organisationBySlug(
  slug: string,
  client: OrgClient = prisma
): Promise<{ id: string; slug: string } | null> {
  const found = await client.organisation.findUnique({
    where: { slug: slug.toLowerCase() },
    select: { id: true, slug: true },
  });
  return found && found.slug ? { id: found.id, slug: found.slug } : null;
}
