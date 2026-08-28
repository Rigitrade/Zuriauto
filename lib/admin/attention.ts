import type { Rental, UnsentContract } from "@/components/admin/types";

/**
 * What needs a person, derived from the overview payload.
 *
 * Pure on purpose. This is the load-bearing piece of the console: the band it
 * feeds is the first thing on the screen, and an empty band is read as "there
 * is nothing to do". A dashboard that says that while a car sits blocked is
 * worse than the one it replaced, which at least never claimed to be complete.
 * Being a plain function over plain data is what lets that promise be tested
 * without a database, a browser or a signed-in session.
 *
 * Three sources, in a fixed order of consequence:
 *
 *   1. return   a renter has handed the car back and nobody has confirmed it.
 *               The car stays `rented` until somebody does, so this is the
 *               only item that is actively costing the business a vehicle.
 *   2. ending   a rental runs out inside 24 hours, or already has.
 *   3. mail     a contract exists whose email never left.
 */

export interface AttentionSource {
  rentals: Rental[];
  /** Absent on a deployment older than the field. Treated as empty rather
   *  than as an error: losing one row beats the Overview throwing. */
  unsentContracts?: UnsentContract[];
}

export type AttentionKind = "return" | "ending" | "mail";

export interface AttentionItem {
  kind: AttentionKind;
  /** Stable across refetches, so React keeps the row rather than remounting
   *  it under somebody's cursor. */
  key: string;
  rentalId?: string;
  contractId?: string;
  contractNumber?: string;
  customerName: string;
  carPlate?: string;
  carModel?: string;
  /** The moment the row is about — returned at, or due at. */
  at?: string;
}

/** Rentals ending within this window are worth surfacing. */
export const ENDING_SOON_MS = 24 * 60 * 60 * 1000;

export function attentionItems(
  source: AttentionSource,
  now: Date = new Date()
): AttentionItem[] {
  const returns: AttentionItem[] = [];
  const endings: AttentionItem[] = [];

  for (const rental of source.rentals) {
    if (rental.returnSubmittedAt) {
      returns.push({
        kind: "return",
        key: `return:${rental.id}`,
        rentalId: rental.id,
        customerName: rental.customerName,
        carPlate: rental.carPlate,
        carModel: rental.carModel,
        at: rental.returnSubmittedAt,
      });
      // Deliberately not also counted as "ending". Both can be true of one
      // rental, and reporting it twice makes one job look like two — while
      // the return is the row that carries an action.
      continue;
    }

    const endsAt = Date.parse(rental.endAt);
    if (!Number.isFinite(endsAt)) continue;
    // No lower bound: a rental that ran out yesterday is more urgent than one
    // running out tonight, never less.
    if (endsAt - now.getTime() <= ENDING_SOON_MS) {
      endings.push({
        kind: "ending",
        key: `ending:${rental.id}`,
        rentalId: rental.id,
        customerName: rental.customerName,
        carPlate: rental.carPlate,
        carModel: rental.carModel,
        at: rental.endAt,
      });
    }
  }

  const mail: AttentionItem[] = (source.unsentContracts ?? []).map((contract) => ({
    kind: "mail",
    key: `mail:${contract.id}`,
    contractId: contract.id,
    contractNumber: contract.contractNumber,
    customerName: contract.customerName,
    at: contract.signedAt,
  }));

  return [...returns, ...endings, ...mail];
}
