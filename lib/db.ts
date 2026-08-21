import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * One Prisma client per process.
 *
 * Next's dev server re-evaluates modules on every edit, so a plain
 * `new PrismaClient()` at module scope would open a fresh connection pool on
 * each hot reload until Postgres started refusing them. Caching on `globalThis`
 * is the documented way out, and is skipped in production, where the module is
 * evaluated once.
 *
 * Two things here are Prisma 7 rather than choices of ours: the client is
 * generated into `generated/` rather than into `node_modules`, hence the path
 * import; and it will not connect without an explicit driver adapter, hence
 * `PrismaPg`. Neither is optional.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    // Named plainly. A client built against an empty URL fails later, at the
    // first query, with an error that describes the symptom and not this.
    throw new Error("DATABASE_URL is not set.");
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    // Queries are noisy and the interesting failures are all warnings or
    // worse, so even development stops short of logging every statement.
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

/** Production keeps its single client here; development keeps it on
 * `globalThis` so a hot reload reuses the pool rather than opening another. */
let cached: PrismaClient | undefined;

function client(): PrismaClient {
  const existing = globalForPrisma.prisma ?? cached;
  if (existing) return existing;

  const created = createClient();
  if (process.env.NODE_ENV === "production") cached = created;
  else globalForPrisma.prisma = created;
  return created;
}

/**
 * The client, created on first use rather than on import.
 *
 * This has to be lazy. `next build` evaluates every route module to collect
 * its metadata, so a client constructed at module scope made `DATABASE_URL` a
 * *build* requirement: the build failed at "Collecting page data" for
 * `/api/cron/daily` with "DATABASE_URL is not set", long before any request
 * could arrive. A build should not need production credentials to produce an
 * artifact, and a deployment should not be able to fail for a reason that has
 * nothing to do with the code being deployed.
 *
 * The proxy defers construction to the first property access — the first
 * query, in practice — so the missing-variable error still surfaces, but as a
 * request failure the route already handles rather than a broken build.
 * Methods are bound to the real client so `prisma.$transaction(...)` and the
 * model delegates behave exactly as before.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const instance = client();
    const value = Reflect.get(instance, property, instance);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
