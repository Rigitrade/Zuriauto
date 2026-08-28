import type { labelsFor } from "@/lib/admin/labels";

/**
 * The shapes `/api/admin/overview/` returns, and the identity every section
 * reads.
 *
 * Pulled out of the old single-file dashboard so the shell and the sections
 * can agree on them without importing each other. Kept as a hand-written
 * mirror of the endpoint rather than derived from it: the endpoint's own
 * `OverviewPayload` is a server type, and importing it into a client bundle
 * drags Prisma's generated types along with it.
 */

export interface Car {
  id: string;
  slug: string;
  model: string;
  plate: string;
  vin: string | null;
  status: string;
  activeRentalId: string | null;
}

/**
 * The return protocol, as the renter filled it in.
 *
 * Every field nullable: an addendum written before these columns existed
 * carries a mileage and a signature and nothing else, and the review screen
 * must show gaps rather than confident falsehoods.
 */
export interface ReturnReport {
  mileageKm: number;
  distanceKm: number | null;
  fuelLevel: string;
  damageNotes: string;
  cleanliness: string | null;
  papersInside: boolean | null;
  keyReturned: boolean | null;
  tickets: boolean | null;
  ticketsNote: string;
  fullyPaid: boolean | null;
  paymentMethods: string[];
  paidAmountCents: number | null;
  paidOn: string | null;
  hasDuePayment: boolean | null;
  dueAmountCents: number | null;
  dueDate: string | null;
  dueMethod: string | null;
  depositBack: boolean | null;
}

export interface Rental {
  id: string;
  carPlate: string;
  carModel: string;
  customerName: string;
  startAt: string;
  endAt: string;
  contractNumber: string | null;
  returnSubmittedAt: string | null;
  returnContractNumber: string | null;
  returnReport?: ReturnReport | null;
}

export interface Account {
  id: string;
  username: string;
  displayName: string;
  role: "owner" | "staff";
  disabledAt: string | null;
  lastSignInAt: string | null;
}

export type Me = {
  id: string;
  username: string;
  displayName: string;
  role: "owner" | "staff";
};

export interface UnsentContract {
  id: string;
  contractNumber: string;
  customerName: string;
  signedAt: string;
}

export interface Overview {
  /** The same shape the sign-in response carries — one type for "who am I",
   *  populated from either. */
  me: Me;
  cars: Car[];
  rentals: Rental[];
  counts: {
    available: number;
    retired: number;
    rented: number;
    activeRentals: number;
    returnsAwaiting: number;
    contracts: number;
    mailFailed: number;
  };
  /** The contracts behind `counts.mailFailed`, newest first, capped at 20.
   *  Optional so a client running against an older deployment degrades by one
   *  row rather than throwing. */
  unsentContracts?: UnsentContract[];
  latestContractAt: string | null;
}

export type Labels = ReturnType<typeof labelsFor>;
