import type { PaymentProvider } from "./index";
import { createSumUpLinkProvider } from "./sumupLink";

let cached: PaymentProvider | null = null;

/**
 * The provider this deployment uses.
 *
 * One entry today. It exists as a function rather than a constant so that
 * adding a real provider is a change here and nowhere else — the passes and the
 * extension flow never name a provider.
 */
export function getPaymentProvider(): PaymentProvider {
  cached ??= createSumUpLinkProvider();
  return cached;
}
