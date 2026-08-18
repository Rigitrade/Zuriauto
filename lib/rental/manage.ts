/**
 * What a renter can do with a manage link.
 *
 * Two actions, both consuming the token that authorised them. Everything here
 * runs in one transaction per action, because each one changes several rows and
 * a half-applied extension — new end date, no charges — would be worse than a
 * failed one.
 */

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { PAYMENT_URL } from "@/lib/payment";
import { getPaymentProvider } from "@/lib/payments";
import { hashToken, tokenIsUsable } from "./actionToken";
import { generateWeeklyCharges } from "./passes";
import { deriveEndAt } from "./terms";

/**
 * The most weeks a renter may add without the office being involved.
 *
 * A guess, flagged as open question 3 in the design spec. Set low on purpose:
 * a renter quietly extending a car for a year is a conversation, not a form
 * submission.
 */
export const MAX_SELF_SERVICE_WEEKS = 4;

export type ManageResolution =
  | { ok: false; reason: "unusable" }
  | {
      ok: true;
      tokenId: string;
      rental: {
        id: string;
        organisationId: string;
        type: "WEEKLY" | "FIXED_TERM";
        status: string;
        startAt: Date;
        endAt: Date;
        totalWeeks: number | null;
        weeklyAmountCents: number | null;
        depositCents: number;
        customerFirstName: string;
        customerEmail: string;
        carModel: string;
        carPlate: string;
        language: string;
      };
    };

/**
 * Resolves a raw token to a rental, or refuses.
 *
 * One refusal reason for all three failures — unknown, expired, already used —
 * because the page shows the same message for each. A caller learns only that
 * the link does not work.
 */
export async function resolveManageToken(
  client: PrismaClient,
  rawToken: string,
  now: Date
): Promise<ManageResolution> {
  if (!rawToken) return { ok: false, reason: "unusable" };

  const row = await client.actionToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    include: {
      rental: {
        include: {
          customer: true,
          car: true,
          contracts: {
            where: { kind: "PICKUP" },
            orderBy: { signedAt: "asc" },
            take: 1,
            select: { gtcLanguage: true },
          },
        },
      },
    },
  });

  if (!row || row.purpose !== "MANAGE_RENTAL") {
    return { ok: false, reason: "unusable" };
  }
  if (!tokenIsUsable(row, now)) return { ok: false, reason: "unusable" };

  // A completed or cancelled rental has nothing left to manage. Same message:
  // the renter should be talking to the office, not to a form.
  if (row.rental.status !== "ACTIVE") return { ok: false, reason: "unusable" };

  return {
    ok: true,
    tokenId: row.id,
    rental: {
      id: row.rental.id,
      organisationId: row.rental.organisationId,
      type: row.rental.type,
      status: row.rental.status,
      startAt: row.rental.startAt,
      endAt: row.rental.endAt,
      totalWeeks: row.rental.totalWeeks,
      weeklyAmountCents: row.rental.weeklyAmountCents,
      depositCents: row.rental.depositCents,
      customerFirstName: row.rental.customer.firstName,
      customerEmail: row.rental.customer.email,
      carModel: row.rental.car.model,
      carPlate: row.rental.car.plate,
      language: row.rental.contracts[0]?.gtcLanguage ?? "de",
    },
  };
}

/**
 * Burns the token inside a transaction.
 *
 * The conditional update is the single-use guarantee: two requests carrying the
 * same link race here, and the second sees `count === 0`. Without the
 * `usedAt: null` in the WHERE, a forwarded link could be replayed.
 */
async function consumeToken(
  tx: Prisma.TransactionClient,
  tokenId: string,
  now: Date
): Promise<boolean> {
  const burned = await tx.actionToken.updateMany({
    where: { id: tokenId, usedAt: null },
    data: { usedAt: now },
  });
  return burned.count > 0;
}

export type ActionOutcome =
  | { ok: true }
  | { ok: false; reason: "token-consumed" | "not-extendable" | "too-many-weeks" };

/**
 * The renter says they are bringing the car back.
 *
 * Records intent and nothing more. Status stays ACTIVE — the car is not back
 * yet, and the overdue pass should still fire if it never arrives.
 * RETURN_SUBMITTED is reserved for Phase 4, when the return wizard is actually
 * submitted; overloading it here would leave the Phase 5 dashboard unable to
 * tell a promise from a handover.
 */
export async function recordReturnIntent(
  client: PrismaClient,
  tokenId: string,
  rentalId: string,
  now: Date
): Promise<ActionOutcome> {
  return client.$transaction(async (tx) => {
    if (!(await consumeToken(tx, tokenId, now))) {
      return { ok: false, reason: "token-consumed" } as const;
    }

    await tx.rentalEvent.create({
      data: { rentalId, type: "return.intended" },
    });

    return { ok: true } as const;
  });
}

export interface ExtensionQuote {
  weeks: number;
  amountCents: number;
  newEndAt: Date;
  firstNewWeek: number;
}

