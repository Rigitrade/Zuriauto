/**
 * Turns a signed handover into records.
 *
 * Assets are uploaded before the transaction opens and mail is sent after it
 * commits, which puts the durable write in the middle where it belongs. A
 * storage failure aborts before anything is written; a mail failure leaves the
 * contract standing and is recorded on it. This inverts the Phase 1 failure
 * mode, where a mail failure meant the contract existed nowhere at all.
 */

import { randomUUID } from "node:crypto";
import type { AssetKind, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { assetKey, uploadAssets, type AssetStore } from "@/lib/storage";
import { allocateContractNumber } from "./contractNumber";
import { upsertCustomer } from "./customers";
import { fuelLevelToDb } from "./fleet";
import { generateWeeklyCharges } from "./passes";
import type { ContractDetails } from "./schema";
import { billingWeekdayOf, resolveEndAt } from "./terms";

export interface PickupUpload {
  kind: AssetKind;
  body: Uint8Array;
  contentType: string;
}

export interface PersistPickupInput {
  organisationId: string;
  details: ContractDetails;
  /** `FleetVehicle.id`, which is `Car.slug`. */
  vehicleSlug: string;
  uploads: PickupUpload[];
  pdf: { body: Uint8Array };
  store: AssetStore;
  now?: Date;
}

export interface PersistPickupResult {
  contractId: string;
  contractNumber: string;
  rentalId: string;
}

export async function persistPickup(
  input: PersistPickupInput
): Promise<PersistPickupResult> {
  const { organisationId, details, vehicleSlug, uploads, store } = input;
  const now = input.now ?? new Date();
  const terms = details.terms;

  const submissionId = randomUUID();

  // --- Upload first ----------------------------------------------------
  // Outside the transaction on purpose: an object-store call inside one would
  // hold a database connection open across the network for as long as six
  // photos take to upload. A failure here leaves orphaned objects under a
  // single prefix, which is sweepable; a failure the other way round would
  // leave a contract row pointing at images that do not exist.
  const stored = await uploadAssets(store, submissionId, uploads);

  const pdfKey = assetKey(submissionId, "CONTRACT_PDF", "pdf");
  await store.put(pdfKey, input.pdf.body, "application/pdf");

  // --- Then one transaction --------------------------------------------
  return prisma.$transaction(
    async (tx) => {
      const car = await tx.car.findUnique({
        where: { organisationId_slug: { organisationId, slug: vehicleSlug } },
        select: { id: true, status: true },
      });
      if (!car) throw new Error(`Unknown vehicle: ${vehicleSlug}`);
      if (car.status === "rented") {
        // Two handovers of one car is a real-world mistake for the office to
        // resolve, not something to reconcile silently.
        throw new Error(`Car ${vehicleSlug} is already rented`);
      }

      const customer = await upsertCustomer(tx, organisationId, details);
      const contractNumber = await allocateContractNumber(
        tx,
        organisationId,
        now
      );

      const startAt = new Date(terms.startAt);

      const rental = await tx.rental.create({
        data: {
          organisationId,
          carId: car.id,
          customerId: customer.id,
          // Every row says "office" until Phase 5 brings named accounts.
          // Written from day one because attribution cannot be recovered
          // afterwards, and these are the rows a fine or a dispute reaches
          // back into.
          createdBy: "office",
          type: terms.type,
          startAt,
          endAt: resolveEndAt(terms),
          depositCents: terms.depositCents,
          weeklyAmountCents:
            terms.type === "WEEKLY" ? terms.weeklyAmountCents : null,
          totalWeeks: terms.type === "WEEKLY" ? terms.totalWeeks : null,
          billingWeekday:
            terms.type === "WEEKLY" ? billingWeekdayOf(startAt) : null,
          totalAmountCents:
            terms.type === "FIXED_TERM" ? terms.totalAmountCents : null,
        },
        select: { id: true },
      });

      const contract = await tx.contract.create({
        data: {
          organisationId,
          rentalId: rental.id,
          contractNumber,
          createdBy: "office",
          kind: "PICKUP",
          mileageKm: details.mileageKm,
          fuelLevel: fuelLevelToDb(details.fuelLevel),
          damageNotes: details.existingDamage,
          gtcVersion: details.gtcVersion,
          gtcLanguage: details.gtcLanguage,
          acceptedAt: new Date(details.acceptedAt),
          place: details.place,
          signedAt: now,
          pdfKey,
        },
        select: { id: true },
      });

      await tx.asset.createMany({
        // `uploadAssets` deals in plain strings so the storage layer stays free
        // of the schema; the narrowing happens here, where the enum matters.
        // Safe because `uploads` arrived typed as AssetKind.
        data: stored.map((asset) => ({
          ...asset,
          kind: asset.kind as AssetKind,
          contractId: contract.id,
        })),
      });

      await tx.car.update({
        where: { id: car.id },
        data: { status: "rented" },
      });

      // The weekly schedule, generated up front rather than derived at run
      // time, so the Phase 3 charge pass walks rows instead of doing date
      // arithmetic. A fixed-term rental is paid once and has no schedule.
      if (terms.type === "WEEKLY") {
        const schedule = generateWeeklyCharges({
          startAt,
          fromWeek: 1,
          weeks: terms.totalWeeks,
          amountCents: terms.weeklyAmountCents,
        });
        await tx.charge.createMany({
          data: schedule.map((charge) => ({
            organisationId,
            rentalId: rental.id,
            weekNumber: charge.weekNumber,
            dueDate: charge.dueDate,
            amountCents: charge.amountCents,
            currency: "chf",
          })),
        });
      }

      await tx.rentalEvent.create({
        data: {
          rentalId: rental.id,
          type: "pickup.completed",
          payload: { contractNumber, submissionId } as Prisma.InputJsonValue,
        },
      });

      return { contractId: contract.id, contractNumber, rentalId: rental.id };
    },
    // The default 5 s is tight for eight statements on a cold Neon branch.
    { timeout: 15_000 }
  );
}
