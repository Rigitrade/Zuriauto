/**
 * The address a renter nobody has recorded gets.
 *
 * Some cars went out before the system existed, or on paper, and the office
 * needs them back in the database so a return can be recorded against them.
 * A `Rental` must name a `Customer`, and a `Customer` must have an email that
 * is unique within the organisation — so a car marked out without a renter
 * still needs an address, and it must be one that can never reach anybody.
 *
 * `.invalid` is reserved by RFC 2606 for exactly this. It has no registry and
 * no DNS, so a message sent to one cannot be delivered anywhere, by accident
 * or otherwise. A plausible-looking domain would eventually be registered by
 * somebody, and a stranger would start receiving other people's rental
 * contracts.
 *
 * The UUID makes each one unique, because the unique index is per address: one
 * shared placeholder would mean every unrecorded rental pointed at the same
 * customer row, and filling in the real renter on one would rename all of them.
 */

export const PLACEHOLDER_EMAIL_DOMAIN = "unrecorded.invalid";

export function placeholderEmail(id: string): string {
  return `renter-${id}@${PLACEHOLDER_EMAIL_DOMAIN}`;
}

/**
 * Whether this address is a stand-in rather than somebody's inbox.
 *
 * Read before sending the customer's copy of anything. The send would fail
 * regardless — there is no such domain — but failing on purpose is different
 * from failing by accident: it costs no SMTP round trip, produces no bounce
 * landing in the office inbox, and says in the log that nothing was expected
 * to be delivered.
 */
export function isPlaceholderEmail(email: string | null | undefined): boolean {
  if (!email) return true;
  return email.trim().toLowerCase().endsWith(`@${PLACEHOLDER_EMAIL_DOMAIN}`);
}

/**
 * A birth date for somebody whose birth date nobody knows.
 *
 * `Customer.birthDate` is not nullable, so a row has to carry something. The
 * sentinel is deliberately absurd rather than plausible: a made-up date in the
 * right range would be indistinguishable from a real one forever, and somebody
 * would eventually check a licence against it. 1900 is visibly not a birthday.
 *
 * The same value the legacy import uses for its orphan renter, so one query
 * finds every customer who still needs a human.
 */
export const UNKNOWN_BIRTH_DATE = new Date("1900-01-01T00:00:00.000Z");
