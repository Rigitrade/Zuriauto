import { MainLayout } from "@/components/MainLayout";
import { PartnerLayout } from "@/components/company/PartnerLayout";
import { loadCompanyIdentity } from "@/lib/company/load";
import { prisma } from "@/lib/db";

/**
 * The frame of a renter's page reached from an email link: the rental's
 * "manage" page and a fine's payment page (multi-company phase C,
 * 16.11.2026). A partner's renter came from a mail in the partner's name and
 * lands on the partner's frame; ZURIAUTO's renter lands on ZURIAUTO's site,
 * as before. With no company (an unusable link) it is ZURIAUTO's site.
 */
export async function CompanyFrame(props: { organisationId: string | null; children: React.ReactNode }) {
  if (props.organisationId) {
    const company = await loadCompanyIdentity(prisma, props.organisationId);
    if (company.poweredBy) return <PartnerLayout company={company}>{props.children}</PartnerLayout>;
  }
  return <MainLayout>{props.children}</MainLayout>;
}
