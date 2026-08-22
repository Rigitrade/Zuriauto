/**
 * The phone number as stored for the desk lookup.
 *
 * One mobile reaches the database spelled four ways — `079 123 45 67`,
 * `+41 79 123 45 67`, `0041791234567`, `+41791234567` — and a lookup that
 * compares what was typed finds a returning customer only when the office
 * happens to type it the same way twice. This is the single spelling, in the
 * spirit of `normaliseEmail` in customers.ts.
 *
 * Hand-rolled rather than libphonenumber-js: 150 KB of parser to serve an
 * office typing Swiss numbers and the occasional German one, where a miss
 * degrades to typing the details by hand. If foreign numbers become common,
 * that is the upgrade.
 *
 * IMPORTANT: this function's output must stay stable for the life of the
 * `Customer.phoneKey` column. Change the rules and every key already written
 * silently stops matching — no error, just returning customers who are never
 * found again. Adding a country prefix is safe; changing how an existing input
 * maps is not, and needs a re-run of `pnpm db:backfill-phone-keys`.
 */

const SWISS_COUNTRY_CODE = "+41";

/** E.164 allows fifteen digits after the plus, and no real number is under eight. */
const MIN_DIGITS = 8;
const MAX_DIGITS = 15;

export function normalisePhone(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const explicitCountryCode = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  let e164: string;
  if (explicitCountryCode) {
    e164 = `+${digits}`;
  } else if (digits.startsWith("00")) {
    // The international access code, which is what `+` replaced.
    e164 = `+${digits.slice(2)}`;
  } else if (digits.startsWith("0")) {
    // National format. The trunk zero is a dialling instruction, not part of
    // the number, so it goes rather than being kept after the country code.
    e164 = `${SWISS_COUNTRY_CODE}${digits.slice(1)}`;
  } else {
    // No plus, no 00, no trunk zero: nothing says which country this is.
    // Refused deliberately — guessing wrong builds a key that matches the
    // wrong person, and the cost of refusing is that the details get typed.
    return null;
  }

  const length = e164.length - 1;
  if (length < MIN_DIGITS || length > MAX_DIGITS) return null;

  return e164;
}
