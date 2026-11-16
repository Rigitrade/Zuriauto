import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PartnerLayout } from "@/components/company/PartnerLayout";
import RentalReturnWizard from "@/components/rental/RentalReturnWizard";
import { publicCompany } from "@/lib/company/identity";
import { partnerForPage, partnerPageMetadata } from "@/lib/company/partnerPage";

/**
 * A partner's return form, at /<slug>/return/ (multi-company phase C,
 * 16.11.2026): only its rented cars, and the report goes to its office. ZURIAUTO's name
 * goes to /return/, which stays as it was.
 */

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ company: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { company } = await params;
  const found = await partnerForPage(company);
  const brand = found && found !== "site" ? found.identity.brandName : null;
  const slug = found && found !== "site" ? found.slug : company;
  return partnerPageMetadata(brand, "Fahrzeugrückgabe", `/${slug}/return/`);
}

export default async function PartnerReturnPage({ params }: Props) {
  const found = await partnerForPage((await params).company);
  if (!found) notFound();
  if (found === "site") redirect("/return/");

  return (
    <PartnerLayout company={found.identity}>
      <RentalReturnWizard companySlug={found.slug} initialCompany={publicCompany(found.identity)} />
    </PartnerLayout>
  );
}
