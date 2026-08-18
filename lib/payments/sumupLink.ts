import { PAYMENT_URL } from "@/lib/payment";
import type {
  PaymentProvider,
  PaymentRequest,
  PaymentRequestResult,
} from "./index";

/**
 * The degenerate implementation: the static SumUp link the site already uses.
 *
 * It carries no amount — SumUp's own page asks for one — and it cannot tell us
 * that anything was paid. Both are honest limitations rather than bugs, and the
 * Phase 2 spec named this a valid implementation of the payment interface for
 * exactly that reason: it costs nothing and unblocks everything else.
 *
 * What that means in practice: the reminder email states the amount in words
 * beside the link, and the office marks the charge paid. Until Phase 5 that is
 * a SQL statement.
 *
 * Whether this link already offers TWINT is still an open question for the
 * office. SumUp supports it in Switzerland, so the answer may be yes — in which
 * case TWINT costs zero integration work and this module is the whole payment
 * story for a while.
 */
export function createSumUpLinkProvider(): PaymentProvider {
  return {
    name: "sumup-static-link",
    confirmsAutomatically: false,

    async createRequest(
      _request: PaymentRequest
    ): Promise<PaymentRequestResult> {
      // The request is deliberately ignored. Nothing about the amount or the
      // reference can be encoded in a static link, and pretending otherwise —
      // by appending a query parameter SumUp does not read, say — would make
      // the payment page look parameterised when it is not.
      return { url: PAYMENT_URL, providerRef: null };
    },
  };
}
