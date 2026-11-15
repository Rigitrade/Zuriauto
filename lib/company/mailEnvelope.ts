import type { CompanyIdentity } from "./identity";

/**
 * One shared mail account for every company (multi-company phase B; the
 * partner's own mail server was deferred by Ahmed on 15.11.2026).
 *
 * ZURIAUTO's mail stays exactly as configured (`MAIL_FROM`, `MAIL_OFFICE`,
 * `MAIL_ARCHIVE`). A partner's mail goes out from the same address under the
 * partner's name, its office copies go to the partner's office, and nothing
 * is copied to ZURIAUTO's archive mailbox: the partner's records are in the
 * database, which ZURIAUTO sees read-only.
 */

/** The address part of `Name <address>`, or the whole value. */
function addressOf(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return (match ? match[1] : from).trim();
}

/** A display name that cannot break out of its quotes or its header line. */
function displayName(name: string): string {
  return name
    .replace(/[\r\n]+/g, " ")
    .replace(/["\\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The mail settings for one company's sends, or null when it cannot be mailed
 * on its own behalf (a partner with no office address yet): nothing is sent
 * then, and certainly not to ZURIAUTO's office.
 */
export function companyMail<T extends { from: string; office: string; archive?: string; replyTo?: string }>(
  config: T,
  company: CompanyIdentity
): T | null {
  if (!company.poweredBy) {
    return company.officeEmail ? { ...config, office: company.officeEmail } : config;
  }
  if (!company.officeEmail) return null;
  const { archive: _archive, ...rest } = config;
  void _archive;
  return {
    ...rest,
    from: `"${displayName(company.brandName)}" <${addressOf(config.from)}>`,
    office: company.officeEmail,
    // A renter's "reply to this email" reaches the partner, not the shared
    // sender's mailbox. ZURIAUTO's mail keeps no reply-to, as before.
    replyTo: company.officeEmail,
  } as T;
}
