/**
 * The single source of truth for the ZURIAUTO WhatsApp number.
 *
 * Both the floating contact button and the booking form link here, so the two
 * cannot drift apart if the number ever changes.
 */
export const WHATSAPP_NUMBER = "41763666669";

/** Builds a click-to-chat link, optionally carrying a prefilled message. */
export function waLink(text?: string): string {
  const base = `https://wa.me/${WHATSAPP_NUMBER}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
