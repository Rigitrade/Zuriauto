/**
 * The renter, recognised across rentals.
 *
 * Deduplicating on email is what turns a pile of contracts into a history —
 * without it, the fourth rental by the same driver looks like a fourth
 * stranger, and the dashboard in Phase 5 has nothing to show.
 */

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { normalisePhone } from "./phone";
import type { ContractDetails } from "./schema";

/**
 * The single spelling an address is stored under.
 *
 * Mail servers treat the local part as case-sensitive in theory and nobody
 * does in practice; a customer who typed `Anna@` on Monday and `anna@` on
 * Friday is one customer.
 */
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Finds or creates the renter, and refreshes what they told us.
 *
 * Names and addresses are updated from the newest contract: people move, and
 * the record should describe them now. The PDF keeps whatever was signed, so
 * this never rewrites history — it only changes where the next letter goes.
 */
export async function upsertCustomer(
  tx: Prisma.TransactionClient | PrismaClient,
  organisationId: string,
  details: ContractDetails
): Promise<{ id: string }> {
  const email = normaliseEmail(details.email);

  const shared = {
    firstName: details.firstName,
    lastName: details.lastName,
    phone: details.mobile,
    // Both, on purpose: `phone` is what the customer gave and what the contract
    // prints; `phoneKey` is the single spelling the desk lookup matches on.
    phoneKey: normalisePhone(details.mobile),
    // `@db.Date` drops the time, but the value must still be a Date. Building
    // it as UTC midnight keeps the stored day equal to the day that was typed,
    // which a local-midnight Date would not west of Greenwich.
    birthDate: new Date(`${details.birthDate}T00:00:00.000Z`),
    street: details.street,
    postalCode: details.postalCode,
    city: details.city,
    country: details.country,
  };

  return tx.customer.upsert({
    where: { organisationId_email: { organisationId, email } },
    create: { organisationId, email, ...shared },
    update: shared,
    select: { id: true },
  });
}
