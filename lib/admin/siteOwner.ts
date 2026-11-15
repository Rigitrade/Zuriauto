import { findSiteOrganisation } from "@/lib/organisation";

/**
 * True for an owner of the company that runs the site (ZURIAUTO): the only
 * accounts that may create partner companies (15.11.2026). A partner's owner
 * is an owner too, of its own company, and must not mint companies.
 */
export async function isSiteOwner(user: { role: "owner" | "staff"; organisationId: string }): Promise<boolean> {
  if (user.role !== "owner") return false;
  return (await findSiteOrganisation())?.id === user.organisationId;
}
