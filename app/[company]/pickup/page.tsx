import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PartnerLayout } from "@/components/company/PartnerLayout";
import RentalPickupWizard from "@/components/rental/RentalPickupWizard";
import { publicCompany } from "@/lib/company/identity";
import { partnerForPage, partnerPageMetadata } from "@/lib/company/partnerPage";

/**
 * A partner's pickup contract, at /<slug>/pickup/ (multi-company phase C,
 * 16.11.2026): only its cars, and the contract is its own. ZURIAUTO's name
 * goes to /pickup/, which stays as it was.
 */

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ company: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { company } = await params;
  const found = await partnerForPage(company);
  const brand = found && found !== "site" ? found.identity.brandName : null;
  const slug = found && found !== "site" ? found.slug : company;
  return partnerPageMetadata(brand, "Mietvertrag", `/${slug}/pickup/`);
}

export default async function PartnerPickupPage({ params }: Props) {
  const found = await partnerForPage((await params).company);
  if (!found) notFound();
  if (found === "site") redirect("/pickup/");

  return (
    <PartnerLayout company={found.identity}>
      <RentalPickupWizard companySlug={found.slug} initialCompany={publicCompany(found.identity)} />
    </PartnerLayout>
  );
}