/**
 * What an extension would cost and when it would end.
 *
 * Pure, so the manage page can show the price before the renter commits and
 * the handler can recompute it rather than trusting a number from the browser.
 *
 * Extensions are priced at the rental's existing weekly rate — open question 2
 * in the design spec assumes the office does not re-quote.
 */
export function quoteExtension(
  rental: {
    startAt: Date;
    totalWeeks: number | null;
    weeklyAmountCents: number | null;
  },
  weeks: number
): ExtensionQuote | null {
  if (rental.totalWeeks == null || rental.weeklyAmountCents == null) return null;
  if (!Number.isInteger(weeks) || weeks < 1) return null;

  return {
    weeks,
    amountCents: rental.weeklyAmountCents * weeks,
    newEndAt: deriveEndAt(rental.startAt, rental.totalWeeks + weeks),
    firstNewWeek: rental.totalWeeks + 1,
  };
}

export interface ExtensionResult {
  quote: ExtensionQuote;
  paymentUrl: string;
}

/**
 * Extends a weekly rental.
 *
 * This is the job the Phase 2 spec assigned here: recomputing `endAt` belongs
 * to whatever changes `totalWeeks`, and that is this function. The new charges
 * continue the week sequence from the original start rather than from today, so
 * a renter who extends mid-week does not get a billing date that drifts.
 */
export async function extendRental(
  client: PrismaClient,
  input: {
    tokenId: string;
    rentalId: string;
    weeks: number;
    now: Date;
  }
): Promise<
  (ActionOutcome & { ok: false }) | ({ ok: true } & ExtensionResult)
> {
  const { tokenId, rentalId, weeks, now } = input;

  if (!Number.isInteger(weeks) || weeks < 1) {
    return { ok: false, reason: "not-extendable" };
  }
  if (weeks > MAX_SELF_SERVICE_WEEKS) {
    return { ok: false, reason: "too-many-weeks" };
  }

  const provider = getPaymentProvider();

  const outcome = await client.$transaction(async (tx) => {
    const rental = await tx.rental.findUnique({
      where: { id: rentalId },
      select: {
        id: true,
        organisationId: true,
        type: true,
        status: true,
        startAt: true,
        totalWeeks: true,
        weeklyAmountCents: true,
        currency: true,
      },
    });

    if (
      !rental ||
      rental.status !== "ACTIVE" ||
      rental.type !== "WEEKLY" ||
      rental.totalWeeks == null ||
      rental.weeklyAmountCents == null
    ) {
      // A fixed-term rental has no weekly rate to extend at, so extending one
      // is a conversation with the office rather than a form.
      return { ok: false, reason: "not-extendable" } as const;
    }

    if (!(await consumeToken(tx, tokenId, now))) {
      return { ok: false, reason: "token-consumed" } as const;
    }

    const quote = quoteExtension(rental, weeks)!;

    const newCharges = generateWeeklyCharges({
      startAt: rental.startAt,
      fromWeek: quote.firstNewWeek,
      weeks,
      amountCents: rental.weeklyAmountCents,
    });

    await tx.charge.createMany({
      data: newCharges.map((charge) => ({
        organisationId: rental.organisationId,
        rentalId: rental.id,
        weekNumber: charge.weekNumber,
        dueDate: charge.dueDate,
        amountCents: charge.amountCents,
        currency: rental.currency,
      })),
      // Belt and braces beside the unique constraint: a retried request must
      // not fail on charges the first attempt already wrote.
      skipDuplicates: true,
    });

    await tx.rental.update({
      where: { id: rental.id },
      data: {
        totalWeeks: rental.totalWeeks + weeks,
        endAt: quote.newEndAt,
      },
    });

    await tx.rentalEvent.create({
      data: {
        rentalId: rental.id,
        type: "rental.extended",
        payload: {
          weeks,
          amountCents: quote.amountCents,
          newEndAt: quote.newEndAt.toISOString(),
        } as Prisma.InputJsonValue,
      },
    });

    return { ok: true, quote } as const;
  });

  if (!outcome.ok) return outcome;

  // Outside the transaction: the provider is a network call, and holding a
  // database connection open across it is the mistake persistPickup avoids
  // too.
  //
  // Guarded, because by this point the extension is committed and the token
  // is spent. Letting a provider outage throw here would show the renter a
  // failure for something that succeeded — and their retry would hit a 410,
  // leaving them convinced they had not extended when they had.
  let paymentUrl = PAYMENT_URL;
  try {
    const request = await provider.createRequest({
      amountCents: outcome.quote.amountCents,
      currency: "chf",
      reference: `${rentalId.slice(-6)} EXT`,
      description: `Extension by ${weeks} week(s)`,
    });
    paymentUrl = request.url;
  } catch (error) {
    console.error(
      `[manage] payment request failed after extending ${rentalId}:`,
      error
    );
  }

  return { ok: true, quote: outcome.quote, paymentUrl };
}
