import type { PrismaClient } from "../generated/prisma/client";

/**
 * The site company's lookup, without the app's database client, so the
 * command-line scripts (relative imports, their own client) can share it.
 * App code imports `lib/organisation.ts`, which supplies the client.
 */

/** Only the table this reads, so a transaction client fits too. */
export type OrgClient = Pick<PrismaClient, "organisation">;

/**
 * `SITE_ORGANISATION_ID` when set, else the company with slug `zuriauto`,
 * else the oldest. Null on an empty database.
 */
export async function findSiteOrganisationWith(
  client: OrgClient
): Promise<{ id: string; slug: string | null } | null> {
  const select = { id: true, slug: true } as const;
  const configured = process.env.SITE_ORGANISATION_ID;
  return (
    (configured
      ? await client.organisation.findUnique({ where: { id: configured }, select })
      : null) ??
    (await client.organisation.findUnique({ where: { slug: "zuriauto" }, select })) ??
    (await client.organisation.findFirst({ orderBy: { createdAt: "asc" }, select }))
  );
}
