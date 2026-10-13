/**
 * Who returned a car the office marked as out.
 *
 * A marked-out rental names a placeholder renter: at most a name the office
 * typed, and an address nobody can receive (lib/admin/markOut.ts). The return
 * form is the first time the renter says who they are, so for such a rental —
 * and only such a rental — it is taken:
 *
 *   - a customer already holding that address (an earlier contract): the
 *     rental points at them, and the placeholder is left naming nobody;
 *   - otherwise the placeholder row itself takes the name and address.
 *
 * A rental with a recorded renter is never touched: the form is public, and a
 * typed address that differs from the one on file is a flag for the office
 * (`emailMatchesCustomer`), not a change of renter.
 *
 * The rental's fines that were waiting only for an address follow; their ids
 * come back so the caller can send them once the return is saved. See
 * lib/fines/renter.ts.
 */

import type { Prisma } from "@/generated/prisma/client";
import { refreshFineRenters } from "@/lib/fines/renter";
import { normaliseEmail } from "./customers";
import { isPlaceholderEmail } from "./placeholder";

export async function adoptReturningRenter(
  tx: Prisma.TransactionClient,
  input: {
    organisationId: string;
    rentalId: string;
    firstName: string;
    lastName: string;
    email: string;
    now: Date;
  }
): Promise<string[]> {
  const rental = await tx.rental.findUniqueOrThrow({
    where: { id: input.rentalId },
    select: { customerId: true, customer: { select: { email: true } } },
  });
  if (!isPlaceholderEmail(rental.customer.email)) return [];

  const email = normaliseEmail(input.email);
  const existing = await tx.customer.findUnique({
    where: { organisationId_email: { organisationId: input.organisationId, email } },
    select: { id: true },
  });

  if (existing) {
    await tx.rental.update({ where: { id: input.rentalId }, data: { customerId: existing.id } });
  } else {
    await tx.customer.update({
      where: { id: rental.customerId },
      data: { firstName: input.firstName.trim(), lastName: input.lastName.trim(), email },
    });
  }

  await tx.rentalEvent.create({
    data: {
      rentalId: input.rentalId,
      type: "rental.renter.from-return",
      payload: {
        placeholderCustomerId: rental.customerId,
        customerId: existing?.id ?? rental.customerId,
        matchedExisting: existing !== null,
        name: `${input.firstName.trim()} ${input.lastName.trim()}`,
      },
    },
  });

  return refreshFineRenters(tx, input.rentalId, input.now);
}
