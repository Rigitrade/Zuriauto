import { NextResponse } from "next/server";
import type { PrismaClient } from "@/generated/prisma/client";

/**
 * The wall between companies (multi-company phase A, 15.11.2026).
 *
 * Every office route that takes an id asks one of these before it reads the
 * record or writes to it: is this record in the signed-in account's company?
 * A record of another company answers exactly like one that does not exist,
 * 404 `not-found`, so the answer never reveals that it is there.
 *
 * Counts by primary key plus the company column, so each is one indexed read.
 * Tables without their own column are checked through their parent: an image
 * through its contract, a payment proof through its fine.
 */

type Check = (client: PrismaClient, organisationId: string, id: string) => Promise<boolean>;

const has = (n: number) => n > 0;

export const inCompany: Record<
  | "car" | "rental" | "contract" | "charge" | "payment" | "fine" | "fineDocument"
  | "paymentMailIssue" | "adminUser" | "notification" | "asset" | "finePaymentProof",
  Check
> = {
  car: async (c, organisationId, id) => has(await c.car.count({ where: { id, organisationId } })),
  rental: async (c, organisationId, id) => has(await c.rental.count({ where: { id, organisationId } })),
  contract: async (c, organisationId, id) => has(await c.contract.count({ where: { id, organisationId } })),
  charge: async (c, organisationId, id) => has(await c.charge.count({ where: { id, organisationId } })),
  payment: async (c, organisationId, id) => has(await c.payment.count({ where: { id, organisationId } })),
  fine: async (c, organisationId, id) => has(await c.fine.count({ where: { id, organisationId } })),
  fineDocument: async (c, organisationId, id) =>
    has(await c.fineDocument.count({ where: { id, organisationId } })),
  paymentMailIssue: async (c, organisationId, id) =>
    has(await c.paymentMailIssue.count({ where: { id, organisationId } })),
  adminUser: async (c, organisationId, id) => has(await c.adminUser.count({ where: { id, organisationId } })),
  notification: async (c, organisationId, id) =>
    has(await c.notification.count({ where: { id, organisationId } })),
  asset: async (c, organisationId, id) =>
    has(await c.asset.count({ where: { id, contract: { organisationId } } })),
  finePaymentProof: async (c, organisationId, id) =>
    has(await c.finePaymentProof.count({ where: { id, fine: { organisationId } } })),
};

/** A repair belongs to the company and to the car named in its URL. */
export async function repairInCompany(
  client: PrismaClient,
  organisationId: string,
  carId: string,
  repairId: string
): Promise<boolean> {
  return has(await client.carRepair.count({ where: { id: repairId, carId, organisationId } }));
}

/** The one answer for a record outside the caller's company. */
export function notFound(): NextResponse {
  return NextResponse.json({ code: "not-found" }, { status: 404 });
}
