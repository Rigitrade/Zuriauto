/**
 * Applies pending migrations during the build, when there is a database to
 * apply them to.
 *
 * Why this runs in the build at all: `next build` does not migrate, and neither
 * did `vercel.json`, so every deploy needed a human to run `migrate deploy`
 * first from their own machine. That is a step nobody can see you skip. The
 * schema and the code that expects it now ship together.
 *
 * Why it is a script rather than `prisma migrate deploy &&` in the build
 * command: `lib/db.ts` went to some trouble to make the client lazy so that a
 * build does not need production credentials, after a build failed at
 * "Collecting page data" for a missing `DATABASE_URL`. A bare `migrate deploy`
 * would reverse that and make every build fail without a database — including
 * a CI typecheck that never intends to touch one. So a missing URL skips the
 * migration and the build continues; a URL that is present is migrated.
 *
 * `migrate deploy`, never `migrate dev`: dev can prompt to reset the database,
 * and against production that would be catastrophic. Deploy only applies what
 * is pending and never rolls anything back, so it is safe to run on every
 * build and safe to run concurrently — Prisma takes an advisory lock, so two
 * builds racing each other serialise rather than collide.
 */

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;

if (!url) {
  // Loud, because the alternative reading of this line is "migrations are up to
  // date", and it does not mean that.
  console.warn(
    "[build] DATABASE_URL is not set — skipping `prisma migrate deploy`.\n" +
      "[build] Expected for a local build or a CI typecheck, which have no\n" +
      "[build] database and do not need one. On a deployment it means the\n" +
      "[build] schema is now behind the code: check the environment."
  );
  process.exit(0);
}

// Host only. The connection string carries a password, and build logs are kept.
let where = "the configured database";
try {
  where = new URL(url).host;
} catch {
  // Not parseable as a URL. Say nothing rather than risk printing credentials.
}

console.log(`[build] applying pending migrations to ${where}`);

const result = spawnSync(
  process.execPath,
  [
    // Resolved through node rather than a bare `prisma` so this does not depend
    // on which package manager put what on PATH. `fileURLToPath`, not
    // `.pathname`: on Windows the latter yields "/D:/..." which resolves to
    // "D:\D:\..." and the build fails on a developer machine but not on CI.
    fileURLToPath(new URL("../node_modules/prisma/build/index.js", import.meta.url)),
    "migrate",
    "deploy",
  ],
  { stdio: "inherit", env: process.env }
);

if (result.status !== 0) {
  console.error(
    "[build] `prisma migrate deploy` failed — failing the build rather than\n" +
      "[build] shipping code against a schema that does not match it."
  );
  process.exit(result.status ?? 1);
}
