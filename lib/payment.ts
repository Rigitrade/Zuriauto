/**
 * The single source of truth for the ZURIAUTO payment links.
 *
 * Mirrors `lib/whatsapp.ts`: the footer button, the contract result screen and
 * the contract email all read from here, so they cannot drift apart if a link
 * is ever reissued.
 *
 * Both pages are hosted by the provider, which means no card details ever
 * reach this application — the customer leaves for the provider's own checkout
 * and returns. That is deliberate: taking payment details here would drag PCI
 * obligations into a static marketing site.
 *
 * Neither link carries an amount. The provider's page asks for it, so the
 * customer or the office enters what is owed. Charging an exact figure per
 * rental needs the provider APIs and the commercial terms the contract does
 * not yet record, and belongs with the Phase 2 rentals table.
 */

/** SumUp checkout — credit and debit cards. */
export const PAYMENT_URL = "https://pay.sumup.com/b2c/QH47IRGK";

/** TWINT checkout, as issued by TWINT for the merchant account. */
export const TWINT_URL =
  "https://go.twint.ch/1/e/tw?tw=acq.lf42UVlQQmWchQ9Tc9F26Jz5NoLlBomH_GHXKQtNDVX2QFYuD_n6mKCpYAihzGcx";
