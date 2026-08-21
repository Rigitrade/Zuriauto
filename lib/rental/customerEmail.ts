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

  const html = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:24px 12px;">
  <tr>
    <td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:12px;">
        <tr>
          <td style="padding:26px 32px 18px;border-bottom:1px solid #f1f5f9;">
            <span style="font-family:${FONT};font-size:19px;letter-spacing:6px;font-weight:bold;color:#0f172a;">ZURIAUTO</span>
          </td>
        </tr>
        <tr>
          <td style="padding:26px 32px 30px;font-family:${FONT};font-size:15px;line-height:1.6;color:#334155;">
            <p style="margin:0 0 14px;">${escapeHtml(input.hello)} ${name}</p>
            <p style="margin:0 0 22px;">${escapeHtml(input.body)}</p>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
              <tr>
                <td style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;">
                  <span style="font-family:${FONT};font-size:12px;color:#64748b;display:block;">${escapeHtml(input.referenceLabel)}</span>
                  <span style="font-family:Consolas,'Courier New',monospace;font-size:15px;color:#0f172a;font-weight:bold;">${escapeHtml(input.referenceNumber)}</span>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 14px;color:#475569;">${escapeHtml(L.result.payHint)}</p>
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:0 10px 0 0;">
                  <a href="${PAYMENT_URL}" style="display:inline-block;background-color:#059669;color:#ffffff;text-decoration:none;font-family:${FONT};font-size:14px;font-weight:bold;padding:11px 22px;border-radius:8px;">${escapeHtml(L.result.payWithCard)}</a>
                </td>
                <td>
                  <a href="${TWINT_URL}" style="display:inline-block;background-color:#0f172a;color:#ffffff;text-decoration:none;font-family:${FONT};font-size:14px;font-weight:bold;padding:11px 22px;border-radius:8px;">${escapeHtml(L.result.payWithTwint)}</a>
                </td>
              </tr>
            </table>

            <p style="margin:28px 0 0;">${escapeHtml(signOff)}<br /><strong>${escapeHtml(brand)}</strong></p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px;border-top:1px solid #f1f5f9;font-family:${FONT};font-size:12px;color:#94a3b8;">
            ZURIAUTO &middot; A brand by Rigitrade AG &middot; <a href="https://zuriauto.ch" style="color:#94a3b8;">zuriauto.ch</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;

  return { text, html };
}
