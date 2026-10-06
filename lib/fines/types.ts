/**
 * What reading a fine letter produces.
 *
 * Every field carries how it was found and how far it can be trusted, because
 * the decision to email a renter without a human looking is made from these
 * statuses — never from a single confidence number, which OCR cannot honestly
 * give. See the spec, "Fields, and how each is found".
 */

export type FineLanguage = "de" | "fr" | "it";

/**
 *  CONFIRMED  exact (decoded from the QR-bill) or matched against our own data
 *  READ       one source, found under its label, passes its format check
 *  DOUBTFUL   a guess, a low-confidence read, or failed a plausibility check
 *  MISSING    not found
 */
export type FieldStatus = "CONFIRMED" | "READ" | "DOUBTFUL" | "MISSING";

export type FieldSource = "qr" | "ocr" | "fleet" | "office";

export interface Field<T> {
  value: T | null;
  status: FieldStatus;
  source: FieldSource | null;
  /** The text it was read from, for the office to check against. */
  snippet: string | null;
}

export type DocumentKind = "NOTICE" | "REMINDER" | "NOT_A_FINE" | "UNREADABLE";

export type IssuerKind = "POLICE" | "PRIVATE";

export interface Check {
  name: string;
  passed: boolean;
  detail: string;
}

export interface Extraction {
  language: FineLanguage | null;
  kind: DocumentKind;
  issuerKind: IssuerKind | null;
  issuerName: Field<string>;
  issuerIban: Field<string>;
  fineNumber: Field<string>;
  paymentReference: Field<string>;
  amountCents: Field<number>;
  /** The total the OCR found printed, kept to compare against the QR's. */
  printedAmountCents: number | null;
  /** The plate as printed, before it is matched against the fleet. */
  plateText: Field<string>;
  /** YYYY-MM-DD, Zurich calendar. */
  violationDate: Field<string>;
  /** HH:mm, Zurich wall clock. */
  violationTime: Field<string>;
  location: Field<string>;
  offenceCode: Field<string>;
  offenceText: Field<string>;
  speedMeasuredKmh: Field<number>;
  speedLimitKmh: Field<number>;
  letterDate: Field<string>;
  dueDate: Field<string>;
  checks: Check[];
}

export function missing<T>(): Field<T> {
  return { value: null, status: "MISSING", source: null, snippet: null };
}

export function field<T>(
  value: T,
  status: Exclude<FieldStatus, "MISSING">,
  source: FieldSource,
  snippet: string | null
): Field<T> {
  return { value, status, source, snippet };
}
