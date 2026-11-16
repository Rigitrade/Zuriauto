import { prisma } from "@/lib/db";
import { findSiteOrganisation, organisationBySlug } from "@/lib/organisation";
import { loadCompanyIdentity } from "./load";
import type { CompanyIdentity } from "./identity";

/**
 * The company a partner page's address names (multi-company phase C,
 * 16.11.2026): `/<slug>/pickup/` and `/<slug>/return/`.
 *
 *   null      no company has that name: the page is not found.
 *   "site"    ZURIAUTO's own name: its pages are /pickup/ and /return/.
 *   partner   the partner, with what its pages print.
 */
export async function partnerForPage(
  slug: string
): Promise<null | "site" | { slug: string; identity: CompanyIdentity }> {
  const named = await organisationBySlug(decodeURIComponent(slug));
  if (!named) return null;
  const site = await findSiteOrganisation();
  if (site?.id === named.id) return "site";
  return { slug: named.slug, identity: await loadCompanyIdentity(prisma, named.id) };
}

/**
 * A partner page's title and link preview. The partner pastes these links
 * into WhatsApp, whose card is built from these tags; without them the card
 * would show ZURIAUTO's name, text and picture from the root layout. Each
 * key here replaces the root's whole entry, so nothing of ZURIAUTO's stays.
 */
export function partnerPageMetadata(
  brandName: string | null,
  heading: string,
  path: string
): import("next").Metadata {
  const title = brandName ? `${heading} – ${brandName}` : heading;
  return {
    // Absolute: the site-wide "| ZURIAUTO Car Rental" suffix is not the partner's.
    title: { absolute: title },
    description: title,
    alternates: { canonical: path },
    openGraph: { type: "website", title, description: title, siteName: brandName ?? undefined, url: path, images: [] },
    twitter: { card: "summary", title, description: title, images: [] },
  };
}
