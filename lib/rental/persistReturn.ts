/**
 * Turns a signed return into records.
 *
 * The sibling of `persistPickup.ts`, and deliberately its mirror image: upload
 * first, one transaction second, mail afterwards in the route. The reasons are
 * written out there and are not repeated here.
 *
 * What differs is who is holding the phone. A pickup is submitted by the office
 * behind `APPLY_SECRET`; a return is submitted by the renter, from a public
 * form, with no credential anybody can be relied on to have. That single fact
 * decides the two rules below.
 *
 *   1. The rental is found from the car, never supplied by the caller. A car
 *      has at most one rental that is neither COMPLETED nor CANCELLED, because
 *      `persistPickup` refuses a second handover of a car already `rented`.
 *   2. **The car is not freed here.** The rental moves to RETURN_SUBMITTED and
 *      the car stays `rented` until the office confirms in /admin. Setting a
 *      car `available` from an unfenced form would let anyone who can read a
 *      numberplate put a car somebody is driving back into the picker — which
 *      is the state `app/api/admin/rentals/[id]/close/route.ts` exists to
 *      avoid, because the next customer can then sign a contract for it.
 *
 * See docs/superpowers/specs/2026-08-28-return-persistence-design.md.
 */

import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { assetKey, uploadAssets, type AssetStore } from "@/lib/storage";
import { normaliseEmail } from "./customers";
import { fuelLevelToDb } from "./fleet";
import type { ReturnDetails } from "./returnSchema";

/** "yes"/"no" as the radios carry it, into a column. Undefined stays
 *  undefined: an answer nobody gave is not a "no". */
function yesNo(value: string | undefined): boolean | undefined {
  if (value === "yes") return true;
  if (value === "no") return false;
  return undefined;
}

/** Francs from the form into the cents every money column stores. */
function toCents(chf: number | undefined): number | undefined {
  return chf === undefined ? undefined : Math.round(chf * 100);
}

/** An empty date string is "not given", not the epoch. */
function isoDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

/** Prisma's code for a unique-constraint violation. */
const UNIQUE_VIOLATION = "P2002";

/** The statuses from which a return may still be recorded. */
const OPEN_STATUSES = ["ACTIVE", "EXTENSION_REQUESTED"] as const;

/**
 * The statuses the rental lookup considers.
 *
 * Wider than `OPEN_STATUSES` by RETURN_SUBMITTED on purpose. A second
 * submission has to *find* the rental its first submission already moved,
 * otherwise the honest "you have already returned this" is reported as the
 * misleading "no rental is out on this car" — which reads like the return was
 * never recorded at all. The write stays guarded by `OPEN_STATUSES`.
 */
const FINDABLE_STATUSES = [...OPEN_STATUSES, "RETURN_SUBMITTED"] as const;

export interface ReturnUpload {
  /** SIGNATURE for the renter's, and for the optional counter-signature. */
  kind: "SIGNATURE";
  body: Uint8Array;
  contentType: string;
}

export interface PersistReturnInput {
  organisationId: string;
  details: ReturnDetails;
  /** `FleetVehicle.id`, which is `Car.slug`. */
  vehicleSlug: string;
  /** The number already printed on the PDF the renter is holding. */
  returnNumber: string;
  uploads: ReturnUpload[];
  pdf: { body: Uint8Array };
  store: AssetStore;
  now?: Date;
}

export type PersistReturnResult =
  /** Recorded. `contractNumber` may carry a discriminator — see below. */
  | {
      recorded: true;
      contractId: string;
      contractNumber: string;
      rentalId: string;
      /** Return mileage minus the pickup baseline. Null if unknowable. */
      distanceKm: number | null;
      /** True when the reading is below the pickup baseline, i.e. a typo. */
      mileageBelowPickup: boolean;
      /** Whether the submitted address matches the customer on file. */
      emailMatchesCustomer: boolean;
    }
  /**
   * Nothing was written, and that is not an error. The caller still emails the
   * document — see decision 3 in the spec.
   */
  | { recorded: false; reason: "no-open-rental" | "already-returned" };

