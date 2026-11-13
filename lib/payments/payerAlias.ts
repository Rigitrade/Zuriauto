/**
 * A payer the office confirmed pays for a customer — a friend, a partner, a
 * second phone. Learnt from an office booking with "Zahler merken" ticked;
 * forgotten when that booking is undone. The customer's own email and phone
 * are never stored here: they already match.
 */

import type { Prisma } from "@/generated/prisma/client";
import type { Actor } from "@/lib/fines/events";
import { normalisePhone } from "@/lib/rental/phone";

export async function rememberPayer(
  tx: Prisma.TransactionClient,
  input: {
    organisationId: string;
    customerId: string;
    paymentId: string;
    email: string | null;
    phone: string | null;
    actor: Actor;
  }
): Promise<number> {
  const customer = await tx.customer.findUnique({ where: { id: input.customerId }, select: { email: true, phoneKey: true } });
  const email = input.email?.trim().toLowerCase() || null;
  const phone = input.phone ? normalisePhone(input.phone) : null;
  const rows = [
    ...(email && email !== customer?.email ? [{ kind: "email", value: email }] : []),
    ...(phone && phone !== customer?.phoneKey ? [{ kind: "phone", value: phone }] : []),
  ];
  if (rows.length === 0) return 0;
  const created = await tx.payerAlias.createMany({
    data: rows.map((row) => ({
      organisationId: input.organisationId,
      customerId: input.customerId,
      ...row,
      sourcePaymentId: input.paymentId,
      createdById: input.actor.id,
      createdByName: input.actor.displayName,
    })),
    skipDuplicates: true,
  });
  return created.count;
}

/** Forgets what the booking of this payment taught. */
export async function forgetPayerFrom(tx: Prisma.TransactionClient, paymentId: string): Promise<void> {
  await tx.payerAlias.deleteMany({ where: { sourcePaymentId: paymentId } });
}
