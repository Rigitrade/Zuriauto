/**
 * The office's order of the fleet.
 *
 * Asked for on 16.10.2026: drag the cars into the order the office thinks in,
 * and have the pickup form's car list follow it. Stored as `Car.sortOrder`;
 * the readers order by it with nulls last, then by slug, so a car added after
 * the ordering comes at the end until it is placed.
 */

import { z } from "zod";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";

/** Every car of the organisation, by id, in the new order. */
export const carOrderSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
});

export type CarOrderOutcome = { ok: true } | { ok: false; code: "order-mismatch" };

/**
 * The order, for `orderBy`: ordered cars first, then the rest by slug.
 * Shared so the vehicles screen and the pickup list cannot disagree.
 */
export const BY_OFFICE_ORDER: Prisma.CarOrderByWithRelationInput[] = [
  { sortOrder: { sort: "asc", nulls: "last" } },
  { slug: "asc" },
];

/**
 * Writes the order, or refuses it whole.
 *
 * The list must name every car of the organisation exactly once. Anything
 * else — a car added or deleted on another screen since this one was loaded,
 * a duplicate, an id from somewhere else — is refused rather than half
 * applied, because a partial order would put the cars it left out wherever
 * their old numbers happen to fall.
 */
export async function saveCarOrder(
  client: PrismaClient,
  organisationId: string,
  ids: string[]
): Promise<CarOrderOutcome> {
  return client.$transaction(async (tx) => {
    const cars = await tx.car.findMany({
      where: { organisationId },
      select: { id: true },
    });
    const known = new Set(cars.map((car) => car.id));
    const named = new Set(ids);
    if (
      named.size !== ids.length ||
      ids.length !== known.size ||
      ids.some((id) => !known.has(id))
    ) {
      return { ok: false, code: "order-mismatch" } as const;
    }
    for (const [index, id] of ids.entries()) {
      await tx.car.update({ where: { id }, data: { sortOrder: index } });
    }
    return { ok: true } as const;
  });
}
