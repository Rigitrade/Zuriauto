/**
 * Is this really TWINT?
 *
 * Anyone can send info@ an email laid out exactly like TWINT's. What they
 * cannot do is sign it with TWINT's key: twintpay.ch publishes DKIM keys
 * (selector1/2, its Microsoft 365 tenant) and DMARC p=reject. The site checks
 * the signature itself rather than trusting a header Hostinger may or may not
 * add, and asks three things of it beyond "pass":
 *
 *   - it is TWINT's domain that signed, not a lookalike;
 *   - it covers From, so the sender cannot be swapped under it;
 *   - it has no l= body limit, under which text can be appended unsigned.
 */

import type { DNSResolver } from "mailauth";
import { dkimVerify } from "mailauth/lib/dkim/verify";

export const TWINT_SENDER = "no-reply@twintpay.ch";
const TWINT_DOMAIN = "twintpay.ch";

/** The part of mailauth's result this check reads. */
export interface DkimReport {
  headerFrom: string[];
  results: Array<{
    signingDomain?: string;
    status: { result: string };
    canonBodyLengthLimited?: boolean;
    /** mailauth gives the signed header names as one string: "From: To: Subject". */
    signingHeaders?: { keys: string };
  }>;
}

export function signedByTwint(report: DkimReport): boolean {
  const from = report.headerFrom.map((address) => address.toLowerCase());
  if (from.length !== 1 || from[0] !== TWINT_SENDER) return false;
  return report.results.some(
    (result) =>
      result.status.result === "pass" &&
      result.signingDomain?.toLowerCase() === TWINT_DOMAIN &&
      result.canonBodyLengthLimited !== true &&
      (result.signingHeaders?.keys ?? "")
        .split(":")
        .some((key) => key.trim().toLowerCase() === "from")
  );
}

export async function verifyTwintSignature(
  raw: Buffer,
  /** Tests answer DNS themselves; production asks the real DNS. */
  options: { resolver?: DNSResolver } = {}
): Promise<boolean> {
  try {
    return signedByTwint((await dkimVerify(raw, { resolver: options.resolver })) as DkimReport);
  } catch (error) {
    // A DNS failure is not a pass. The mail stays in the mailbox and the next
    // run tries again; nothing is stored in between.
    console.warn("[twint] DKIM check could not run:", error);
    return false;
  }
}