/**
 * Records the return, or reports why it could not be.
 *
 * Throws only on storage or database failure. A missing rental is a return
 * value, not an exception: it is an ordinary outcome for a car that predates
 * Phase 2 or a rental somebody closed by hand, and the caller's response to it
 * is to carry on and send the mail.
 */
export async function persistReturn(
  input: PersistReturnInput
): Promise<PersistReturnResult> {
  const { organisationId, details, vehicleSlug, store } = input;
  const now = input.now ?? new Date();

  // --- Resolve before uploading ----------------------------------------
  // Cheap, and it is the check most likely to fail. Uploading six hundred
  // kilobytes of signature and PDF only to discover there is no rental to hang
  // them off would leave orphans for nothing.
  const car = await prisma.car.findUnique({
    where: { organisationId_slug: { organisationId, slug: vehicleSlug } },
    select: { id: true },
  });
  if (!car) return { recorded: false, reason: "no-open-rental" };

  const rental = await prisma.rental.findFirst({
    where: { carId: car.id, status: { in: [...FINDABLE_STATUSES] } },
    // Newest first. There should only ever be one, but ordering makes the
    // choice deterministic rather than whatever the planner returns first.
    orderBy: { startAt: "desc" },
    select: {
      id: true,
      customer: { select: { email: true } },
      contracts: {
        orderBy: { signedAt: "asc" },
        select: { id: true, kind: true, mileageKm: true },
      },
    },
  });
  if (!rental) return { recorded: false, reason: "no-open-rental" };

  if (rental.contracts.some((contract) => contract.kind === "RETURN_ADDENDUM")) {
    return { recorded: false, reason: "already-returned" };
  }

  const pickup = rental.contracts.find((contract) => contract.kind === "PICKUP");
  const pickupMileageKm = pickup?.mileageKm ?? null;
  const distanceKm =
    pickupMileageKm === null ? null : details.mileageKm - pickupMileageKm;
  const mileageBelowPickup = distanceKm !== null && distanceKm < 0;

  // Compared, never used to select the rental: a renter who typed their address
  // differently than they did at pickup is having a normal day, and refusing
  // their return over it would be the wrong trade. The office gets the flag.
  const emailMatchesCustomer =
    normaliseEmail(details.email) === normaliseEmail(rental.customer.email);

  // --- Upload, then one transaction ------------------------------------
  const submissionId = randomUUID();
  const stored = await uploadAssets(store, submissionId, input.uploads);

  const pdfKey = assetKey(submissionId, "RETURN_PDF", "pdf");
  await store.put(pdfKey, input.pdf.body, "application/pdf");

  const written = await writeReturn({
    organisationId,
    rentalId: rental.id,
    returnNumber: input.returnNumber,
    details,
    pdfKey,
    stored,
    now,
    event: {
      submissionId,
      pickupMileageKm,
      distanceKm,
      mileageBelowPickup,
      emailMatchesCustomer,
    },
  });

  return {
    recorded: true,
    contractId: written.contractId,
    contractNumber: written.contractNumber,
    rentalId: rental.id,
    distanceKm,
    mileageBelowPickup,
    emailMatchesCustomer,
  };
}

interface WriteReturnInput {
  organisationId: string;
  rentalId: string;
  returnNumber: string;
  details: ReturnDetails;
  pdfKey: string;
  stored: { kind: string; storageKey: string; contentType: string; bytes: number }[];
  now: Date;
  event: {
    submissionId: string;
    pickupMileageKm: number | null;
    distanceKm: number | null;
    mileageBelowPickup: boolean;
    emailMatchesCustomer: boolean;
  };
}

/**
 * The transaction, with one retry for a number collision.
 *
 * The return number comes off the PDF the renter is already holding, so it
 * cannot simply be reallocated — see decision 4. A collision is very unlikely
 * and losing the return to it would be much worse than a stored number that
 * carries a `-2` and an event explaining itself.
 */
async function writeReturn(
  input: WriteReturnInput
): Promise<{ contractId: string; contractNumber: string }> {
  try {
    return await writeOnce(input, input.returnNumber);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== UNIQUE_VIOLATION) throw error;

    const discriminated = `${input.returnNumber}-2`;
    console.warn(
      `[return] ${input.returnNumber} is already taken; stored as ${discriminated}. ` +
        "The renter's PDF carries the undiscriminated number."
    );
    return writeOnce(input, discriminated);
  }
}

