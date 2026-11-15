import type { PrismaClient } from "@/generated/prisma/client";
import { findSiteOrganisationWith } from "@/lib/organisationCore";
import { identityOf, type CompanyIdentity } from "./identity";

/** Only the table this reads, so a transaction client fits too. */
type Client = Pick<PrismaClient, "organisation">;

const COLUMNS = {
  id: true,
  name: true,
  brandName: true,
  legalName: true,
  street: true,
  postalCode: true,
  city: true,
  uid: true,
  phone: true,
  officeEmail: true,
  signerName: true,
  website: true,
  signingPlace: true,
  paymentUrl: true,
  twintUrl: true,
} as const;

/**
 * The identity of the company with this id (multi-company phase B).
 *
 * Throws for an unknown id: every caller holds the id from a row it just
 * read, so a missing company is a bug, and printing ZURIAUTO's name on it
 * would hide that bug on a renter's document.
 */
export async function loadCompanyIdentity(client: Client, organisationId: string): Promise<CompanyIdentity> {
  const org = await client.organisation.findUnique({ where: { id: organisationId }, select: COLUMNS });
  if (!org) throw new Error(`company ${organisationId} is missing`);
  const site = await findSiteOrganisationWith(client);
  return identityOf(org, site?.id === org.id);
}

/**
 * The same, remembered for one run of a daily pass, so a pass over forty
 * rentals reads each company once.
 */
export function companyIdentityCache(client: Client): (organisationId: string) => Promise<CompanyIdentity> {
  const seen = new Map<string, Promise<CompanyIdentity>>();
  return (organisationId) => {
    let hit = seen.get(organisationId);
    if (!hit) {
      hit = loadCompanyIdentity(client, organisationId);
      seen.set(organisationId, hit);
    }
    return hit;
  };
}
