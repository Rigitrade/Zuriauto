import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { POWERED_BY, type CompanyIdentity } from "@/lib/company/identity";
import { PartnerFrameMarker } from "./PartnerFrameMarker";

/**
 * The frame around a partner's pages (multi-company phase C, 16.11.2026):
 * the partner's name at the top, its contact details and "powered by
 * ZURIAUTO" at the foot (Ahmed, 15.11.2026). Not ZURIAUTO's site header,
 * whose booking buttons and phone number would send the partner's renter to
 * ZURIAUTO.
 */
export function PartnerLayout(props: {
  company: Pick<
    CompanyIdentity,
    "brandName" | "legalName" | "street" | "postalCode" | "city" | "phone" | "officeEmail" | "website"
  >;
  children: React.ReactNode;
}) {
  const { company } = props;
  const email = company.officeEmail?.split(",")[0]?.trim() || null;
  const place = [company.postalCode, company.city].filter(Boolean).join(" ");
  const address = [company.street, place].filter(Boolean).join(", ");

  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      <PartnerFrameMarker />
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
          <span className="text-lg font-semibold tracking-tight text-slate-900">{company.brandName}</span>
          <LanguageSwitcher />
        </div>
      </header>
      <main>{props.children}</main>
      <footer className="mt-12 border-t border-slate-200 bg-slate-50">
        <div className="mx-auto grid max-w-5xl gap-1 px-4 py-6 text-sm text-slate-600">
          <p className="font-medium text-slate-800">{company.legalName}</p>
          {address && <p>{address}</p>}
          {(company.phone || email) && (
            <p>
              {company.phone && <a href={`tel:${company.phone.replace(/\s+/g, "")}`}>{company.phone}</a>}
              {company.phone && email && " · "}
              {email && <a href={`mailto:${email}`}>{email}</a>}
            </p>
          )}
          <p className="mt-2 text-xs text-slate-400">{POWERED_BY}</p>
        </div>
      </footer>
    </div>
  );
}
