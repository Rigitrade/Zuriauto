/**
 * The renter, recognised at the desk.
 *
 * Phase 2 has deduplicated customers on email since the first contract, so a
 * repeat renter has always been one row with a history. Nothing read it back:
 * the identity existed and the path from a person at the desk to the record
 * describing them did not. This is that path.
 *
 * Returns no image bytes and no contract id to any client. The caller turns
 * `documentsOnFile.contractId` into a signed token before anything reaches a
 * browser — see reuseToken.ts for why a client is never trusted with the id.
 */

import type { AssetKind, PrismaClient } from "@/generated/prisma/client";

/** Enough for a couple sharing a mobile, few enough that the chooser is short. */
export const MAX_MATCHES = 5;

/**
 * What may be carried onto a new contract.
 *
 * Not SIGNATURE, which is signed today by definition, and not CONDITION_PHOTO,
 * which describes the car rather than the person.
 */
export const REUSABLE_KINDS: readonly AssetKind[] = [
  "PORTRAIT",
  "ID_FRONT",
  "ID_BACK",
  "LICENCE_FRONT",
  "LICENCE_BACK",
];

/** Five years, matching the retention period in docs/DATA-RETENTION.md. */
export const DOCUMENT_REUSE_MS = 5 * 365.25 * 24 * 60 * 60 * 1000;

export interface DocumentsOnFile {
  contractId: string;
  contractNumber: string;
  /** ISO date. */
  signedAt: string;
}

export interface CustomerMatch {
  firstName: string;
  lastName: string;
  /** ISO date, because this crosses JSON on its way to the form. */
  birthDate: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  rentalCount: number;
  /** ISO date of the first rental, for "returning since March 2026". */
  firstRentalAt: string | null;
  documentsOnFile: DocumentsOnFile | null;
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export async function findCustomersByPhone(
  client: PrismaClient,
  organisationId: string,
  phoneKey: string,
  now: Date = new Date()
): Promise<CustomerMatch[]> {
  const customers = await client.customer.findMany({
    where: { organisationId, phoneKey },
    // Served by @@index([organisationId, phoneKey]).
    orderBy: { createdAt: "asc" },
    take: MAX_MATCHES,
    select: {
      firstName: true,
      lastName: true,
      birthDate: true,
      street: true,
      postalCode: true,
      city: true,
      country: true,
      phone: true,
      email: true,
      rentals: {
        orderBy: { startAt: "asc" },
        select: {
          startAt: true,
          contracts: {
            where: { kind: "PICKUP" },
            orderBy: { signedAt: "desc" },
            take: 1,
            select: {
              id: true,
              contractNumber: true,
              signedAt: true,
              assets: { select: { kind: true } },
            },
          },
        },
      },
    },
  });

  const earliest = now.getTime() - DOCUMENT_REUSE_MS;

  return customers.map((customer) => {
    // One pickup contract per rental, so flattening and re-sorting gives the
    // customer's most recent across all of them.
    const contracts = customer.rentals
      .flatMap((rental) => rental.contracts)
      .sort((a, b) => b.signedAt.getTime() - a.signedAt.getTime());

    const latest = contracts[0];
    const kinds = new Set(latest?.assets.map((asset) => asset.kind) ?? []);
    const complete = REUSABLE_KINDS.every((kind) => kinds.has(kind));
    const fresh = latest ? latest.signedAt.getTime() >= earliest : false;

    return {
      firstName: customer.firstName,
      lastName: customer.lastName,
      birthDate: isoDate(customer.birthDate),
      street: customer.street,
      postalCode: customer.postalCode,
      city: customer.city,
      country: customer.country,
      phone: customer.phone,
      email: customer.email,
      rentalCount: customer.rentals.length,
      firstRentalAt: customer.rentals[0]
        ? isoDate(customer.rentals[0].startAt)
        : null,
      documentsOnFile:
        latest && complete && fresh
          ? {
              contractId: latest.id,
              contractNumber: latest.contractNumber,
              signedAt: isoDate(latest.signedAt),
            }
          : null,
    };
  });
}
