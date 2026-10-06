/**
 * The Swiss QR-bill, read from the text its QR code carries.
 *
 * Every Swiss payment slip since 2022 carries one, and a fine letter's slip is
 * no exception. Its content is a fixed list of lines (SIX, "Swiss
 * Implementation Guidelines for the QR-bill", version 2.x):
 *
 *    0  SPC                   header
 *    1  0200                  version
 *    2  1                     coding
 *    3  IBAN
 *    4–10  creditor           address type, name, line 1, line 2, postcode,
 *                             town, country
 *   11–17  ultimate creditor  reserved, empty
 *   18  amount                "40.00", or empty for an open amount
 *   19  currency              CHF or EUR
 *   20–26  debtor             here: Rigitrade AG, the keeper
 *   27  reference type        QRR, SCOR or NON
 *   28  reference
 *   29  unstructured message  where the police put the fine number
 *   30  EPD                   trailer
 *   31  bill information      optional
 *
 * Decoded, not recognised: every value here is exact. That is why the amount
 * and the reference are taken from this and never from OCR.
 */

export interface QrBill {
  iban: string;
  creditorName: string;
  creditorPostalCode: string;
  creditorTown: string;
  /** Null for a slip that leaves the amount to the payer. */
  amountCents: number | null;
  currency: "CHF" | "EUR";
  referenceType: "QRR" | "SCOR" | "NON";
  reference: string;
  message: string;
  billInfo: string;
}

/**
 * "40.00" → 4000, on the string, never through a float: 0.1 + 0.2 is the
 * whole reason money columns in this schema are integers.
 */
function amountToCents(text: string): number | null | "invalid" {
  if (text === "") return null;
  const match = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) return "invalid";
  const francs = Number(match[1]);
  const cents = Number((match[2] ?? "").padEnd(2, "0"));
  return francs * 100 + cents;
}

export function parseQrBill(text: string): QrBill | null {
  const lines = text.split(/\r\n|\r|\n/);
  if (lines.length < 31 || lines[0] !== "SPC" || lines[30] !== "EPD") {
    return null;
  }

  const amountCents = amountToCents(lines[18].trim());
  if (amountCents === "invalid") return null;

  const currency = lines[19].trim();
  if (currency !== "CHF" && currency !== "EUR") return null;

  const referenceType = lines[27].trim();
  if (referenceType !== "QRR" && referenceType !== "SCOR" && referenceType !== "NON") {
    return null;
  }

  return {
    iban: lines[3].trim(),
    creditorName: lines[5].trim(),
    creditorPostalCode: lines[8].trim(),
    creditorTown: lines[9].trim(),
    amountCents,
    currency,
    referenceType,
    reference: lines[28].trim(),
    message: lines[29].trim(),
    billInfo: (lines[31] ?? "").trim(),
  };
}

/**
 * The payment slip among everything a letter's QR codes say.
 *
 * A letter usually carries more than one code — a link to the issuer's
 * portal, an eBill code — and only one of them is a QR-bill.
 */
export function pickQrBill(texts: string[]): QrBill | null {
  for (const text of texts) {
    const bill = parseQrBill(text);
    if (bill) return bill;
  }
  return null;
}
