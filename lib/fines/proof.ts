/**
 * Whether a renter's payment screenshot shows this fine being paid.
 *
 * Two things must both be there: the amount, and something that names this
 * fine — the slip's reference or the issuer's number. The amount alone would
 * accept a screenshot of any CHF 40 payment; the reference alone, a payment
 * of the wrong sum.
 *
 * A screenshot can be faked, and this cannot tell. That risk is accepted in
 * the spec: the police send a Mahnung for a fine that was not paid, and the
 * Mahnung reopens it.
 */

export type ProofVerdict = "MATCH" | "MISMATCH" | "UNREADABLE";

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 1250 → "1['’ ]?250", so "1'250", "1’250", "1 250" and "1250" all match. */
function francsPattern(francs: number): string {
  const digits = String(francs);
  const groups: string[] = [];
  for (let end = digits.length; end > 0; end -= 3) {
    groups.unshift(digits.slice(Math.max(0, end - 3), end));
  }
  return groups.map(escape).join("['’ ]?");
}

export function showsAmount(text: string, cents: number): boolean {
  const francs = francsPattern(Math.trunc(cents / 100));
  const rappen = String(cents % 100).padStart(2, "0");
  const patterns = [
    // Not preceded by a digit or separator, so 40.00 is not found in 140.00.
    `(?<![\\d'’.,])${francs}[.,]${rappen}(?!\\d)`,
  ];
  if (rappen === "00") {
    patterns.push(`(?<![\\d'’.,])${francs}\\.[-–]`);
    patterns.push(`(?:CHF|Fr\\.?)\\s*${francs}(?![\\d.,'’])`);
  }
  return patterns.some((pattern) => new RegExp(pattern, "i").test(text));
}

function digits(text: string | null): string {
  return (text ?? "").replace(/\D/g, "");
}

export function namesFine(
  text: string,
  fine: { paymentReference: string | null; fineNumber: string | null }
): boolean {
  const all = digits(text);
  const reference = digits(fine.paymentReference);
  const number = digits(fine.fineNumber);
  // Short numbers are found anywhere by accident; only long ones identify.
  return (
    (reference.length >= 12 && all.includes(reference)) ||
    (number.length >= 6 && all.includes(number))
  );
}

export function verifyProofText(
  text: string,
  fine: { amountCents: number | null; paymentReference: string | null; fineNumber: string | null }
): ProofVerdict {
  if (text.replace(/\s/g, "").length < 10) return "UNREADABLE";
  if (fine.amountCents === null) return "MISMATCH";
  return showsAmount(text, fine.amountCents) && namesFine(text, fine) ? "MATCH" : "MISMATCH";
}
