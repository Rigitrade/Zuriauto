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

import { PAYMENT_URL, TWINT_URL } from "@/lib/payment";
import { labelsFor, type RentalLanguage } from "./labels";

export interface CustomerEmailInput {
  language: RentalLanguage;
  customerName: string;
  /** "Vertrags-Nr." or "Rückgabe-Nr." — the label beside the reference. */
  referenceLabel: string;
  referenceNumber: string;
  /** The one-line message: "Im Anhang finden Sie …". */
  hello: string;
  body: string;
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
  const L = labelsFor(input.language);
  const name = escapeHtml(input.customerName.trim());
  const [signOff, brand = "ZURIAUTO"] = L.email.customerSignature.split("\n");

  const text = [
    `${input.hello} ${input.customerName.trim()}`,
    "",
    input.body,
    "",
    `${input.referenceLabel}: ${input.referenceNumber}`,
    "",
    `${L.email.customerPayment}`,
    PAYMENT_URL,
    "",
    `${L.email.customerPaymentTwint}`,
    TWINT_URL,
    "",
    L.email.customerSignature,
  ].join("\n");

  // Deliberately plain: a white page, one wordmark, one rule, text, two
  // buttons. A rental confirmation should read like a letter, not a campaign.
  const html = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;padding:32px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:540px;width:100%;">
        <tr>
          <td style="padding:0 0 16px;border-bottom:2px solid #0f172a;">
            <span style="font-family:${FONT};font-size:17px;letter-spacing:5px;font-weight:bold;color:#0f172a;">ZURIAUTO</span>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 0 0;font-family:${FONT};font-size:15px;line-height:1.65;color:#1e293b;">
            <p style="margin:0 0 16px;">${escapeHtml(input.hello)} ${name}</p>
            <p style="margin:0 0 16px;">${escapeHtml(input.body)}</p>
            <p style="margin:0 0 28px;color:#475569;">${escapeHtml(input.referenceLabel)}: <strong style="color:#0f172a;">${escapeHtml(input.referenceNumber)}</strong></p>

            <p style="margin:0 0 14px;color:#475569;">${escapeHtml(L.result.payHint)}</p>
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 32px;">
              <tr>
                <td style="padding:0 10px 0 0;">
                  <a href="${PAYMENT_URL}" style="display:inline-block;background-color:#0f172a;color:#ffffff;text-decoration:none;font-family:${FONT};font-size:14px;padding:11px 24px;border-radius:6px;">${escapeHtml(L.result.payWithCard)}</a>
                </td>
                <td>
                  <a href="${TWINT_URL}" style="display:inline-block;border:1px solid #0f172a;color:#0f172a;text-decoration:none;font-family:${FONT};font-size:14px;padding:10px 24px;border-radius:6px;">${escapeHtml(L.result.payWithTwint)}</a>
                </td>
              </tr>
            </table>

            <p style="margin:0;">${escapeHtml(signOff)}<br />${escapeHtml(brand)}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 0 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="border-top:1px solid #e2e8f0;padding:14px 0 0;font-family:${FONT};font-size:12px;color:#94a3b8;">
                  ZURIAUTO &middot; A brand by Rigitrade AG &middot; <a href="https://zuriauto.ch" style="color:#94a3b8;">zuriauto.ch</a>
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