async function writeOnce(
  input: WriteReturnInput,
  contractNumber: string
): Promise<{ contractId: string; contractNumber: string }> {
  const { organisationId, rentalId, details, now } = input;

  return prisma.$transaction(async (tx) => {
    const contract = await tx.contract.create({
      data: {
        organisationId,
        rentalId,
        contractNumber,
        // "office" everywhere until Phase 5, as every other row says. A return
        // is submitted by the renter, but the organisation is still the party
        // recording it.
        createdBy: "office",
        kind: "RETURN_ADDENDUM",
        mileageKm: details.mileageKm,
        fuelLevel: fuelLevelToDb(details.fuelLevel),
        damageNotes: details.damages,

        // The return protocol. Collected and validated since the form
        // existed, but until now it reached only the PDF — so the office
        // confirmed a return without being able to read what was in it.
        cleanliness: details.cleanliness,
        papersInside: yesNo(details.papersInside),
        keyReturned: yesNo(details.keyReturned),
        tickets: yesNo(details.tickets),
        ticketsNote: details.ticketsNote,
        fullyPaid: yesNo(details.fullyPaid),
        paymentMethods: details.paymentMethods,
        paidAmountCents: toCents(details.paidAmountChf),
        paidOn: isoDate(details.paidOn),
        // Recorded as a claim, not a debt. It becomes a Charge only when the
        // office confirms the return — nobody is chased over a number a
        // customer typed and nobody checked.
        hasDuePayment: yesNo(details.hasDuePayment),
        dueAmountCents: toCents(details.dueAmountChf),
        dueDate: isoDate(details.dueDate),
        dueMethod: details.dueMethod,
        depositBack: yesNo(details.depositBack),
        // The return document is not the GTC acceptance — that happened at
        // pickup and is recorded on that contract. These columns are not
        // nullable, so the addendum carries the return's own moment rather
        // than a copy of terms nobody agreed to twice.
        gtcVersion: "",
        gtcLanguage: "",
        acceptedAt: now,
        place: details.place,
        signedAt: now,
        pdfKey: input.pdfKey,
      },
      select: { id: true },
    });

    if (input.stored.length > 0) {
      await tx.asset.createMany({
        data: input.stored.map((asset) => ({
          ...asset,
          kind: "SIGNATURE" as const,
          contractId: contract.id,
        })),
      });
    }

    await tx.rentalEvent.create({
      data: {
        rentalId,
        type: "return.recorded",
        // Everything the form collects that the contract has no column for.
        // A JSON payload rather than eleven migrations for a form that will
        // change shape again.
        payload: {
          contractNumber,
          submissionId: input.event.submissionId,
          pickupMileageKm: input.event.pickupMileageKm,
          distanceKm: input.event.distanceKm,
          mileageBelowPickup: input.event.mileageBelowPickup,
          emailMatchesCustomer: input.event.emailMatchesCustomer,
          papersInside: details.papersInside,
          keyReturned: details.keyReturned,
          cleanliness: details.cleanliness,
          tickets: details.tickets,
          ticketsNote: details.ticketsNote,
          fullyPaid: details.fullyPaid,
          paymentMethods: details.paymentMethods,
          paidAmountChf: details.paidAmountChf ?? null,
          paidOn: details.paidOn,
          hasDuePayment: details.hasDuePayment,
          dueAmountChf: details.dueAmountChf ?? null,
          dueDate: details.dueDate,
          dueMethod: details.dueMethod ?? null,
          depositBack: details.depositBack,
          submittedBy: {
            firstName: details.firstName,
            lastName: details.lastName,
            email: details.email,
          },
        } as Prisma.InputJsonValue,
      },
    });

    // Conditional, with the precondition repeated in the WHERE — the Phase 3
    // pattern. Two submissions can both read an open rental; only one of them
    // can move it.
    await tx.rental.updateMany({
      where: { id: rentalId, status: { in: [...OPEN_STATUSES] } },
      data: { status: "RETURN_SUBMITTED" },
    });

    // The car is deliberately untouched. See the note at the top of this file.

    return { contractId: contract.id, contractNumber };
  });
}
