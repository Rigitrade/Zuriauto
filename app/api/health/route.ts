import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * What this deployment can actually see.
 *
 * Written while diagnosing a preview where `/api/fleet` answered 500 in 9ms
 * with no outgoing request — the signature of a missing `DATABASE_URL` rather
 * than a rejected password. Establishing that from the dashboard means reading
 * eighteen variables across two environments and trusting that the list on
 * screen is the list the function received. This asks the function.
 *
 * It reports **presence, never values**: a boolean per variable. That is
 * deliberate, and it is why the route needs no fence of its own. Nothing here
 * is a credential, and every secret it names fails closed when unset — an
 * absent APPLY_SECRET refuses every write, an absent CRON_SECRET refuses every
 * trigger — so knowing which are missing tells an attacker only that the doors
 * are locked. Fencing it would have been worse than useless: the case it exists
 * to diagnose is precisely the one where the secret guarding it is the thing
 * that has gone missing.
 *
 * Keep it after the phases it supports; a deploy where this endpoint is the
 * first thing checked is a deploy that ends sooner.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Every variable the application reads, grouped as the runbook lists them. */
const EXPECTED = {
  database: ["DATABASE_URL", "ORGANISATION_NAME"],
  fence: ["APPLY_SECRET", "RATE_LIMIT_SALT", "CRON_SECRET"],
  storage: [
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET",
    "R2_JURISDICTION",
  ],
  mail: [
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_USER",
    "SMTP_PASS",
    "MAIL_FROM",
    "MAIL_OFFICE",
    "MAIL_ARCHIVE",
  ],
  links: ["SITE_URL"],
} as const;

/**
 * Enough of a failure to act on, without repeating a connection string back.
 *
 * Prisma's own messages name the host but not the password; even so this keeps
 * only the code and a short prefix, because a diagnostic endpoint that echoes
 * configuration is the kind of convenience that outlives its usefulness.
 */
function describe(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : "";
  const message = error instanceof Error ? error.message : String(error);
  return `${code ? code + ": " : ""}${message.split("\n")[0].slice(0, 160)}`;
}

export async function GET() {
  const env: Record<string, Record<string, boolean>> = {};
  for (const [group, keys] of Object.entries(EXPECTED)) {
    env[group] = Object.fromEntries(
      keys.map((key) => [key, Boolean(process.env[key]?.trim())])
    );
  }

  // The variables can all be present and the database still unreachable, so
  // this probes rather than infers. `select 1` touches no table, so it works
  // before the migrations have run and says so distinctly from a bad password.
  let database: { reachable: boolean; cars?: number; error?: string };
  try {
    await prisma.$queryRaw`select 1`;
    database = { reachable: true, cars: await prisma.car.count() };
  } catch (error) {
    database = { reachable: false, error: describe(error) };
  }

  const missing = Object.values(env)
    .flatMap((group) => Object.entries(group))
    .filter(([, present]) => !present)
    .map(([key]) => key);

  return NextResponse.json({
    ok: database.reachable && missing.length === 0,
    region: process.env.VERCEL_REGION ?? null,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? null,
    /**
     * Which build is answering.
     *
     * Variables are baked in when a deployment is created, so "I added the
     * variable and it is still missing" has two very different causes: the
     * variable is on another project, or the request is being served by a
     * deployment built before it existed. The branch alias hides the
     * difference — it keeps serving the last good build. These fields are
     * Vercel's own, and they make the two cases distinguishable without
     * reading anything from the dashboard.
     */
    deployment: {
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
      message: process.env.VERCEL_GIT_COMMIT_MESSAGE?.split("\n")[0] ?? null,
      url: process.env.VERCEL_URL ?? null,
    },
    database,
    missing,
    env,
  });
}
