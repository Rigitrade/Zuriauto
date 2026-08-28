/**
 * Brings the database up to what the code already knows.
 *
 * Ownership is split, and the split is the point. `lib/rental/fleet.ts` stays
 * the source of truth for a car's identity — model, plate, chassis number —
 * because those are legal identifiers printed on a signed document, and they
 * belong somewhere a mistyped update goes through code review. The database
 * owns status, so a car can be taken off the road without a deploy.
 *
 * Run on every deploy. Reconciles identity; never writes status.
 */

import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { fleet } from "../lib/rental/fleet";
import { hashPassword } from "../lib/admin/password";

export async function ensureOrganisation(
  client: PrismaClient
): Promise<{ id: string }> {
  const existing = await client.organisation.findFirst({ select: { id: true } });
  if (existing) return existing;

  return client.organisation.create({
    data: { name: process.env.ORGANISATION_NAME ?? "ZURIAUTO" },
    select: { id: true },
  });
}

export async function seedFleet(
  client: PrismaClient,
  organisationId: string
): Promise<void> {
  for (const vehicle of fleet) {
    const identity = {
      model: vehicle.model,
      plate: vehicle.plate,
      vin: vehicle.vin ?? null,
    };

    await client.car.upsert({
      where: { organisationId_slug: { organisationId, slug: vehicle.id } },
      // A placeholder — no valid plate yet — is created retired rather than
      // available, so it cannot reach the picker even before anyone edits it.
      create: {
        organisationId,
        slug: vehicle.id,
        ...identity,
        status: vehicle.placeholder ? "retired" : "available",
      },
      // No `status` here, deliberately. See the note at the top.
      update: identity,
    });
  }
}

/**
 * The first account, so a fresh deployment can be signed into.
 *
 * Keyed on "is there an owner at all", not on the username: this runs on every
 * deploy, and **it must never write a password that already exists.** Otherwise
 * every deploy silently resets the owner's password to whatever is in the
 * environment, and whoever changed it last week is locked out with no error
 * anywhere.
 *
 * Same rule as seedFleet, which reconciles identity and never touches status.
 *
 * A forgotten owner password is therefore not recoverable through the seed, by
 * design. `pnpm admin:password` is the way back in; deleting the row and
 * redeploying is the other.
 */
export async function seedOwner(
  client: PrismaClient,
  organisationId: string
): Promise<{ created: boolean }> {
  const username = process.env.ADMIN_OWNER_USERNAME?.trim().toLowerCase();
  const password = process.env.ADMIN_OWNER_PASSWORD;
  if (!username || !password) return { created: false };

  const existing = await client.adminUser.findFirst({
    where: { organisationId, role: "owner" },
    select: { id: true },
  });
  if (existing) return { created: false };

  await client.adminUser.create({
    data: {
      organisationId,
      username,
      displayName: process.env.ADMIN_OWNER_NAME?.trim() || username,
      role: "owner",
      passwordHash: await hashPassword(password),
    },
  });

  return { created: true };
}

async function main() {
  config({ path: ".env.local" });

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set.");

  const client = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    const org = await ensureOrganisation(client);
    await seedFleet(client, org.id);
    const owner = await seedOwner(client, org.id);
    console.log(
      `[seed] organisation ${org.id}, ${fleet.length} vehicles` +
        (owner.created ? ", owner created" : "")
    );
  } finally {
    await client.$disconnect();
  }
}

// Only when run as a script, so importing this from a test does not seed.
if (process.argv[1]?.endsWith("seed.ts")) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
