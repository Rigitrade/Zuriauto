/**
 * Whether a police fine's driver can be named to the authority without a
 * person looking, and if not, why not.
 *
 * The owner's decision of 16.10.2026: a fine from the police is no longer sent
 * to the renter to pay and prove; the authority is told who drove, and deals
 * with them directly. It is sent automatically only when nothing is in doubt.
 * Everything else waits for the office with the reason in words, because the
 * one mistake this cannot afford is a renter's name, birth date and address in
 * a stranger's inbox.
 *
 * Pure: the facts in, a decision out. `nominate.ts` gathers the facts and acts.
 */

import { isPlaceholderEmail } from "@/lib/rental/placeholder";

export type NominationHold =
  | "NOMINATION_DRIVER_INCOMPLETE"
  | "NOMINATION_NO_NUMBER"
  | "NOMINATION_NO_AUTHORITY"
  | "NOMINATION_NO_EMAIL"
  | "NOMINATION_SEVERAL_EMAILS"
  | "NOMINATION_NEW_ADDRESS"
  | "NOMINATION_ADDRESS_CHANGED";

export type NominationDecision =
  | { send: true; to: string }
  | {
      send: false;
      reason: NominationHold;
      /** The address the letter shows, when it shows exactly one. */
      suggestion: string | null;
    };

export interface Driver {
  firstName: string;
  lastName: string;
  birthDate: Date | null;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  phone: string;
  email: string;
}

export interface NominationFacts {
  driver: Driver | null;
  fineNumber: string | null;
  /** The payment slip's account, which is how the authority is recognised. */
  iban: string | null;
  /** Every address the authority's letters show, ours left out. */
  emailsOnLetter: string[];
  /** The address the office confirmed for this authority, if any. */
  confirmedEmail: string | null;
}

/** Our own addresses: a letter addressed to us shows them too. */
const OWN_DOMAINS = ["zuriauto.ch", "rigitrade.ch"];

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/g;

/**
 * The email addresses printed on a letter, as OCR read them.
 *
 * Spaces OCR puts around the "@" are closed up; nothing else is repaired. An
 * address the pattern does not accept is not guessed at — it is simply not
 * found, and the fine waits for the office as "no address on the letter".
 */
export function emailsOnLetter(text: string): string[] {
  const found = text
    .toLowerCase()
    .replace(/\s*@\s*/g, "@")
    .match(EMAIL);
  if (!found) return [];
  const addresses = found
    .map((address) => address.replace(/^[._%+-]+|[._-]+$/g, ""))
    .filter((address) => {
      const domain = address.split("@")[1] ?? "";
      return (
        !OWN_DOMAINS.some((own) => domain === own || domain.endsWith(`.${own}`)) &&
        !isPlaceholderEmail(address)
      );
    });
  return [...new Set(addresses)];
}

/** What the authority is told, and all of it has to be there. */
export function driverIsComplete(driver: Driver | null): driver is Driver {
  if (!driver || isPlaceholderEmail(driver.email)) return false;
  return [driver.firstName, driver.lastName, driver.street, driver.postalCode, driver.city]
    .every((part) => part.trim() !== "") && driver.birthDate !== null;
}

/**
 * Send, or hold for the office with the reason.
 *
 * The address must be one the office has confirmed for this authority, and
 * must not be contradicted by the letter: a letter that prints addresses has to
 * print the confirmed one. Confirmed alone would carry an old address past a
 * letter that announces a new one; printed alone would trust a single OCR
 * reading with personal data.
 *
 * A letter that prints none — the Kantonspolizei Zürich prints none — goes to
 * the confirmed address (the owner, 16.10.2026): the authority is the same
 * payment-slip account the office confirmed it for, and nothing on the letter
 * says otherwise. With nothing confirmed yet, it waits for the office.
 */
export function decideNomination(facts: NominationFacts): NominationDecision {
  const emails = facts.emailsOnLetter;
  const suggestion = emails.length === 1 ? emails[0] : null;
  const hold = (reason: NominationHold): NominationDecision => ({
    send: false,
    reason,
    suggestion,
  });

  if (!driverIsComplete(facts.driver)) return hold("NOMINATION_DRIVER_INCOMPLETE");
  if (!facts.fineNumber?.trim()) return hold("NOMINATION_NO_NUMBER");
  if (!facts.iban) return hold("NOMINATION_NO_AUTHORITY");

  const confirmed = facts.confirmedEmail?.toLowerCase() ?? null;
  if (emails.length === 0) {
    return confirmed ? { send: true, to: confirmed } : hold("NOMINATION_NO_EMAIL");
  }
  if (confirmed && emails.includes(confirmed)) return { send: true, to: confirmed };
  if (confirmed) return hold("NOMINATION_ADDRESS_CHANGED");
  if (emails.length > 1) return hold("NOMINATION_SEVERAL_EMAILS");
  return hold("NOMINATION_NEW_ADDRESS");
}

/** The kill switch: `FINES_DRIVER_NOMINATION=off` puts police fines back on
 *  the renter-pays path. */
export function nominationEnabled(
  env: Record<string, string | undefined> = process.env
): boolean {
  return env.FINES_DRIVER_NOMINATION !== "off";
}

/** A plain email address, for the one the office types in. */
export function isEmailAddress(value: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(value.trim());
}
