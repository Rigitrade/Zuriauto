/**
 * Asking for money, without knowing who processes it.
 *
 * The requirement is TWINT, not a particular provider (roadmap decision 3), so
 * the rental lifecycle talks to this interface and nothing else. Two operations
 * are enough: create a request for an amount against a reference and get back a
 * URL, and — later, when a provider exists — learn that it was paid.
 *
 * Stripe, the SumUp API or a Swiss PSP such as Payrexx slot in by adding one
 * module beside `sumupLink.ts`. Nothing above this line changes.
 */

export interface PaymentRequest {
  amountCents: number;
  currency: string;
  /** What the office would quote on the phone — a contract number and a week. */
  reference: string;
  description: string;
}

export interface PaymentRequestResult {
  /** Where to send the payer. */
  url: string;
  /**
   * The provider's own identifier, when it has one.
   *
   * Null for the static-link implementation, which is exactly why payment has
   * to be confirmed by hand there — there is nothing to reconcile against.
   */
  providerRef: string | null;
}

export interface PaymentProvider {
  readonly name: string;
  /**
   * Whether this provider can confirm payment by itself.
   *
   * False means the office marks a charge paid, and the reconciliation pass
   * that repairs missed webhooks has nothing to do. Surfaced rather than
   * implied so the admin screens in Phase 5 can say so out loud instead of
   * showing a payment state that is quietly always a guess.
   */
  readonly confirmsAutomatically: boolean;

  createRequest(request: PaymentRequest): Promise<PaymentRequestResult>;
}

export { createSumUpLinkProvider } from "./sumupLink";
export { getPaymentProvider } from "./resolve";
