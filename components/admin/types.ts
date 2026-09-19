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
  /** The annual technical inspection as `YYYY-MM-DD`, or null when none is
   *  recorded. A day string, not an instant — see the endpoint's note on why a
   *  DATE column must not travel as an ISO timestamp. Optional so a client
   *  running against an older deployment degrades to "—" rather than throwing. */
  mfkDate?: string | null;

  /**
   * The service book, as `/api/admin/overview/` reports it.
   *
   * Every field optional *and* nullable, and the two mean different things.
   * Optional covers a client running against a deployment from before these
   * columns existed — the row degrades to "—" rather than throwing. Null is
   * the live answer "nobody has recorded this", which the screen must show as
   * a gap rather than as a zero: a zero is a reading, and the service warning
   * would act on it.
   */
  currentMileageKm?: number | null;
  mileageReadAt?: string | null;
  serviceDoneKm?: number | null;
  serviceDoneOn?: string | null;
  serviceDueKm?: number | null;

  /** The car's photograph, version-stamped. Absent when it has none. */
  photoUrl?: string | null;

  /** Planned repairs first, then the history, newest first. */
  repairs?: Repair[];

  activeRentalId: string | null;
}

/**
 * One repair, planned or carried out.
 *
 * `status` is a plain string rather than a union for the reason `Car.status`
 * is: this is a hand-written mirror of a JSON payload, and a union here would
 * make an unrecognised value a type error at the one place that should be
 * handling it gracefully.
 */
export interface Repair {
  id: string;
  status: string;
  details: string;
  plannedFor: string | null;
  doneOn: string | null;
  mileageKm: number | null;
  costCents: number | null;
  createdBy: string;
  createdAt: string;
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

/**
 * One stretch of a car's life, as `/api/admin/cars/[id]/history/` reports it.
 *
 * Unlike `Rental`, which describes something still running, a period is
 * historical by nature — a fine arrives weeks after the car came back. It
 * carries its own status because a CANCELLED period means the car never left
 * the yard, and a row that did not say so would put somebody else's fine on
 * the person who signed.
 */
export interface CarPeriod {
  id: string;
  status: string;
  startAt: string;
  endAt: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  contractNumber: string | null;
}

export interface CarHistory {
  car: { id: string; slug: string; model: string; plate: string; status: string };
  /** Null when the whole history was asked for. */
  window: { from: string; to: string } | null;
  periods: CarPeriod[];
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
    /** People waiting to be told a car is free. Optional so a client running
     *  against an older deployment degrades to "no one waiting" rather than
     *  rendering `undefined`. */
    waitingForCar?: number;
  };
  /** The contracts behind `counts.mailFailed`, newest first, capped at 20.
   *  Optional so a client running against an older deployment degrades by one
   *  row rather than throwing. */
  unsentContracts?: UnsentContract[];
  latestContractAt: string | null;
}

export type Labels = ReturnType<typeof labelsFor>;
