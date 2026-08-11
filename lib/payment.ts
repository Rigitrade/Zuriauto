/**
 * The single source of truth for the ZURIAUTO payment link.
 *
 * Mirrors `lib/whatsapp.ts`: the footer button and the contract email both read
 * from here, so the two cannot drift apart if the link is ever reissued.
 *
 * SumUp hosts the payment page, which means no card details ever reach this
 * application — the customer leaves for SumUp's own checkout and returns. That
 * is deliberate: taking card numbers here would drag PCI obligations into a
 * static marketing site.
 *
 * The link carries no amount. SumUp's page asks for it, so the customer or the
 * office enters what is owed. Charging an exact figure per rental needs the
 * SumUp API and the commercial terms the contract does not yet record, and
 * belongs with the Phase 2 rentals table.
 */
export const PAYMENT_URL = "https://pay.sumup.com/b2c/QH47IRGK";
