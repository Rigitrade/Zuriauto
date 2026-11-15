import { PAYMENT_URL, TWINT_URL } from "@/lib/payment";

/**
 * Who rents the car: the company a renter, an authority or an office mail
 * names (multi-company phase B, 15.11.2026).
 *
 * Pure, with no database import, because the pickup and return wizards build
 * their PDFs in the browser and need the same value there. The server side
 * loads it with `loadCompanyIdentity` (./load.ts).
 */
export interface CompanyIdentity {
  /** The name renters know, drawn as the wordmark: "ZURIAUTO". */
  brandName: string;
  /** Who the contract is with: "Rigitrade AG". */
  legalName: string;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  uid: string | null;
  phone: string | null;
  /**
   * Where office mails go; a comma-separated list is allowed. Null for
   * ZURIAUTO means the `MAIL_OFFICE` setting, as today.
   */
  officeEmail: string | null;
  /** Who signs letters to authorities: "Katamesh, Ahmed". */
  signerName: string | null;
  /** Without scheme: "zuriauto.ch". */
  website: string | null;
  /** The place a renter signs at unless they change it: "Zurich". */
  signingPlace: string;
  /** Card payment link; null hides every card payment button and line. */
  paymentUrl: string | null;
  /** TWINT payment link; null hides every TWINT button and line. */
  twintUrl: string | null;
  /** A partner company: its renters read "powered by ZURIAUTO" (Ahmed, 15.11.2026). */
  poweredBy: boolean;
}

/** The columns of `Organisation` that hold the identity. */
export interface CompanyColumns {
  name: string;
  brandName: string | null;
  legalName: string | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  uid: string | null;
  phone: string | null;
  officeEmail: string | null;
  signerName: string | null;
  website: string | null;
  signingPlace: string | null;
  paymentUrl: string | null;
  twintUrl: string | null;
}

/** Exactly what ZURIAUTO's documents and mails printed before phase B. */
export const ZURIAUTO_IDENTITY: CompanyIdentity = {
  brandName: "ZURIAUTO",
  legalName: "Rigitrade AG",
  street: "Schaffhauserstrasse 550",
  postalCode: "8052",
  city: "Zürich",
  uid: "CHE-199.884.159",
  phone: "+41 58 513 99 96",
  officeEmail: null,
  signerName: "Katamesh, Ahmed",
  website: "zuriauto.ch",
  signingPlace: "Zurich",
  paymentUrl: PAYMENT_URL,
  twintUrl: TWINT_URL,
  poweredBy: false,
};

/** The platform's name in "powered by …". */
export const PLATFORM_BRAND = "ZURIAUTO";

function clean(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * The identity of a company from its row.
 *
 * The site company (ZURIAUTO) falls back to `ZURIAUTO_IDENTITY` column by
 * column, so an empty or not-yet-migrated database prints exactly what it
 * printed before. Any other company falls back only to its own name: a
 * partner's renter must never see ZURIAUTO's address, office or payment links.
 */
export function identityOf(org: CompanyColumns, isSite: boolean): CompanyIdentity {
  if (isSite) {
    const z = ZURIAUTO_IDENTITY;
    return {
      brandName: clean(org.brandName) ?? z.brandName,
      legalName: clean(org.legalName) ?? z.legalName,
      street: clean(org.street) ?? z.street,
      postalCode: clean(org.postalCode) ?? z.postalCode,
      city: clean(org.city) ?? z.city,
      uid: clean(org.uid) ?? z.uid,
      phone: clean(org.phone) ?? z.phone,
      officeEmail: clean(org.officeEmail) ?? z.officeEmail,
      signerName: clean(org.signerName) ?? z.signerName,
      website: clean(org.website) ?? z.website,
      signingPlace: clean(org.signingPlace) ?? z.signingPlace,
      paymentUrl: clean(org.paymentUrl) ?? z.paymentUrl,
      twintUrl: clean(org.twintUrl) ?? z.twintUrl,
      poweredBy: false,
    };
  }
  const name = clean(org.name) ?? "";
  const city = clean(org.city);
  return {
    brandName: clean(org.brandName) ?? name,
    legalName: clean(org.legalName) ?? name,
    street: clean(org.street),
    postalCode: clean(org.postalCode),
    city,
    uid: clean(org.uid),
    phone: clean(org.phone),
    officeEmail: clean(org.officeEmail),
    signerName: clean(org.signerName),
    website: clean(org.website),
    signingPlace: clean(org.signingPlace) ?? city ?? "",
    paymentUrl: clean(org.paymentUrl),
    twintUrl: clean(org.twintUrl),
    poweredBy: true,
  };
}

/** What the renter's browser gets: nothing the forms do not print. */
export type PublicCompany = Pick<
  CompanyIdentity,
  "brandName" | "legalName" | "signingPlace" | "paymentUrl" | "twintUrl" | "poweredBy"
>;

export function publicCompany(id: PublicCompany): PublicCompany {
  return {
    brandName: id.brandName,
    legalName: id.legalName,
    signingPlace: id.signingPlace,
    paymentUrl: id.paymentUrl,
    twintUrl: id.twintUrl,
    poweredBy: id.poweredBy,
  };
}

/** "powered by ZURIAUTO", the same in German and English. */
export const POWERED_BY = `powered by ${PLATFORM_BRAND}`;

/** What a renter mail needs of the company to close in its name. */
export type CompanyBrand = Pick<CompanyIdentity, "brandName" | "poweredBy">;

/** The closing lines of a renter mail. */
export function signOff(id: CompanyBrand, language: "de" | "en"): string[] {
  return [
    language === "en" ? "Kind regards" : "Freundliche Grüsse",
    id.brandName,
    ...(id.poweredBy ? [POWERED_BY] : []),
  ];
}

/**
 * Fills `{company}` with the brand name in every string of a value: the
 * rental labels name the renting company this way since phase B. Functions
 * and other values pass through unchanged.
 */
export function withCompany<T>(value: T, company: Pick<CompanyIdentity, "brandName">): T {
  if (typeof value === "string") return value.replaceAll("{company}", company.brandName) as T;
  if (Array.isArray(value)) return value.map((item) => withCompany(item, company)) as T;
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, withCompany(item, company)])
    ) as T;
  }
  return value;
}

/**
 * The mail domains that are the keeper's own, so an address of ours printed
 * on an authority's letter is never taken for the authority's. ZURIAUTO's two
 * always count; a partner adds its website's and office's.
 */
export function ownMailDomains(id: Pick<CompanyIdentity, "website" | "officeEmail">): string[] {
  const domains = ["zuriauto.ch", "rigitrade.ch"];
  const website = id.website?.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  if (website) domains.push(website);
  for (const address of id.officeEmail?.split(",") ?? []) {
    const domain = address.trim().toLowerCase().split("@")[1];
    if (domain) domains.push(domain);
  }
  return [...new Set(domains)];
}
