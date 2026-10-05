/**
 * The GTC articles the renter confirms one by one, each with its own box,
 * beside accepting the terms as a whole.
 *
 * Asked for by the lessor on 05.10.2026: the article on truthful information is
 * too long for the contract itself, so it lives in the GTC and the contract
 * points at it by number. Each part gets its own tick, so the renter cannot
 * say afterwards that the warning about deception was buried in the terms.
 *
 * `key` is the field on the contract that records when the box was ticked;
 * `ref` is the sub-article heading in `locales/gtc.ts`, checked by the tests
 * to exist in every language.
 */

export const GTC_CONFIRMATIONS = [
  { key: "truthfulInfoConfirmedAt", ref: "11.1" },
  { key: "deceptionNoticeConfirmedAt", ref: "11.2" },
] as const;

export type GtcConfirmationKey = (typeof GTC_CONFIRMATIONS)[number]["key"];
