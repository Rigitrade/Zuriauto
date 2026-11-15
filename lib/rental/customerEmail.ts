/**
 * The customer-facing email for both flows — contract and return.
 *
 * Each send carries two bodies: a branded HTML part and a plain-text part
 * with the same content. Clients that render HTML get the card; everything
 * else (old clients, screen readers, strict corporate filters) falls back to
 * the text, so no customer gets an empty message.
 *
 * Email HTML is written to survive real clients rather than to be pretty in
 * a browser: table layout, inline styles only, no external images or fonts —
 * remote assets are blocked by default in most inboxes and trip spam
 * scoring. The wordmark is therefore text, as it is in the PDF header.
 */

import { POWERED_BY, signOff, withCompany, type CompanyIdentity } from "@/lib/company/identity";
import { labelsFor, type RentalLanguage, payHintFor } from "./labels";

export interface CustomerEmailInput {
  language: RentalLanguage;
  customerName: string;
  /** "Vertrags-Nr." or "Rückgabe-Nr." — the label beside the reference. */
  referenceLabel: string;
  referenceNumber: string;
  /** The one-line message: "Im Anhang finden Sie …". */
  hello: string;
  body: string;
  /**
   * The renting company (multi-company phase B, 15.11.2026): its wordmark,
   * sign-off, footer and payment links. A partner adds "powered by ZURIAUTO".
   */
  company: CompanyIdentity;
}

/** The customer's name is form input; anything else would be an XSS vector
 * into their own inbox. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const FONT = "Arial, Helvetica, sans-serif";

export function buildCustomerEmail(input: CustomerEmailInput): {
  text: string;
  html: string;
} {
  const { company } = input;
  const L = withCompany(labelsFor(input.language), company);
  const name = escapeHtml(input.customerName.trim());
  const closing = signOff(company, input.language);
  const { paymentUrl, twintUrl } = company;

  const text = [
    `${input.hello} ${input.customerName.trim()}`,
    "",
    input.body,
    "",
    `${input.referenceLabel}: ${input.referenceNumber}`,
    "",
    // A link the company does not have is left out, never filled with
    // ZURIAUTO's: a partner's renter must not pay ZURIAUTO.
    ...(paymentUrl ? [L.email.customerPayment, paymentUrl, ""] : []),
    ...(twintUrl ? [L.email.customerPaymentTwint, twintUrl, ""] : []),
    ...closing,
  ].join("\n");

  const payButtons = [
    paymentUrl
      ? `                <td style="padding:0 10px 0 0;">
                  <a href="${escapeHtml(paymentUrl)}" style="display:inline-block;background-color:#0f172a;color:#ffffff;text-decoration:none;font-family:${FONT};font-size:14px;padding:11px 24px;border-radius:6px;">${escapeHtml(L.result.payWithCard)}</a>
                </td>`
      : null,
    twintUrl
      ? `                <td>
                  <a href="${escapeHtml(twintUrl)}" style="display:inline-block;border:1px solid #0f172a;color:#0f172a;text-decoration:none;font-family:${FONT};font-size:14px;padding:10px 24px;border-radius:6px;">${escapeHtml(L.result.payWithTwint)}</a>
                </td>`
      : null,
  ].filter(Boolean);

  const payment = payButtons.length
    ? `
            <p style="margin:0 0 14px;color:#475569;">${escapeHtml(payHintFor(input.language, L.result, company))}</p>
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 32px;">
              <tr>
${payButtons.join("\n")}
              </tr>
            </table>
`
    : "\n";

  const footer = [
    escapeHtml(company.brandName),
    company.legalName !== company.brandName ? `A brand by ${escapeHtml(company.legalName)}` : null,
    company.website
      ? `<a href="https://${escapeHtml(company.website)}" style="color:#94a3b8;">${escapeHtml(company.website)}</a>`
      : null,
    company.poweredBy ? POWERED_BY : null,
  ]
    .filter(Boolean)
    .join(" &middot; ");

  // Deliberately plain: a white page, one wordmark, one rule, text, two
  // buttons. A rental confirmation should read like a letter, not a campaign.
  //
  // Flush left rather than centred. The attachment chip the client draws
  // below the body is anchored to the window edge, so a centred column left
  // the message and its own PDF visibly out of line with each other. The
  // width is still capped, so the text does not run the full width of a
  // desktop window.
  const html = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;padding:28px 20px;">
  <tr>
    <td align="left">
      <table role="presentation" align="left" cellpadding="0" cellspacing="0" style="max-width:540px;width:100%;text-align:left;">
        <tr>
          <td style="padding:0 0 16px;border-bottom:2px solid #0f172a;">
            <span style="font-family:${FONT};font-size:17px;letter-spacing:5px;font-weight:bold;color:#0f172a;">${escapeHtml(company.brandName)}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 0 0;font-family:${FONT};font-size:15px;line-height:1.65;color:#1e293b;">
            <p style="margin:0 0 16px;">${escapeHtml(input.hello)} ${name}</p>
            <p style="margin:0 0 16px;">${escapeHtml(input.body)}</p>
            <p style="margin:0 0 28px;color:#475569;">${escapeHtml(input.referenceLabel)}: <strong style="color:#0f172a;">${escapeHtml(input.referenceNumber)}</strong></p>
${payment}
            <p style="margin:0;">${closing.map(escapeHtml).join("<br />")}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 0 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="border-top:1px solid #e2e8f0;padding:14px 0 0;font-family:${FONT};font-size:12px;color:#94a3b8;">
                  ${footer}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;

  return { text, html };
}
