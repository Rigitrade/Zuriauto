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

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
