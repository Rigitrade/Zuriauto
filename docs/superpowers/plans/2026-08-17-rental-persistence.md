# Rental Persistence Foundation (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the site a system of record — a Postgres database that the pickup wizard writes a `Customer`, `Rental`, `Contract` and `Asset` row into on every signed handover, so that Phase 3's reminder job and Phase 5's dashboard have something to read.

**Architecture:** Prisma over Postgres, in this repo, no second service. The browser keeps building the PDF and posting it to `app/api/rental-contract/route.ts`; the handler grows a shared-secret fence, uploads the images to Cloudflare R2 under opaque keys, commits one transaction, and only then sends mail — so a mail failure can never lose a contract. The fleet file stays the source of truth for a car's legal identity and seeds the `Car` table, which owns status. Vitest arrives with the first task.

**Tech Stack:** Next.js 15.5 (App Router, Node runtime), TypeScript, Prisma 7 + PostgreSQL 16, Zod 4, `@date-fns/tz`, `@aws-sdk/client-s3` against Cloudflare R2, Vitest 3, pnpm.

> **Task 1 is done.** What it actually took differed from what was planned in
> four ways, all recorded under "Prisma 7, not 6" below. Later tasks in this
> document still say `@prisma/client` and `prisma-client-js` in places; read
> them against that section.

**Spec:** `docs/superpowers/specs/2026-08-16-rental-persistence-design.md`
**Roadmap:** `docs/superpowers/specs/2026-08-16-rental-platform-roadmap.md`

---

## Global Constraints

- **Package manager is pnpm.** `pnpm-workspace.yaml` exists and `node_modules/.pnpm` is present. pnpm 11 blocks install scripts by default and exits non-zero until each is listed under `allowBuilds:` — every new dependency with a postinstall must be added there or `pnpm dev` fails before Next starts.
- **Node 22.13, Next 15.5.23, Zod 4.4.3.** Zod 4 syntax only: `z.email()`, not `z.string().email()`.
- **`trailingSlash: true`** in `next.config.ts`. Every `fetch` to an API route must use a trailing slash — without it Next 308-redirects and `fetch` re-uploads the whole multi-megabyte body.
- **The route handler runs on `runtime = "nodejs"`.** SMTP needs a socket and Prisma needs Node APIs. Never switch it to Edge.
- **Money is integer cents, currency string `"chf"` lowercase.** No floats anywhere near an amount.
- **Timezone for all rental date arithmetic is `Europe/Zurich`.** Vercel runs in UTC; naive millisecond addition shifts wall-clock time across a DST boundary. Always go through `@date-fns/tz`.
- **All customer-facing copy is added to both `de` and `en` tables in `lib/rental/labels.ts`.** The two objects must stay structurally identical — `en` is typed as `typeof de`, so a missing key is a compile error.
- **Postgres for local development is `docker compose up -d db`, on port 5433**, taken verbatim from `D:\Personal\zuriauto\docker-compose.yml`. Port 5433 not 5432, so it does not collide with a system Postgres.
- **The PDF's existing content must not change** except for the new terms block. The Phase 1 output is a signed legal document; a layout regression is a defect.
- **Every repeatable action is made idempotent by a unique constraint, never by a boolean flag.** (Roadmap decision 6.)
- **`MAIL_ARCHIVE` keeps running through this whole phase.** Do not remove the BCC archive. It is still the only proven durable record until the database has replaced it in production.

---

## Deviations from the spec, decided here

Three things the spec leaves open or does not name. Each is called out again in the task that introduces it.

1. **Object store is Cloudflare R2, not Vercel Blob.** The spec says "R2 or Vercel Blob". R2 lets you pin an EU jurisdiction explicitly at bucket creation (`--jurisdiction eu`), which the spec's "Done when" list requires and Vercel Blob does not guarantee as directly. R2 is S3-compatible, so the adapter is `@aws-sdk/client-s3` and swapping is one module.
2. **A `ContractCounter` model is added.** The spec says "allocate a contract number from the sequence" but lists no model for it. A per-day counter row, incremented with `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`, is what makes `ZA-YYYYMMDD-NNNN` both gapless within a day and safe under concurrency.
3. **`Rental.billingWeekday` is derived, not entered.** It is the Zurich weekday of `startAt`. Asking the office for it would be asking them to restate something they already told us.

Spec open question 2 — whether `Car.status` flips to `rented` — is resolved as **yes, it flips**, because the spec's own request flow (step 4) says so. Deriving availability from active rentals is deferred.

---

## Prisma 7, not 6 — what Task 1 actually needed

Written after the fact, because the plan assumed Prisma 6 and `pnpm add`
installed 7.9.1. Four differences, all of which later tasks inherit:

1. **The generator is `prisma-client`, not `prisma-client-js`, and `output` is
   required.** The client is generated into `generated/prisma/` in the repo,
   not into `node_modules`. So **every import is
   `from "@/generated/prisma/client"`, never `from "@prisma/client"`** — that
   includes `PrismaClient`, the `Prisma` namespace, the model types and the
   enums. `/generated/` is gitignored; `postinstall` and `build` regenerate it.
2. **`datasource db` has no `url`.** It moved to a new root `prisma.config.ts`,
   which also does not read `.env` files by itself — it calls
   `config({ path: ".env.local" })` explicitly. Consequence: `dotenv-cli` is
   not needed to wrap the migrate and seed scripts, and they are plain
   `prisma migrate dev` / `tsx prisma/seed.ts`.
3. **The client refuses to connect without a driver adapter.**
   `@prisma/adapter-pg` is a runtime dependency, and `lib/db.ts` constructs
   `new PrismaClient({ adapter: new PrismaPg({ connectionString }) })`.
4. **`fileParallelism` is a root-level Vitest option**, not a per-project one.
   It sits on the root `test` block and applies to both projects.

Two more things reality changed:

- **Vitest is pinned to 3.2.7.** Latest (4.1.10) pulls Vite 8.2.1, which
  depends on `lightningcss@^1.33.0` — a version that is not published, so the
  install fails outright. Revisit when that resolves.
- **Local Postgres is `zuriauto-site-db` on port 5434**, not `zuriauto-db` on
  5433. The old project at `D:\Personal\zuriauto` already owns that container
  name, that port and a volume holding its own v1 `Car`, `Customer` and
  `Rental` tables. Reusing any of the three meant either a name clash or these
  migrations landing on that project's data. Both can now run at once.

## Designed for the return wizard

Phase 4 adds a second form — the customer, not the office, reporting the car
back in. It is not built here, but Phase 2 decides how expensive it will be, so
these constraints hold throughout this plan.

**Already accommodated by the schema, deliberately.** `ContractKind` has
`RETURN_ADDENDUM`; `AssetKind` has `DAMAGE_PHOTO`; `RentalStatus` has
`RETURN_SUBMITTED`. `mileageKm`, `fuelLevel` and `damageNotes` sit on every
`Contract`, not on `Rental` — which is what makes the return a *comparison*
against the pickup's baseline rather than an overwrite of it. Nothing in this
plan may move those three fields up to `Rental`.

**The fence is different, and this is the one that bites.** `APPLY_SECRET`
(Task 12) is an office credential pasted into a WhatsApp link by staff. The
return form is opened by a renter from an email. Mailing customers the office's
shared secret would hand every past renter permanent write access to the system
of record. Phase 3 brings signed single-use `ActionToken`s for exactly this, and
the return form uses those.

So: `lib/applyKey.ts` stays narrowly named and narrowly scoped. Do not
generalise it to `lib/auth.ts`, do not add a `role` parameter, and do not reach
for it from any handler other than the pickup one.

**Keep reusable what is already reusable.** `CameraCapture`, `PhotoCapture`,
`SignaturePad` and `GtcAcceptance` are components Phase 4 mounts unchanged.
Task 5 adds a step beside them; it must not push pickup-specific assumptions
down into them.

**Two things Phase 4 will refactor, and that is fine.** `buildContractPdf`
requires five identity photographs, which a return addendum does not have; and
`RentalPickupWizard` owns its step navigation inline. Both are cheap to split
when there is a second caller and speculative to split now, when there is one.
Do not pre-emptively generalise either — but do not deepen them either.

## File structure

**New:**

| Path | Responsibility |
|---|---|
| `docker-compose.yml` | Local Postgres 16 on 5433 |
| `prisma/schema.prisma` | The whole data model |
| `prisma/seed.ts` | Organisation bootstrap + fleet reconciliation |
| `lib/db.ts` | Prisma client singleton, HMR-safe |
| `lib/rental/money.ts` | CHF string ↔ integer cents |
| `lib/rental/terms.ts` | Rental terms Zod union, `deriveEndAt`, `billingWeekdayOf` |
| `lib/rental/contractNumber.ts` | DB-backed `ZA-YYYYMMDD-NNNN` allocation |
| `lib/rental/customers.ts` | Upsert by lowercased email |
| `lib/rental/rateLimit.ts` | `SubmissionAttempt`-backed limiter |
| `lib/rental/mail.ts` | Contract mail sending, extracted from the route handler |
| `lib/rental/lookup.ts` | Radar-ticket query |
| `lib/storage/types.ts` | `AssetStore` interface |
| `lib/storage/r2.ts` | R2 implementation |
| `lib/storage/memory.ts` | In-memory implementation for tests |
| `lib/storage/index.ts` | `getAssetStore()` selector |
| `lib/applyKey.ts` | Shared-secret constant-time check |
| `app/api/fleet/route.ts` | Cars the picker may offer |
| `components/rental/RentalTermsStep.tsx` | The new wizard step |
| `vitest.config.ts`, `tests/db/setup.ts` | Test harness |

**Modified:** `lib/rental/fleet.ts` (fuel mapping), `lib/rental/schema.ts` (terms field, contract number comment), `lib/rental/labels.ts` (terms + result copy), `lib/rental/contractPdf.ts` (terms block), `components/rental/RentalPickupWizard.tsx` (step 2, DB fleet, key gate, new outcome), `app/api/rental-contract/route.ts` (the assembly), `app/privacy/page.tsx`, `.env.local.example`, `package.json`, `pnpm-workspace.yaml`, `.gitignore`.

---

## Task 1: Database, Prisma and the test harness

Nothing else can be built until `pnpm test` runs and a migration exists. Setup, schema and the first test all land together because none of them is independently reviewable.

**Files:**
- Create: `docker-compose.yml`, `prisma/schema.prisma`, `lib/db.ts`, `vitest.config.ts`, `tests/db/setup.ts`, `tests/db/connection.test.ts`, `.env.test`
- Modify: `package.json`, `pnpm-workspace.yaml`, `.gitignore`, `.env.local.example`

**Interfaces:**
- Produces: `prisma` (the singleton, default export of `lib/db.ts`); every model in the schema below; `resetDatabase()` from `tests/db/setup.ts`.

- [ ] **Step 1: Install dependencies**

```bash
pnpm add @prisma/client
pnpm add -D prisma vitest dotenv tsx
```

- [ ] **Step 2: Allow the install scripts pnpm 11 blocks**

Add to `pnpm-workspace.yaml` under the existing `allowBuilds:` key, keeping the comment style of the file:

```yaml
#   @prisma/client - generates the typed client into node_modules
#   @prisma/engines - downloads the query engine binary
#   prisma          - the CLI's own postinstall
#   esbuild         - the transformer behind vitest
allowBuilds:
  sharp: true
  unrs-resolver: true
  "@prisma/client": true
  "@prisma/engines": true
  prisma: true
  esbuild: true
```

Then run `pnpm install` and confirm it exits 0 with no "blocked build scripts" warning.

- [ ] **Step 3: Add the local database**

Create `docker-compose.yml` at the repo root — this is the file from `D:\Personal\zuriauto` verbatim, as the roadmap's infrastructure section specifies:

```yaml
services:
  db:
    image: postgres:16
    container_name: zuriauto-db
    environment:
      POSTGRES_USER: zuriauto
      POSTGRES_PASSWORD: zuriauto
      POSTGRES_DB: zuriauto
    ports:
      - '5433:5432'
    volumes:
      - zuriauto-pgdata:/var/lib/postgresql/data

volumes:
  zuriauto-pgdata:
```

Run: `docker compose up -d db`
Expected: container `zuriauto-db` running. Verify with `docker compose ps`.

- [ ] **Step 4: Write the schema**

Create `prisma/schema.prisma`. This is the spec's schema with `ContractCounter` added (see "Deviations" above).

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CarStatus    { available rented maintenance retired }
enum RentalType   { WEEKLY FIXED_TERM }
enum RentalStatus { ACTIVE EXTENSION_REQUESTED RETURN_SUBMITTED COMPLETED CANCELLED }
enum ContractKind { PICKUP RETURN_ADDENDUM }
enum FuelLevel    { empty quarter half three_quarter full }
enum AssetKind    { PORTRAIT ID_FRONT ID_BACK LICENCE_FRONT LICENCE_BACK
                    CONDITION_PHOTO SIGNATURE DAMAGE_PHOTO }

/// One row for the foreseeable future. Present so that a tenant key exists on
/// every table from the first migration rather than being retrofitted, which
/// would mean rewriting every query and every access check.
model Organisation {
  id        String     @id @default(cuid())
  name      String
  createdAt DateTime   @default(now())
  cars      Car[]
  customers Customer[]
  rentals   Rental[]
  contracts Contract[]
  counters  ContractCounter[]
}

model Car {
  id                 String       @id @default(cuid())
  organisationId     String
  /// Mirrors FleetVehicle.id in lib/rental/fleet.ts. The seed reconciles on it.
  slug               String
  model              String
  plate              String
  vin                String?
  status             CarStatus    @default(available)
  telematicsDeviceId String?
  organisation       Organisation @relation(fields: [organisationId], references: [id])
  rentals            Rental[]

  @@unique([organisationId, plate])
  @@unique([organisationId, slug])
}

model Customer {
  id             String       @id @default(cuid())
  organisationId String
  firstName      String
  lastName       String
  /// Always stored lowercased and trimmed. See lib/rental/customers.ts.
  email          String
  phone          String
  birthDate      DateTime     @db.Date
  street         String
  postalCode     String
  city           String
  country        String
  createdAt      DateTime     @default(now())
  organisation   Organisation @relation(fields: [organisationId], references: [id])
  rentals        Rental[]

  @@unique([organisationId, email])
}

model Rental {
  id                String       @id @default(cuid())
  organisationId    String
  carId             String
  customerId        String
  /// "office" until Phase 5 brings named accounts. Written from day one
  /// because attribution cannot be recovered for rows already recorded.
  createdBy         String
  type              RentalType
  status            RentalStatus @default(ACTIVE)
  startAt           DateTime
  /// Written, never computed on read, so the Phase 3 reminder pass is a plain
  /// indexed range scan. Derived for WEEKLY, explicit for FIXED_TERM.
  endAt             DateTime
  currency          String       @default("chf")
  depositCents      Int          @default(0)
  weeklyAmountCents Int?
  totalWeeks        Int?
  billingWeekday    Int?
  totalAmountCents  Int?
  createdAt         DateTime     @default(now())

  organisation Organisation  @relation(fields: [organisationId], references: [id])
  car          Car           @relation(fields: [carId], references: [id])
  customer     Customer      @relation(fields: [customerId], references: [id])
  contracts    Contract[]
  events       RentalEvent[]

  @@index([organisationId, status, endAt])
  @@index([carId, startAt, endAt])
}

model Contract {
  id             String       @id @default(cuid())
  organisationId String
  rentalId       String
  contractNumber String
  createdBy      String
  kind           ContractKind
  mileageKm      Int
  fuelLevel      FuelLevel
  damageNotes    String       @default("")
  gtcVersion     String
  gtcLanguage    String
  acceptedAt     DateTime
  place          String       @default("")
  signedAt       DateTime     @default(now())
  pdfKey         String?
  mailSentAt     DateTime?
  mailError      String?
  organisation   Organisation @relation(fields: [organisationId], references: [id])
  rental         Rental       @relation(fields: [rentalId], references: [id])
  assets         Asset[]

  @@unique([organisationId, contractNumber])
}

model Asset {
  id          String   @id @default(cuid())
  contractId  String
  kind        AssetKind
  storageKey  String   @unique
  contentType String
  bytes       Int
  createdAt   DateTime @default(now())
  contract    Contract @relation(fields: [contractId], references: [id])

  @@index([contractId])
}

model RentalEvent {
  id        String   @id @default(cuid())
  rentalId  String
  type      String
  payload   Json?
  createdAt DateTime @default(now())
  rental    Rental   @relation(fields: [rentalId], references: [id])

  @@index([rentalId, createdAt])
}

/// IP addresses are hashed, never stored, so the rate limiter is not itself a
/// personal-data store.
model SubmissionAttempt {
  id        String   @id @default(cuid())
  ipHash    String
  createdAt DateTime @default(now())

  @@index([ipHash, createdAt])
}

/// Not in the design spec: the sequence behind ZA-YYYYMMDD-NNNN. One row per
/// organisation per day, incremented atomically inside the contract
/// transaction so two simultaneous handovers cannot collide.
model ContractCounter {
  organisationId String
  day            String       // "YYYYMMDD" in Europe/Zurich
  value          Int          @default(0)
  organisation   Organisation @relation(fields: [organisationId], references: [id])

  @@id([organisationId, day])
}
```

- [ ] **Step 5: Point the environment at it**

Create `.env.test` (gitignored via the existing `.env*` rule — confirm `.gitignore` covers it, and if it has an `!.env.local.example` negation, leave that alone):

```
DATABASE_URL="postgresql://zuriauto:zuriauto@localhost:5433/zuriauto?schema=public"
ORGANISATION_NAME="ZURIAUTO"
APPLY_SECRET="test-secret"
RATE_LIMIT_SALT="test-salt"
```

Add the same `DATABASE_URL` line to `.env.local`, and document all four keys in `.env.local.example` under a new heading:

```
# --- Database ---------------------------------------------------------
# Local development runs `docker compose up -d db` — Postgres 16 on 5433.
# Production is Neon, EU region. Storing ID scans is a materially different
# obligation from Phase 1, where nothing was kept server-side: the region is
# not a preference.
DATABASE_URL=

# Name of the single Organisation row the seed creates.
ORGANISATION_NAME=ZURIAUTO

# --- Write fence ------------------------------------------------------
# /apply is no longer only a spam-relay target — it writes to the system of
# record. Without this secret in the link, anyone could create a rental
# against a real plate and poison the traffic-fine lookup.
# Generate with: node -e "console.log(crypto.randomUUID())"
APPLY_SECRET=

# Salt for hashing client IPs in the rate limiter, so raw addresses are never
# stored. Any long random string; changing it resets the limiter.
RATE_LIMIT_SALT=
```

- [ ] **Step 6: Add the scripts**

In `package.json`:

```json
{
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "prisma generate && next build --turbopack",
    "start": "next start",
    "lint": "eslint",
    "check-mail": "node --env-file=.env.local scripts/check-mail.mjs",
    "postinstall": "prisma generate",
    "db:up": "docker compose up -d db",
    "db:migrate": "dotenv -e .env.local -- prisma migrate dev",
    "db:seed": "dotenv -e .env.local -- tsx prisma/seed.ts",
    "test": "vitest run --project unit",
    "test:db": "vitest run --project db",
    "test:all": "vitest run"
  }
}
```

`dotenv` here is the `dotenv-cli` binary — install it: `pnpm add -D dotenv-cli`.

- [ ] **Step 7: Create the client singleton**

Create `lib/db.ts`:

```ts
import { PrismaClient } from "@prisma/client";

/**
 * One client per process.
 *
 * Next's dev server re-evaluates modules on every edit, so a plain `new
 * PrismaClient()` would open a new connection pool per hot reload until
 * Postgres refuses them. The global cache is the documented way out and is
 * skipped in production, where the module is evaluated once.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

- [ ] **Step 8: Configure Vitest**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

/**
 * Two projects, because the two kinds of test have different prerequisites.
 *
 * `unit` runs anywhere with no services. `db` needs `docker compose up -d db`
 * and is not parallelised: the suites share one database and truncate between
 * files, so running them concurrently would have them delete each other's rows.
 */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["lib/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        test: {
          name: "db",
          include: ["tests/db/**/*.test.ts"],
          environment: "node",
          // Order matters. `env.ts` must finish before `setup.ts` is
          // evaluated, because `setup.ts` imports the Prisma client and
          // `new PrismaClient()` reads DATABASE_URL at construction — an
          // import hoisted above a `config()` call in the same file would
          // build the client against an empty environment.
          setupFiles: ["./tests/db/env.ts", "./tests/db/setup.ts"],
          fileParallelism: false,
          testTimeout: 20_000,
        },
      },
    ],
  },
});
```

Create `tests/db/env.ts` — nothing but the environment, and no imports that
touch the database:

```ts
import { config } from "dotenv";

config({ path: ".env.test" });
```

Create `tests/db/setup.ts`:

```ts
import { beforeEach } from "vitest";
import { prisma } from "@/lib/db";

/**
 * Truncate rather than drop and re-migrate: the schema is stable within a run
 * and re-migrating per file would dominate the suite's runtime.
 *
 * Order matters — children before parents — and `RESTART IDENTITY CASCADE`
 * takes the foreign keys with it.
 */
export async function resetDatabase(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "Asset", "RentalEvent", "Contract", "Rental",
      "Customer", "Car", "ContractCounter", "SubmissionAttempt", "Organisation"
    RESTART IDENTITY CASCADE
  `);
}

beforeEach(resetDatabase);
```

`@/` resolves through `tsconfig.json` paths; Vitest reads them via `vite-tsconfig-paths`. Install it and add the plugin:

```bash
pnpm add -D vite-tsconfig-paths
```

At the top of `vitest.config.ts`:

```ts
import tsconfigPaths from "vite-tsconfig-paths";
```

and inside `defineConfig({ ... })`, alongside `test`:

```ts
  plugins: [tsconfigPaths()],
```

- [ ] **Step 9: Write the failing test**

Create `tests/db/connection.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";

describe("database", () => {
  it("starts each test with an empty organisation table", async () => {
    expect(await prisma.organisation.count()).toBe(0);
  });

  it("accepts an organisation", async () => {
    const org = await prisma.organisation.create({ data: { name: "ZURIAUTO" } });
    expect(org.id).toMatch(/^c[a-z0-9]+$/);
    expect(await prisma.organisation.count()).toBe(1);
  });
});
```

- [ ] **Step 10: Run it to watch it fail**

Run: `pnpm test:db`
Expected: FAIL — the tables do not exist yet (`relation "Organisation" does not exist`).

- [ ] **Step 11: Create the migration**

Run: `pnpm db:migrate --name init`
Expected: `prisma/migrations/<timestamp>_init/migration.sql` is written and applied.

Then apply it to the test database too — it is the same database here, so nothing more is needed. If you later split them, run `dotenv -e .env.test -- prisma migrate deploy`.

- [ ] **Step 12: Run the test to verify it passes**

Run: `pnpm test:db`
Expected: PASS, 2 tests.

Also run `pnpm test` and expect it to pass with 0 test files — the unit project has no tests yet, so pass `--passWithNoTests` if Vitest exits non-zero.

- [ ] **Step 13: Commit**

```bash
git add docker-compose.yml prisma vitest.config.ts tests package.json pnpm-lock.yaml pnpm-workspace.yaml lib/db.ts .env.local.example .gitignore
# Confirm .env.test is NOT staged — it holds a secret, and `.env*` should
# already exclude it. If `git status` shows it, stop and fix .gitignore.
git commit -m "feat(db): add Postgres, Prisma schema and the Vitest harness"
```

---

## Task 2: Fuel level ↔ database enum

**Files:**
- Modify: `lib/rental/fleet.ts`
- Test: `lib/rental/fleet.test.ts` (create)

**Interfaces:**
- Consumes: `FUEL_LEVELS`, `FuelLevel` from `lib/rental/fleet.ts`.
- Produces: `fuelLevelToDb(level: FuelLevel): DbFuelLevel` and `dbToFuelLevel(value: DbFuelLevel): FuelLevel`, where `DbFuelLevel = "empty" | "quarter" | "half" | "three_quarter" | "full"`.

- [ ] **Step 1: Write the failing test**

Create `lib/rental/fleet.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  FUEL_LEVELS,
  dbToFuelLevel,
  fuelLevelToDb,
  fuelLevelToFraction,
} from "./fleet";

describe("fuel level storage mapping", () => {
  it("maps every displayed level to a database value", () => {
    expect(FUEL_LEVELS.map(fuelLevelToDb)).toEqual([
      "empty",
      "quarter",
      "half",
      "three_quarter",
      "full",
    ]);
  });

  it("round-trips every level without loss", () => {
    for (const level of FUEL_LEVELS) {
      expect(dbToFuelLevel(fuelLevelToDb(level))).toBe(level);
    }
  });

  it("leaves the printed fraction untouched", () => {
    // The contract keeps printing fractions; only storage differs.
    expect(fuelLevelToFraction("empty")).toBe("0/4");
    expect(fuelLevelToFraction("3/4")).toBe("3/4");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test`
Expected: FAIL — `fuelLevelToDb is not a function`.

- [ ] **Step 3: Implement**

Append to `lib/rental/fleet.ts`, directly under `fuelLevelToFraction`:

```ts
/**
 * How a level is stored.
 *
 * A Prisma enum cannot contain a slash, so the database spells out what the
 * dashboard prints as a fraction. This is a rename, not a redefinition — the
 * mapping lives here beside `fuelLevelToFraction` so the two representations
 * cannot drift apart in separate files.
 */
export type DbFuelLevel =
  | "empty"
  | "quarter"
  | "half"
  | "three_quarter"
  | "full";

const TO_DB: Record<FuelLevel, DbFuelLevel> = {
  empty: "empty",
  "1/4": "quarter",
  "1/2": "half",
  "3/4": "three_quarter",
  full: "full",
};

const FROM_DB: Record<DbFuelLevel, FuelLevel> = {
  empty: "empty",
  quarter: "1/4",
  half: "1/2",
  three_quarter: "3/4",
  full: "full",
};

export function fuelLevelToDb(level: FuelLevel): DbFuelLevel {
  return TO_DB[level];
}

export function dbToFuelLevel(value: DbFuelLevel): FuelLevel {
  return FROM_DB[value];
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/rental/fleet.ts lib/rental/fleet.test.ts
git commit -m "feat(rental): map fuel levels to their stored spelling"
```

---

## Task 3: CHF amounts as integer cents

The wizard takes `"1'250.50"` from a Swiss keyboard and the database takes `125050`. Nothing between them may see a float.

**Files:**
- Create: `lib/rental/money.ts`, `lib/rental/money.test.ts`

**Interfaces:**
- Produces: `parseChf(input: string): number | null` (cents, `null` when unparseable) and `formatChf(cents: number): string` (e.g. `"1'250.50"`).

- [ ] **Step 1: Write the failing test**

Create `lib/rental/money.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatChf, parseChf } from "./money";

describe("parseChf", () => {
  it("reads a plain amount", () => {
    expect(parseChf("250")).toBe(25_000);
    expect(parseChf("250.50")).toBe(25_050);
  });

  it("accepts Swiss thousands apostrophes and stray spaces", () => {
    expect(parseChf("1'250.50")).toBe(125_050);
    expect(parseChf(" 1 250,50 ")).toBe(125_050);
  });

  it("accepts a comma as the decimal separator", () => {
    expect(parseChf("99,90")).toBe(9_990);
  });

  it("pads a single decimal digit rather than truncating it", () => {
    // "10.5" is ten francs fifty, not ten francs five rappen.
    expect(parseChf("10.5")).toBe(1_050);
  });

  it("rejects more than two decimals, which cannot be a rappen amount", () => {
    expect(parseChf("10.505")).toBeNull();
  });

  it("rejects text, negatives and empty input", () => {
    expect(parseChf("")).toBeNull();
    expect(parseChf("abc")).toBeNull();
    expect(parseChf("-5")).toBeNull();
  });

  it("accepts zero, because a deposit may be waived", () => {
    expect(parseChf("0")).toBe(0);
  });
});

describe("formatChf", () => {
  it("always shows two decimals", () => {
    expect(formatChf(25_000)).toBe("250.00");
    expect(formatChf(9_990)).toBe("99.90");
  });

  it("groups thousands with an apostrophe, as Switzerland writes them", () => {
    expect(formatChf(125_050)).toBe("1'250.50");
    expect(formatChf(1_000_000_00)).toBe("1'000'000.00");
  });

  it("round-trips through parseChf", () => {
    for (const cents of [0, 5, 999, 125_050, 1_000_000_00]) {
      expect(parseChf(formatChf(cents))).toBe(cents);
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test`
Expected: FAIL — cannot resolve `./money`.

- [ ] **Step 3: Implement**

Create `lib/rental/money.ts`:

```ts
/**
 * CHF amounts as integer cents.
 *
 * Money never exists as a float in this codebase. A rental of 250.10 a week
 * over 52 weeks accumulates a visible error in binary floating point, and the
 * amount printed on a signed contract has to be the amount charged.
 */

/**
 * Reads what someone typed into a francs field.
 *
 * Tolerant about separators because a Swiss keyboard, a phone keypad and a
 * copy-paste from a spreadsheet all produce different ones; strict about the
 * number of decimals, because three of them means the input was not an amount.
 *
 * Returns null rather than throwing: the caller is a form, and a form wants a
 * validation message, not an exception.
 */
export function parseChf(input: string): number | null {
  const cleaned = input.replace(/[\s'’]/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;

  const [whole, fraction = ""] = cleaned.split(".");
  const rappen = fraction.padEnd(2, "0");
  const cents = Number(whole) * 100 + Number(rappen);

  return Number.isSafeInteger(cents) ? cents : null;
}

/** How an amount is written on screen and on the contract. */
export function formatChf(cents: number): string {
  const whole = Math.trunc(cents / 100);
  const rappen = String(Math.abs(cents % 100)).padStart(2, "0");
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  return `${grouped}.${rappen}`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test`
Expected: PASS, all money tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/rental/money.ts lib/rental/money.test.ts
git commit -m "feat(rental): parse and format CHF as integer cents"
```

---

## Task 4: Rental terms schema and `endAt` derivation

The spec's central pure-logic piece: two rental shapes as a discriminated union, and a weekly rental's end date that survives a DST change.

**Files:**
- Create: `lib/rental/terms.ts`, `lib/rental/terms.test.ts`
- Modify: `lib/rental/schema.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `ZURICH = "Europe/Zurich"`
  - `rentalTermsSchema` (Zod) and `type RentalTerms = z.infer<typeof rentalTermsSchema>`
  - `deriveEndAt(startAt: Date, totalWeeks: number): Date`
  - `billingWeekdayOf(startAt: Date): number` — 0 = Sunday, matching `Date.getDay()`
  - `resolveEndAt(terms: RentalTerms): Date` — the one function callers use, dispatching on `terms.type`
  - `contractDetailsSchema` gains a `terms` field.

- [ ] **Step 1: Install the timezone helper**

```bash
pnpm add @date-fns/tz
```

`date-fns` is already a dependency. `@date-fns/tz` is its official companion and supplies `TZDate`, a `Date` subclass whose getters read in a named zone.

- [ ] **Step 2: Write the failing test**

Create `lib/rental/terms.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  billingWeekdayOf,
  deriveEndAt,
  rentalTermsSchema,
  resolveEndAt,
} from "./terms";

describe("deriveEndAt", () => {
  it("adds whole weeks", () => {
    const start = new Date("2026-03-02T10:00:00.000Z");
    expect(deriveEndAt(start, 2).toISOString()).toBe("2026-03-16T10:00:00.000Z");
  });

  it("crosses a month boundary", () => {
    const start = new Date("2026-01-28T09:30:00.000Z");
    expect(deriveEndAt(start, 1).toISOString()).toBe("2026-02-04T09:30:00.000Z");
  });

  it("crosses a year boundary", () => {
    const start = new Date("2026-12-24T14:00:00.000Z");
    expect(deriveEndAt(start, 2).toISOString()).toBe("2027-01-07T14:00:00.000Z");
  });

  it("keeps the Zurich wall-clock time across the spring DST change", () => {
    // Zurich moves to CEST on 29 March 2026. A car handed over at 10:00 local
    // on the 22nd is due back at 10:00 local on 5 April — which is 08:00 UTC,
    // not the 09:00 UTC that naive millisecond addition would produce.
    const start = new Date("2026-03-22T09:00:00.000Z"); // 10:00 CET
    expect(deriveEndAt(start, 2).toISOString()).toBe("2026-04-05T08:00:00.000Z");
  });

  it("keeps the Zurich wall-clock time across the autumn DST change", () => {
    // Zurich returns to CET on 25 October 2026.
    const start = new Date("2026-10-18T08:00:00.000Z"); // 10:00 CEST
    expect(deriveEndAt(start, 2).toISOString()).toBe("2026-11-01T09:00:00.000Z");
  });
});

describe("billingWeekdayOf", () => {
  it("reads the weekday in Zurich, not in UTC", () => {
    // 23:30 UTC on a Sunday is already Monday in Zurich.
    const lateSunday = new Date("2026-03-01T23:30:00.000Z");
    expect(billingWeekdayOf(lateSunday)).toBe(1);
  });
});

describe("rentalTermsSchema", () => {
  const weekly = {
    type: "WEEKLY",
    startAt: "2026-03-02T10:00:00.000Z",
    totalWeeks: 4,
    weeklyAmountCents: 45_000,
    depositCents: 50_000,
  };

  const fixed = {
    type: "FIXED_TERM",
    startAt: "2026-03-02T10:00:00.000Z",
    endAt: "2026-03-09T10:00:00.000Z",
    totalAmountCents: 60_000,
    depositCents: 0,
  };

  it("accepts a weekly rental", () => {
    expect(rentalTermsSchema.safeParse(weekly).success).toBe(true);
  });

  it("accepts a fixed-term rental", () => {
    expect(rentalTermsSchema.safeParse(fixed).success).toBe(true);
  });

  it("rejects a fixed-term rental carrying a weekly amount", () => {
    // The whole point of the union: an impossible combination cannot validate.
    const impossible = { ...fixed, weeklyAmountCents: 45_000 };
    expect(rentalTermsSchema.safeParse(impossible).success).toBe(false);
  });

  it("rejects a weekly rental with no duration", () => {
    const { totalWeeks: _omitted, ...rest } = weekly;
    expect(rentalTermsSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects a fixed-term rental that ends before it starts", () => {
    const backwards = { ...fixed, endAt: "2026-03-01T10:00:00.000Z" };
    expect(rentalTermsSchema.safeParse(backwards).success).toBe(false);
  });

  it("rejects zero weeks", () => {
    expect(rentalTermsSchema.safeParse({ ...weekly, totalWeeks: 0 }).success).toBe(
      false
    );
  });

  it("defaults the deposit to zero", () => {
    const { depositCents: _omitted, ...rest } = weekly;
    const parsed = rentalTermsSchema.parse(rest);
    expect(parsed.depositCents).toBe(0);
  });

  it("resolves endAt for both shapes", () => {
    expect(resolveEndAt(rentalTermsSchema.parse(weekly)).toISOString()).toBe(
      "2026-03-30T10:00:00.000Z"
    );
    expect(resolveEndAt(rentalTermsSchema.parse(fixed)).toISOString()).toBe(
      "2026-03-09T10:00:00.000Z"
    );
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm test`
Expected: FAIL — cannot resolve `./terms`.

- [ ] **Step 4: Implement**

Create `lib/rental/terms.ts`:

```ts
/**
 * The commercial terms of a rental.
 *
 * Two shapes on one table, as the roadmap sets out: WEEKLY reproduces what the
 * Uber and taxi drivers already have — N weeks at a fixed weekly amount —
 * while FIXED_TERM serves tourists with an explicit end and a single price.
 * Both carry `endAt`, so the Phase 3 reminder is one query rather than two
 * code paths that can drift.
 */

import { TZDate } from "@date-fns/tz";
import { addWeeks } from "date-fns";
import { z } from "zod";

/**
 * Every rental date is reasoned about in Zurich.
 *
 * Vercel's functions run in UTC. A rental handed over at 10:00 and extended by
 * two weeks over the March changeover must still be due back at 10:00, and
 * millisecond arithmetic would make it 11:00.
 */
export const ZURICH = "Europe/Zurich";

const isoDateTime = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), "startAt");

/** One franc short of a million, in cents. Anything above is a typo. */
const MAX_AMOUNT_CENTS = 100_000_000;

const money = z.number().int().min(0).max(MAX_AMOUNT_CENTS);

export const rentalTermsSchema = z
  .discriminatedUnion("type", [
    z.object({
      type: z.literal("WEEKLY"),
      startAt: isoDateTime,
      // Two years is the ceiling. Longer than that is a lease, not a rental.
      totalWeeks: z.number().int().min(1, "totalWeeks").max(104, "totalWeeks"),
      weeklyAmountCents: money,
      depositCents: money.default(0),
    }),
    z.object({
      type: z.literal("FIXED_TERM"),
      startAt: isoDateTime,
      endAt: isoDateTime,
      totalAmountCents: money,
      depositCents: money.default(0),
    }),
  ])
  .refine(
    (terms) =>
      terms.type !== "FIXED_TERM" ||
      Date.parse(terms.endAt) > Date.parse(terms.startAt),
    { message: "endBeforeStart", path: ["endAt"] }
  );

export type RentalTerms = z.infer<typeof rentalTermsSchema>;

/**
 * `startAt` plus whole weeks, in Zurich wall-clock terms.
 *
 * `TZDate` makes date-fns do its arithmetic in the named zone, so adding two
 * weeks across a DST boundary moves the calendar date and leaves the time of
 * day alone — which is what "two more weeks" means to the person holding the
 * keys.
 */
export function deriveEndAt(startAt: Date, totalWeeks: number): Date {
  const zoned = new TZDate(startAt.getTime(), ZURICH);
  return new Date(addWeeks(zoned, totalWeeks).getTime());
}

/** The weekday billing falls on, 0 = Sunday, read in Zurich. */
export function billingWeekdayOf(startAt: Date): number {
  return new TZDate(startAt.getTime(), ZURICH).getDay();
}

/** The single accessor callers use, so neither shape leaks into their code. */
export function resolveEndAt(terms: RentalTerms): Date {
  const startAt = new Date(terms.startAt);
  return terms.type === "WEEKLY"
    ? deriveEndAt(startAt, terms.totalWeeks)
    : new Date(terms.endAt);
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm test`
Expected: PASS.

If the two DST tests fail, the cause is almost always `new TZDate(date)` instead of `new TZDate(date.getTime(), ZURICH)` — the single-argument form drops the zone.

- [ ] **Step 6: Wire terms into the contract schema**

In `lib/rental/schema.ts`, add the import at the top:

```ts
import { rentalTermsSchema } from "./terms";
```

and add the field to `contractDetailsSchema`, directly after `existingDamage`:

```ts
  /**
   * The commercial terms, entered at handover.
   *
   * Nested rather than flattened so the discriminated union survives: a
   * fixed-term rental carrying a weekly amount has to be unrepresentable, and
   * flattening the two shapes into sibling optional fields would make it
   * merely discouraged.
   */
  terms: rentalTermsSchema,
```

- [ ] **Step 7: Update the contract number comment**

Still in `lib/rental/schema.ts`, replace the last paragraph of the `buildContractNumber` doc comment — the sentence beginning "Nothing is stored in Phase 1" — with:

```ts
/**
 * Builds the reference printed on the contract when the database is not
 * reachable.
 *
 * From Phase 2 the number normally comes from `allocateContractNumber` in
 * `lib/rental/contractNumber.ts`, backed by a real sequence. This remains as
 * the offline fallback the wizard uses when the write path is unavailable and
 * the office falls back to downloading the PDF and mailing it by hand — the
 * random suffix makes a collision with a sequenced number vanishingly
 * unlikely, and its shape marks it as unsequenced at a glance.
 */
```

- [ ] **Step 8: Verify the types still compile**

Run: `pnpm exec tsc --noEmit`
Expected: errors *only* in `components/rental/RentalPickupWizard.tsx`, where `contractDetailsSchema.safeParse` is now missing `terms`. That is expected and closes in Task 5. Note the error count so you can confirm it drops to zero later.

- [ ] **Step 9: Commit**

```bash
git add lib/rental/terms.ts lib/rental/terms.test.ts lib/rental/schema.ts package.json pnpm-lock.yaml
git commit -m "feat(rental): add rental terms with DST-safe end-date derivation"
```

---

## Task 5: The wizard's rental-terms step

Inserted between vehicle selection and the customer's details, so the office enters terms while the car is still the subject. This renumbers steps 2–4 to 3–5, which touches a dozen sites — every one is listed.

**Files:**
- Create: `components/rental/RentalTermsStep.tsx`
- Modify: `components/rental/RentalPickupWizard.tsx`, `lib/rental/labels.ts`

**Interfaces:**
- Consumes: `parseChf`, `formatChf` (Task 3); `rentalTermsSchema`, `RentalTerms` (Task 4).
- Produces: `RentalTermsStep` (default export) with props
  `{ value: TermsFormState; onChange: (next: TermsFormState) => void; errors: Record<string, string>; L: ReturnType<typeof labelsFor> }`,
  and `export interface TermsFormState { type: "WEEKLY" | "FIXED_TERM"; startDate: string; startTime: string; totalWeeks: string; endDate: string; endTime: string; amount: string; deposit: string; }` — all strings, because a half-typed number is not a number.
- Produces: `export function toRentalTerms(state: TermsFormState): unknown` — assembles the object handed to `rentalTermsSchema`.

- [ ] **Step 1: Add the copy**

In `lib/rental/labels.ts`, add `terms` to the `steps` object in **both** `de` and `en`, between `vehicle` and `details`:

```ts
// de
  steps: {
    vehicle: "Fahrzeug",
    terms: "Mietdauer",
    details: "Ihre Daten",
    documents: "Dokumente",
    sign: "Unterschrift",
  },
```

```ts
// en
  steps: {
    vehicle: "Vehicle",
    terms: "Rental period",
    details: "Your details",
    documents: "Documents",
    sign: "Signature",
  },
```

(Read the existing `en.steps` block and keep its wording for the four keys it already has; only `terms` is new.)

Add a new `terms` block to `de`, after the `vehicle` block:

```ts
  terms: {
    heading: "Mietdauer und Preis",
    type: "Mietart",
    typeWeekly: "Wochenmiete",
    typeWeeklyHint: "Laufende Miete, wöchentlich abgerechnet.",
    typeFixed: "Feste Dauer",
    typeFixedHint: "Fester Zeitraum, einmalig bezahlt.",
    start: "Beginn",
    startDate: "Datum",
    startTime: "Uhrzeit",
    totalWeeks: "Anzahl Wochen",
    end: "Ende",
    endDate: "Datum",
    endTime: "Uhrzeit",
    weeklyAmount: "Wochenpreis (CHF)",
    totalAmount: "Gesamtpreis (CHF)",
    deposit: "Kaution (CHF)",
    depositHint: "0 eingeben, wenn keine Kaution erhoben wird.",
    computedEnd: "Rückgabe berechnet auf",
  },
```

and to `en`:

```ts
  terms: {
    heading: "Rental period and price",
    type: "Rental type",
    typeWeekly: "Weekly",
    typeWeeklyHint: "Ongoing rental, billed each week.",
    typeFixed: "Fixed term",
    typeFixedHint: "A set period, paid once.",
    start: "Start",
    startDate: "Date",
    startTime: "Time",
    totalWeeks: "Number of weeks",
    end: "End",
    endDate: "Date",
    endTime: "Time",
    weeklyAmount: "Weekly price (CHF)",
    totalAmount: "Total price (CHF)",
    deposit: "Deposit (CHF)",
    depositHint: "Enter 0 if no deposit is taken.",
    computedEnd: "Return calculated for",
  },
```

Add to the `errors` block of `de`:

```ts
    amount: "Bitte geben Sie einen gültigen Betrag ein.",
    deposit: "Bitte geben Sie eine gültige Kaution ein, oder 0.",
    totalWeeks: "Bitte geben Sie die Anzahl Wochen an (1 bis 104).",
    startAt: "Bitte geben Sie einen gültigen Beginn an.",
    endAt: "Bitte geben Sie ein gültiges Ende an.",
    endBeforeStart: "Das Ende muss nach dem Beginn liegen.",
```

and to `en`:

```ts
    amount: "Please enter a valid amount.",
    deposit: "Please enter a valid deposit, or 0.",
    totalWeeks: "Please give the number of weeks (1 to 104).",
    startAt: "Please give a valid start.",
    endAt: "Please give a valid end.",
    endBeforeStart: "The end must be after the start.",
```

- [ ] **Step 2: Build the step component**

Create `components/rental/RentalTermsStep.tsx`:

```tsx
"use client";

import { useMemo } from "react";
import { formatChf, parseChf } from "@/lib/rental/money";
import { deriveEndAt } from "@/lib/rental/terms";
import type { labelsFor } from "@/lib/rental/labels";

/**
 * The commercial terms, entered by whoever runs the handover.
 *
 * Held entirely as strings. A francs field mid-typing is "12." and a week
 * count mid-typing is "" — neither is a number, and forcing them through
 * `Number()` on every keystroke is what makes a form fight the person filling
 * it in. Conversion happens once, in `toRentalTerms`, at submit.
 */

export interface TermsFormState {
  type: "WEEKLY" | "FIXED_TERM";
  startDate: string; // yyyy-mm-dd, from <input type="date">
  startTime: string; // HH:MM, from <input type="time">
  totalWeeks: string;
  endDate: string;
  endTime: string;
  amount: string;
  deposit: string;
}

/** Combines the two native inputs into something `Date.parse` understands. */
function toIso(date: string, time: string): string {
  if (!date) return "";
  const parsed = new Date(`${date}T${time || "00:00"}`);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

/** Shapes the form state for `rentalTermsSchema`. Validation stays there. */
export function toRentalTerms(state: TermsFormState): unknown {
  const startAt = toIso(state.startDate, state.startTime);
  const depositCents = parseChf(state.deposit) ?? -1;

  if (state.type === "WEEKLY") {
    return {
      type: "WEEKLY",
      startAt,
      totalWeeks: Number(state.totalWeeks),
      weeklyAmountCents: parseChf(state.amount) ?? -1,
      depositCents,
    };
  }

  return {
    type: "FIXED_TERM",
    startAt,
    endAt: toIso(state.endDate, state.endTime),
    totalAmountCents: parseChf(state.amount) ?? -1,
    depositCents,
  };
}

interface Props {
  value: TermsFormState;
  onChange: (next: TermsFormState) => void;
  errors: Record<string, string>;
  L: ReturnType<typeof labelsFor>;
}

export default function RentalTermsStep({ value, onChange, errors, L }: Props) {
  const set = <K extends keyof TermsFormState>(
    key: K,
    next: TermsFormState[K]
  ) => onChange({ ...value, [key]: next });

  /**
   * Shown live so the office sees the return date before anyone signs, rather
   * than discovering it on the contract. Uses the same `deriveEndAt` the
   * server will, so the two cannot disagree.
   */
  const computedEnd = useMemo(() => {
    if (value.type !== "WEEKLY") return null;
    const weeks = Number(value.totalWeeks);
    const iso = toIso(value.startDate, value.startTime);
    if (!iso || !Number.isInteger(weeks) || weeks < 1) return null;
    return deriveEndAt(new Date(iso), weeks);
  }, [value.type, value.totalWeeks, value.startDate, value.startTime]);

  return (
    <section className="space-y-6">
      <h2 className="text-xl font-semibold">{L.terms.heading}</h2>

      <fieldset className="space-y-2">
        <legend className="text-sm text-muted-foreground">{L.terms.type}</legend>
        {(
          [
            ["WEEKLY", L.terms.typeWeekly, L.terms.typeWeeklyHint],
            ["FIXED_TERM", L.terms.typeFixed, L.terms.typeFixedHint],
          ] as const
        ).map(([type, label, hint]) => (
          <label
            key={type}
            className="flex cursor-pointer items-start gap-3 rounded-lg border p-3"
          >
            <input
              type="radio"
              name="rentalType"
              className="mt-1"
              checked={value.type === type}
              onChange={() => set("type", type)}
            />
            <span>
              <span className="block font-medium">{label}</span>
              <span className="block text-sm text-muted-foreground">{hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1">
          <span className="text-sm">{`${L.terms.start} – ${L.terms.startDate}`}</span>
          <input
            type="date"
            className="w-full rounded-md border px-3 py-2"
            value={value.startDate}
            onChange={(event) => set("startDate", event.target.value)}
          />
        </label>
        <label className="space-y-1">
          <span className="text-sm">{`${L.terms.start} – ${L.terms.startTime}`}</span>
          <input
            type="time"
            className="w-full rounded-md border px-3 py-2"
            value={value.startTime}
            onChange={(event) => set("startTime", event.target.value)}
          />
        </label>
      </div>
      {errors.startAt && (
        <p className="text-sm text-destructive">{errors.startAt}</p>
      )}

      {value.type === "WEEKLY" ? (
        <label className="block space-y-1">
          <span className="text-sm">{L.terms.totalWeeks}</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={104}
            className="w-full rounded-md border px-3 py-2"
            value={value.totalWeeks}
            onChange={(event) => set("totalWeeks", event.target.value)}
          />
          {errors.totalWeeks && (
            <span className="block text-sm text-destructive">
              {errors.totalWeeks}
            </span>
          )}
          {computedEnd && (
            <span className="block text-sm text-muted-foreground">
              {`${L.terms.computedEnd}: ${computedEnd.toLocaleString("de-CH", {
                dateStyle: "short",
                timeStyle: "short",
                timeZone: "Europe/Zurich",
              })}`}
            </span>
          )}
        </label>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-sm">{`${L.terms.end} – ${L.terms.endDate}`}</span>
              <input
                type="date"
                className="w-full rounded-md border px-3 py-2"
                value={value.endDate}
                onChange={(event) => set("endDate", event.target.value)}
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm">{`${L.terms.end} – ${L.terms.endTime}`}</span>
              <input
                type="time"
                className="w-full rounded-md border px-3 py-2"
                value={value.endTime}
                onChange={(event) => set("endTime", event.target.value)}
              />
            </label>
          </div>
          {errors.endAt && (
            <p className="text-sm text-destructive">{errors.endAt}</p>
          )}
        </>
      )}

      <label className="block space-y-1">
        <span className="text-sm">
          {value.type === "WEEKLY" ? L.terms.weeklyAmount : L.terms.totalAmount}
        </span>
        <input
          type="text"
          inputMode="decimal"
          className="w-full rounded-md border px-3 py-2"
          value={value.amount}
          onChange={(event) => set("amount", event.target.value)}
          onBlur={(event) => {
            // Normalise on leaving the field, never while typing.
            const cents = parseChf(event.target.value);
            if (cents !== null) set("amount", formatChf(cents));
          }}
        />
        {errors.amount && (
          <span className="block text-sm text-destructive">{errors.amount}</span>
        )}
      </label>

      <label className="block space-y-1">
        <span className="text-sm">{L.terms.deposit}</span>
        <input
          type="text"
          inputMode="decimal"
          className="w-full rounded-md border px-3 py-2"
          value={value.deposit}
          onChange={(event) => set("deposit", event.target.value)}
          onBlur={(event) => {
            const cents = parseChf(event.target.value);
            if (cents !== null) set("deposit", formatChf(cents));
          }}
        />
        <span className="block text-sm text-muted-foreground">
          {L.terms.depositHint}
        </span>
        {errors.deposit && (
          <span className="block text-sm text-destructive">
            {errors.deposit}
          </span>
        )}
      </label>
    </section>
  );
}
```

Before writing this, read one existing step in `RentalPickupWizard.tsx` (the vehicle block, lines 654–782) and match its class names and `Field` helper usage. The markup above is the structure; the styling must follow whatever the file already does rather than introducing a second visual language.

- [ ] **Step 3: Renumber the wizard's steps**

In `components/rental/RentalPickupWizard.tsx`, make these edits. Every site is listed; do not stop early.

1. Line 64: `const TOTAL_STEPS = 4;` → `const TOTAL_STEPS = 5;`
2. Import the new step and its helpers at the top:
   ```ts
   import RentalTermsStep, {
     toRentalTerms,
     type TermsFormState,
   } from "./RentalTermsStep";
   ```
3. Add state beside the other `useState` calls (after `form`, around line 170):
   ```ts
   const [terms, setTerms] = useState<TermsFormState>(EMPTY_TERMS);
   ```
4. Add the initial value next to `EMPTY_FORM` (around line 142):
   ```ts
   /**
    * Start is left blank rather than defaulted to now, because the page is
    * statically prerendered — a value computed at module scope would differ
    * between server and browser and hydration would complain. It is filled in
    * on mount, in the same effect that sets `now`.
    */
   const EMPTY_TERMS: TermsFormState = {
     type: "WEEKLY",
     startDate: "",
     startTime: "",
     totalWeeks: "",
     endDate: "",
     endTime: "",
     amount: "",
     deposit: "0.00",
   };
   ```
5. In the existing `useEffect` that sets `now` (lines 198–202), default the start to the current moment once the browser is running:
   ```ts
   useEffect(() => {
     const at = new Date();
     setNow(at);
     setTerms((current) =>
       current.startDate
         ? current
         : {
             ...current,
             startDate: `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`,
             startTime: `${pad(at.getHours())}:${pad(at.getMinutes())}`,
           }
     );
     const timer = setInterval(() => setNow(new Date()), 30_000);
     return () => clearInterval(timer);
   }, []);
   ```
6. In `validateStep` (line 283): change `if (target === 2)` → `if (target === 3)` (both occurrences, lines 293 and 321), `if (target === 3)` → `if (target === 4)` (line 325), `if (target === 4)` → `if (target === 5)` (line 331). **Edit from the bottom up** — renaming 3→4 before 2→3 would otherwise renumber the same block twice.
7. Insert the new step's validation into `validateStep`, after the `target === 1` block:
   ```ts
   if (target === 2) {
     const parsed = rentalTermsSchema.safeParse(toRentalTerms(terms));
     if (!parsed.success) {
       for (const issue of parsed.error.issues) {
         const key = String(issue.path[0] ?? "form");
         const message = issue.message as keyof typeof L.errors;
         // Both amount fields share one input, so both map to `amount`.
         const field =
           key === "weeklyAmountCents" || key === "totalAmountCents"
             ? "amount"
             : key === "depositCents"
               ? "deposit"
               : key;
         found[field] = L.errors[message] ?? L.errors[field as keyof typeof L.errors] ?? L.errors.required;
       }
     }
   }
   ```
8. In `submit` (line 383): `!validateStep(4)` → `!validateStep(5)`.
9. In `submit`'s `safeParse` call (line 387), add the terms to the object being parsed, after `existingDamage`:
   ```ts
     terms: toRentalTerms(terms),
   ```
10. In `submit`'s error branch (lines 419–424), extend `ownerOfField` so a terms error sends the user to step 2 rather than to the details step:
    ```ts
    const ownerOfField: Record<string, number> = {
      vehicleId: 1,
      mileageKm: 1,
      fuelLevel: 1,
      terms: 2,
      amount: 2,
      deposit: 2,
      totalWeeks: 2,
      startAt: 2,
      endAt: 2,
    };
    setStep(ownerOfField[Object.keys(found)[0]] ?? 3);
    ```
    Note the fallback changes from `2` to `3` — the details step moved.
11. Render the new step. After the `{step === 1 && ( ... )}` block ends (just before line 783's `{step === 2 && (`), insert:
    ```tsx
    {step === 2 && (
      <RentalTermsStep
        value={terms}
        onChange={setTerms}
        errors={errors}
        L={L}
      />
    )}
    ```
    Then renumber the existing render guards, again bottom-up: line 1003 `step === 4` → `step === 5`, line 958 `step === 3` → `step === 4`, line 783 `step === 2` → `step === 3`.
12. Confirm `StepIndicator` (line 651) reads `TOTAL_STEPS` rather than a literal `4`. It does — no change — but check that whatever labels it renders come from `L.steps`, and add the `terms` entry to its list if the labels are enumerated there.

- [ ] **Step 4: Verify the type errors from Task 3 are gone**

Run: `pnpm exec tsc --noEmit`
Expected: PASS with zero errors.

- [ ] **Step 5: Verify by hand**

Run: `pnpm dev`, open `http://localhost:3000/apply/`.

Check, in order:
- The indicator shows five steps and step 2 is "Mietdauer" / "Rental period".
- Weekly is preselected; entering 4 weeks shows a calculated return date.
- Switching to "Feste Dauer" swaps the week count for an end date and the label from "Wochenpreis" to "Gesamtpreis".
- Typing `1250.5` in the amount field and tabbing away rewrites it as `1'250.50`.
- Pressing Next with an empty amount shows the error and does not advance.
- Completing all five steps still produces the PDF (mail may fail; that is fine).

- [ ] **Step 6: Commit**

```bash
git add components/rental/RentalTermsStep.tsx components/rental/RentalPickupWizard.tsx lib/rental/labels.ts
git commit -m "feat(rental): capture rental terms in the pickup wizard"
```

---

## Task 6: The terms block on the contract PDF

**Files:**
- Modify: `lib/rental/contractPdf.ts`, `lib/rental/labels.ts`

**Interfaces:**
- Consumes: `ContractDetails.terms` (Task 4), `formatChf` (Task 3), `resolveEndAt` (Task 4).
- Produces: nothing new — `buildContractPdf`'s signature is unchanged, because the terms arrive inside `details`.

- [ ] **Step 1: Add the PDF labels**

In `lib/rental/labels.ts`, add to the `pdf` block of `de`, after `fuel`:

```ts
    termsSection: "Mietdauer und Preis",
    rentalType: "Mietart",
    rentalTypeWeekly: "Wochenmiete",
    rentalTypeFixed: "Feste Dauer",
    rentalStart: "Beginn der Miete",
    rentalEnd: "Vereinbarte Rückgabe",
    rentalWeeks: "Anzahl Wochen",
    weeklyAmount: "Wochenpreis",
    totalAmount: "Gesamtpreis",
    deposit: "Kaution",
    currency: "CHF",
```

and to `en`:

```ts
    termsSection: "Rental period and price",
    rentalType: "Rental type",
    rentalTypeWeekly: "Weekly",
    rentalTypeFixed: "Fixed term",
    rentalStart: "Start of rental",
    rentalEnd: "Agreed return",
    rentalWeeks: "Number of weeks",
    weeklyAmount: "Weekly price",
    totalAmount: "Total price",
    deposit: "Deposit",
    currency: "CHF",
```

- [ ] **Step 2: Draw the block**

In `lib/rental/contractPdf.ts`, add the imports:

```ts
import { formatChf } from "./money";
import { resolveEndAt } from "./terms";
```

Then insert this section between the Vehicle block and the Renter block — that is, immediately after the `w.field(L.fuel, fuelLevelToFraction(details.fuelLevel));` line and before `// --- Renter ---`:

```ts
  // --- Terms -----------------------------------------------------------
  // Placed directly under the vehicle and above the renter, because what is
  // being agreed is a car for a period at a price: splitting the price away
  // from the car would put the two halves of the bargain on different pages
  // of a long contract.
  const terms = details.terms;
  w.sectionTitle(L.termsSection);
  w.field(
    L.rentalType,
    terms.type === "WEEKLY" ? L.rentalTypeWeekly : L.rentalTypeFixed
  );
  w.field(L.rentalStart, formatDateTime(new Date(terms.startAt)));
  w.field(L.rentalEnd, formatDateTime(resolveEndAt(terms)));

  if (terms.type === "WEEKLY") {
    w.field(L.rentalWeeks, String(terms.totalWeeks));
    w.field(
      L.weeklyAmount,
      `${L.currency} ${formatChf(terms.weeklyAmountCents)}`
    );
  } else {
    w.field(
      L.totalAmount,
      `${L.currency} ${formatChf(terms.totalAmountCents)}`
    );
  }

  w.field(L.deposit, `${L.currency} ${formatChf(terms.depositCents)}`);
```

- [ ] **Step 3: Verify by producing a document**

Run: `pnpm dev`, complete the wizard at `/apply/` with a 4-week weekly rental at 450.00 and a 500.00 deposit, and download the PDF from the result screen.

Check:
- A "MIETDAUER UND PREIS" section appears between Fahrzeug and Mieter.
- The agreed return is exactly four weeks after the start, at the same time of day.
- Amounts read `CHF 450.00` and `CHF 500.00` — not `45000`, not `450`.
- Nothing else about the document moved: the GTC appendix still starts on its own page and the footer still reads "Seite N von M".

Repeat once with a fixed-term rental and confirm the block shows a total instead of a weekly price and omits the week count.

- [ ] **Step 4: Commit**

```bash
git add lib/rental/contractPdf.ts lib/rental/labels.ts
git commit -m "feat(rental): print the agreed terms on the contract"
```

---

## Task 7: Contract numbers from a sequence

**Files:**
- Create: `lib/rental/contractNumber.ts`, `tests/db/contractNumber.test.ts`

**Interfaces:**
- Consumes: `prisma` (Task 1), `ZURICH` (Task 4).
- Produces: `allocateContractNumber(tx: Prisma.TransactionClient, organisationId: string, at: Date): Promise<string>` and `formatContractNumber(day: string, value: number): string`.

- [ ] **Step 1: Write the failing test**

Create `tests/db/contractNumber.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  allocateContractNumber,
  formatContractNumber,
} from "@/lib/rental/contractNumber";

async function anOrganisation() {
  return prisma.organisation.create({ data: { name: "ZURIAUTO" } });
}

describe("formatContractNumber", () => {
  it("keeps the shape numbers were already issued in", () => {
    expect(formatContractNumber("20260817", 1)).toBe("ZA-20260817-0001");
    expect(formatContractNumber("20260817", 42)).toBe("ZA-20260817-0042");
  });

  it("grows past four digits rather than wrapping to zero", () => {
    expect(formatContractNumber("20260817", 10_000)).toBe("ZA-20260817-10000");
  });
});

describe("allocateContractNumber", () => {
  it("starts at one on a new day", async () => {
    const org = await anOrganisation();
    const at = new Date("2026-08-17T10:00:00.000Z");
    const number = await allocateContractNumber(prisma, org.id, at);
    expect(number).toBe("ZA-20260817-0001");
  });

  it("increments within the same day", async () => {
    const org = await anOrganisation();
    const at = new Date("2026-08-17T10:00:00.000Z");
    await allocateContractNumber(prisma, org.id, at);
    const second = await allocateContractNumber(prisma, org.id, at);
    expect(second).toBe("ZA-20260817-0002");
  });

  it("restarts on the next day", async () => {
    const org = await anOrganisation();
    await allocateContractNumber(prisma, org.id, new Date("2026-08-17T10:00:00Z"));
    const next = await allocateContractNumber(
      prisma,
      org.id,
      new Date("2026-08-18T10:00:00.000Z")
    );
    expect(next).toBe("ZA-20260818-0001");
  });

  it("uses the Zurich date, not the UTC one", async () => {
    const org = await anOrganisation();
    // 23:30 UTC on the 17th is already the 18th in Zurich (CEST, UTC+2).
    const number = await allocateContractNumber(
      prisma,
      org.id,
      new Date("2026-08-17T23:30:00.000Z")
    );
    expect(number).toBe("ZA-20260818-0001");
  });

  it("never issues the same number twice under concurrency", async () => {
    const org = await anOrganisation();
    const at = new Date("2026-08-17T10:00:00.000Z");
    const numbers = await Promise.all(
      Array.from({ length: 20 }, () => allocateContractNumber(prisma, org.id, at))
    );
    expect(new Set(numbers).size).toBe(20);
  });

  it("counts separately per organisation", async () => {
    const a = await anOrganisation();
    const b = await prisma.organisation.create({ data: { name: "OTHER" } });
    const at = new Date("2026-08-17T10:00:00.000Z");
    await allocateContractNumber(prisma, a.id, at);
    expect(await allocateContractNumber(prisma, b.id, at)).toBe(
      "ZA-20260817-0001"
    );
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test:db`
Expected: FAIL — cannot resolve `@/lib/rental/contractNumber`.

- [ ] **Step 3: Implement**

Create `lib/rental/contractNumber.ts`:

```ts
/**
 * The reference printed on every contract.
 *
 * Replaces the Phase 1 stopgap — date plus plate digits plus a random suffix —
 * with a real sequence, which is what makes a number quotable on the phone and
 * countable in a report. The format is unchanged in shape so numbers already
 * issued to customers stay recognisable.
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import { TZDate } from "@date-fns/tz";
import { ZURICH } from "./terms";

/** `YYYYMMDD` as Zurich reckons the day, not as UTC does. */
function zurichDay(at: Date): string {
  const zoned = new TZDate(at.getTime(), ZURICH);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${zoned.getFullYear()}${pad(zoned.getMonth() + 1)}${pad(zoned.getDate())}`;
}

export function formatContractNumber(day: string, value: number): string {
  // padStart, not slice: on the day this office writes its ten-thousandth
  // contract the number should get longer, not start again at one.
  return `ZA-${day}-${String(value).padStart(4, "0")}`;
}

/**
 * Takes the next number for the day, atomically.
 *
 * `ON CONFLICT DO UPDATE ... RETURNING` is a single statement, so two
 * simultaneous handovers serialise on the counter row rather than racing.
 * Prisma has no upsert-and-increment-returning primitive, hence raw SQL.
 *
 * Accepts either the client or a transaction client so the allocation can join
 * the contract transaction — a number handed out for a contract that then
 * rolls back would leave a gap, and a gap in a contract sequence is the kind
 * of thing an auditor asks about.
 */
export async function allocateContractNumber(
  tx: Prisma.TransactionClient | PrismaClient,
  organisationId: string,
  at: Date = new Date()
): Promise<string> {
  const day = zurichDay(at);

  const rows = await tx.$queryRaw<{ value: number }[]>`
    INSERT INTO "ContractCounter" ("organisationId", "day", "value")
    VALUES (${organisationId}, ${day}, 1)
    ON CONFLICT ("organisationId", "day")
    DO UPDATE SET "value" = "ContractCounter"."value" + 1
    RETURNING "value"
  `;

  return formatContractNumber(day, rows[0].value);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test:db`
Expected: PASS.

The concurrency test is the one that matters. If it fails with duplicates, the `ON CONFLICT` clause is wrong — check that the composite primary key `@@id([organisationId, day])` actually produced a unique index named on those two columns (`\d "ContractCounter"` in `psql`).

- [ ] **Step 5: Commit**

```bash
git add lib/rental/contractNumber.ts tests/db/contractNumber.test.ts
git commit -m "feat(rental): allocate contract numbers from a per-day sequence"
```

---

## Task 8: Customers deduplicated by email

**Files:**
- Create: `lib/rental/customers.ts`, `tests/db/customers.test.ts`

**Interfaces:**
- Consumes: `prisma`, `ContractDetails` (Task 4's extended version).
- Produces: `normaliseEmail(email: string): string` and
  `upsertCustomer(tx, organisationId: string, details: ContractDetails): Promise<{ id: string }>`.

- [ ] **Step 1: Write the failing test**

Create `tests/db/customers.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { normaliseEmail, upsertCustomer } from "@/lib/rental/customers";
import type { ContractDetails } from "@/lib/rental/schema";

const base: ContractDetails = {
  vehicleId: "prius-zh513925",
  mileageKm: 120_000,
  fuelLevel: "full",
  existingDamage: "",
  terms: {
    type: "WEEKLY",
    startAt: "2026-08-17T08:00:00.000Z",
    totalWeeks: 4,
    weeklyAmountCents: 45_000,
    depositCents: 0,
  },
  lastName: "Meier",
  firstName: "Anna",
  birthDate: "1990-04-12",
  street: "Bahnhofstrasse 1",
  postalCode: "8001",
  city: "Zürich",
  country: "Switzerland",
  mobile: "+41791234567",
  email: "anna@example.ch",
  gtcAccepted: true,
  gtcVersion: "2026-07-31",
  gtcLanguage: "de",
  acceptedAt: "2026-08-17T08:00:00.000Z",
  place: "Zurich",
};

async function anOrganisation() {
  return prisma.organisation.create({ data: { name: "ZURIAUTO" } });
}

describe("normaliseEmail", () => {
  it("lowercases and trims", () => {
    expect(normaliseEmail("  Anna@Example.CH ")).toBe("anna@example.ch");
  });
});

describe("upsertCustomer", () => {
  it("creates a customer the first time", async () => {
    const org = await anOrganisation();
    const customer = await upsertCustomer(prisma, org.id, base);
    expect(customer.id).toBeTruthy();
    expect(await prisma.customer.count()).toBe(1);
  });

  it("reuses the record when the same person returns", async () => {
    const org = await anOrganisation();
    const first = await upsertCustomer(prisma, org.id, base);
    const second = await upsertCustomer(prisma, org.id, base);
    expect(second.id).toBe(first.id);
    expect(await prisma.customer.count()).toBe(1);
  });

  it("matches regardless of case and surrounding whitespace", async () => {
    const org = await anOrganisation();
    const first = await upsertCustomer(prisma, org.id, base);
    const again = await upsertCustomer(prisma, org.id, {
      ...base,
      email: "  ANNA@Example.ch  ",
    });
    expect(again.id).toBe(first.id);
  });

  it("updates the name and address from the newest contract", async () => {
    const org = await anOrganisation();
    await upsertCustomer(prisma, org.id, base);
    await upsertCustomer(prisma, org.id, {
      ...base,
      lastName: "Meier-Huber",
      street: "Langstrasse 9",
    });

    const stored = await prisma.customer.findFirstOrThrow();
    expect(stored.lastName).toBe("Meier-Huber");
    expect(stored.street).toBe("Langstrasse 9");
  });

  it("keeps two organisations' customers apart", async () => {
    const a = await anOrganisation();
    const b = await prisma.organisation.create({ data: { name: "OTHER" } });
    const inA = await upsertCustomer(prisma, a.id, base);
    const inB = await upsertCustomer(prisma, b.id, base);
    expect(inB.id).not.toBe(inA.id);
    expect(await prisma.customer.count()).toBe(2);
  });

  it("stores the birth date as a date, not a timestamp with a shifted day", async () => {
    const org = await anOrganisation();
    await upsertCustomer(prisma, org.id, base);
    const stored = await prisma.customer.findFirstOrThrow();
    expect(stored.birthDate.toISOString()).toBe("1990-04-12T00:00:00.000Z");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test:db`
Expected: FAIL — cannot resolve `@/lib/rental/customers`.

- [ ] **Step 3: Implement**

Create `lib/rental/customers.ts`:

```ts
/**
 * The renter, recognised across rentals.
 *
 * Deduplicating on email is what turns a pile of contracts into a history —
 * without it, the fourth rental by the same driver looks like a fourth
 * stranger, and the dashboard in Phase 5 has nothing to show.
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import type { ContractDetails } from "./schema";

/**
 * The single spelling an address is stored under.
 *
 * Mail servers treat the local part as case-sensitive in theory and nobody
 * does in practice; a customer who typed `Anna@` on Monday and `anna@` on
 * Friday is one customer.
 */
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Finds or creates the renter, and refreshes what they told us.
 *
 * Names and addresses are updated from the newest contract: people move, and
 * the record should describe them now. The PDF keeps whatever was signed, so
 * updating here never rewrites history — it only changes where the next letter
 * would be sent.
 */
export async function upsertCustomer(
  tx: Prisma.TransactionClient | PrismaClient,
  organisationId: string,
  details: ContractDetails
): Promise<{ id: string }> {
  const email = normaliseEmail(details.email);

  const shared = {
    firstName: details.firstName,
    lastName: details.lastName,
    phone: details.mobile,
    // `@db.Date` drops the time, but the value must still be a Date. Building
    // it as UTC midnight keeps the stored day equal to the day typed, which a
    // local-midnight Date would not west of Greenwich.
    birthDate: new Date(`${details.birthDate}T00:00:00.000Z`),
    street: details.street,
    postalCode: details.postalCode,
    city: details.city,
    country: details.country,
  };

  return tx.customer.upsert({
    where: { organisationId_email: { organisationId, email } },
    create: { organisationId, email, ...shared },
    update: shared,
    select: { id: true },
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test:db`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/rental/customers.ts tests/db/customers.test.ts
git commit -m "feat(rental): deduplicate customers by lowercased email"
```

---

## Task 9: A rate limiter that survives a cold start

**Files:**
- Create: `lib/rental/rateLimit.ts`, `tests/db/rateLimit.test.ts`
- Modify: `app/api/rental-contract/route.ts` (remove the in-memory limiter)

**Interfaces:**
- Consumes: `prisma`.
- Produces: `hashIp(ip: string): string` and
  `rateLimited(client: PrismaClient, ip: string, now?: Date): Promise<boolean>`,
  plus the exported constant `RATE_LIMIT = { max: 5, windowMs: 600_000 }`.

- [ ] **Step 1: Write the failing test**

Create `tests/db/rateLimit.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { RATE_LIMIT, hashIp, rateLimited } from "@/lib/rental/rateLimit";

describe("hashIp", () => {
  it("never returns the address it was given", () => {
    // The limiter must not itself become a store of personal data.
    expect(hashIp("203.0.113.9")).not.toContain("203.0.113.9");
  });

  it("is stable for the same address", () => {
    expect(hashIp("203.0.113.9")).toBe(hashIp("203.0.113.9"));
  });

  it("separates different addresses", () => {
    expect(hashIp("203.0.113.9")).not.toBe(hashIp("203.0.113.10"));
  });
});

describe("rateLimited", () => {
  const ip = "203.0.113.9";

  it("allows the first submissions and blocks past the limit", async () => {
    for (let i = 0; i < RATE_LIMIT.max; i += 1) {
      expect(await rateLimited(prisma, ip)).toBe(false);
    }
    expect(await rateLimited(prisma, ip)).toBe(true);
  });

  it("counts across cold starts, which the in-memory version could not", async () => {
    // Nothing here holds state between calls: every call reads the table. The
    // old module-scope Map reset on every new serverless instance.
    for (let i = 0; i < RATE_LIMIT.max; i += 1) await rateLimited(prisma, ip);
    expect(await prisma.submissionAttempt.count()).toBe(RATE_LIMIT.max);
    expect(await rateLimited(prisma, ip)).toBe(true);
  });

  it("does not block a different address", async () => {
    for (let i = 0; i <= RATE_LIMIT.max; i += 1) await rateLimited(prisma, ip);
    expect(await rateLimited(prisma, "198.51.100.4")).toBe(false);
  });

  it("forgets attempts once the window has passed", async () => {
    const start = new Date("2026-08-17T10:00:00.000Z");
    for (let i = 0; i < RATE_LIMIT.max; i += 1) {
      await rateLimited(prisma, ip, start);
    }
    expect(await rateLimited(prisma, ip, start)).toBe(true);

    const later = new Date(start.getTime() + RATE_LIMIT.windowMs + 1000);
    expect(await rateLimited(prisma, ip, later)).toBe(false);
  });

  it("prunes rows that can no longer matter", async () => {
    const start = new Date("2026-08-17T10:00:00.000Z");
    await rateLimited(prisma, ip, start);
    const later = new Date(start.getTime() + RATE_LIMIT.windowMs * 3);
    await rateLimited(prisma, ip, later);
    expect(await prisma.submissionAttempt.count()).toBe(1);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test:db`
Expected: FAIL — cannot resolve `@/lib/rental/rateLimit`.

- [ ] **Step 3: Implement**

Create `lib/rental/rateLimit.ts`:

```ts
/**
 * Per-IP submission limiting, backed by the database.
 *
 * Replaces a module-scope `Map` whose own comment admitted the problem: it
 * reset on every cold start and was not shared between concurrent instances,
 * so on a serverless platform it blunted a naive script and little else.
 */

import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

export const RATE_LIMIT = { max: 5, windowMs: 10 * 60 * 1000 };

/**
 * The address as stored: salted SHA-256, never the address itself.
 *
 * An IP is personal data, and a table of them accumulating indefinitely would
 * be a new obligation created for the sake of a spam check. The salt means the
 * table cannot be reversed with a rainbow table over the whole IPv4 space.
 */
export function hashIp(ip: string): string {
  return createHash("sha256")
    .update(`${process.env.RATE_LIMIT_SALT ?? ""}:${ip}`)
    .digest("hex");
}

/**
 * Records this attempt and reports whether it should be refused.
 *
 * Records first, then counts, so the caller cannot be tricked into a free
 * attempt by a failure between the two. Expired rows are deleted on the way
 * past, which keeps the table bounded without a scheduled job — there is no
 * scheduler until Phase 3.
 */
export async function rateLimited(
  client: PrismaClient,
  ip: string,
  now: Date = new Date()
): Promise<boolean> {
  const ipHash = hashIp(ip);
  const windowStart = new Date(now.getTime() - RATE_LIMIT.windowMs);

  await client.submissionAttempt.deleteMany({
    where: { createdAt: { lt: windowStart } },
  });

  await client.submissionAttempt.create({ data: { ipHash, createdAt: now } });

  const attempts = await client.submissionAttempt.count({
    where: { ipHash, createdAt: { gte: windowStart } },
  });

  return attempts > RATE_LIMIT.max;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test:db`
Expected: PASS.

- [ ] **Step 5: Remove the in-memory limiter**

In `app/api/rental-contract/route.ts`, delete lines 24–54 — the `RATE_LIMIT` constant, the `recentByIp` Map, its comment, and the `rateLimited` function — and replace the call at line 140:

```ts
  if (await rateLimited(prisma, clientIp(request))) {
    return NextResponse.json({ code: "rate-limited" }, { status: 429 });
  }
```

adding the imports:

```ts
import { prisma } from "@/lib/db";
import { rateLimited } from "@/lib/rental/rateLimit";
```

Update the file's header comment: the sentence "Those are mitigations rather than a solution — real rate limiting arrives with the Phase 2 datastore." is now false. Replace with "The limiter is backed by the database, so it survives a cold start and is shared across instances."

- [ ] **Step 6: Verify the handler still works**

Run: `pnpm exec tsc --noEmit` — expect zero errors.
Run: `pnpm dev` and submit a contract from `/apply/`. Expect the same behaviour as before, and a row in `SubmissionAttempt`:

```bash
docker compose exec db psql -U zuriauto -d zuriauto -c 'SELECT count(*) FROM "SubmissionAttempt";'
```

- [ ] **Step 7: Commit**

```bash
git add lib/rental/rateLimit.ts tests/db/rateLimit.test.ts app/api/rental-contract/route.ts
git commit -m "feat(rental): move rate limiting into the database"
```

---

## Task 10: The asset store

**Files:**
- Create: `lib/storage/types.ts`, `lib/storage/memory.ts`, `lib/storage/r2.ts`, `lib/storage/index.ts`, `lib/storage/keys.ts`, `lib/storage/keys.test.ts`, `lib/storage/upload.ts`
- Modify: `.env.local.example`

**Interfaces:**
- Produces:
  - `interface AssetStore { put(key: string, body: Uint8Array, contentType: string): Promise<void> }`
  - `createMemoryStore(): AssetStore & { objects: Map<string, { body: Uint8Array; contentType: string }> }`
  - `getAssetStore(): AssetStore`
  - `assetKey(submissionId: string, kind: string, extension: string): string`
  - `interface PendingUpload { kind: string; body: Uint8Array; contentType: string }`
  - `interface StoredAsset { kind: string; storageKey: string; contentType: string; bytes: number }`
  - `uploadAssets(store: AssetStore, submissionId: string, uploads: PendingUpload[]): Promise<StoredAsset[]>`

- [ ] **Step 1: Write the failing test for keys**

Create `lib/storage/keys.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { assetKey, extensionFor } from "./keys";

describe("assetKey", () => {
  it("groups a submission's objects under one prefix", () => {
    const key = assetKey("11111111-2222-3333-4444-555555555555", "ID_FRONT", "jpg");
    expect(key.startsWith("pickup/11111111-2222-3333-4444-555555555555/")).toBe(
      true
    );
  });

  it("says nothing about the person in the key itself", () => {
    // Keys reach logs, storage consoles and support tickets. A name or an
    // email in one is a leak that no access control catches.
    const key = assetKey("11111111-2222-3333-4444-555555555555", "ID_FRONT", "jpg");
    expect(key).toMatch(/^pickup\/[0-9a-f-]{36}\/ID_FRONT-[0-9a-f]{16}\.jpg$/);
  });

  it("gives two objects of the same kind different keys", () => {
    const a = assetKey("11111111-2222-3333-4444-555555555555", "CONDITION_PHOTO", "jpg");
    const b = assetKey("11111111-2222-3333-4444-555555555555", "CONDITION_PHOTO", "jpg");
    expect(a).not.toBe(b);
  });
});

describe("extensionFor", () => {
  it("maps the content types the wizard produces", () => {
    expect(extensionFor("image/jpeg")).toBe("jpg");
    expect(extensionFor("image/png")).toBe("png");
    expect(extensionFor("image/webp")).toBe("webp");
    expect(extensionFor("application/pdf")).toBe("pdf");
  });

  it("falls back to bin rather than inventing an extension", () => {
    expect(extensionFor("application/octet-stream")).toBe("bin");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test`
Expected: FAIL — cannot resolve `./keys`.

- [ ] **Step 3: Implement the keys**

Create `lib/storage/keys.ts`:

```ts
import { randomBytes } from "node:crypto";

/**
 * Object keys, deliberately meaningless.
 *
 * A key ends up in server logs, in the storage console and in whatever support
 * ticket someone pastes it into. Putting a name, an email or a contract number
 * in one would leak the association between a person and their ID scan to
 * everywhere a string can travel — so the key carries a submission UUID and
 * nothing else.
 *
 * The submission UUID, not the contract id: assets are uploaded before the
 * transaction commits, so no contract id exists yet. It also means an aborted
 * submission's orphans share one prefix and can be swept in a single call.
 */
export function assetKey(
  submissionId: string,
  kind: string,
  extension: string
): string {
  return `pickup/${submissionId}/${kind}-${randomBytes(8).toString("hex")}.${extension}`;
}

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export function extensionFor(contentType: string): string {
  return EXTENSIONS[contentType] ?? "bin";
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 5: Add the store implementations**

Create `lib/storage/types.ts`:

```ts
/**
 * Somewhere to put bytes.
 *
 * Kept to one method on purpose. Nothing in Phase 2 reads an object back —
 * the PDF the customer needs is the one the browser already has, and the only
 * consumer of stored images is a human opening the storage console. Adding
 * `get` and `delete` before there is a caller would be designing the Phase 5
 * dashboard from here.
 */
export interface AssetStore {
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
}
```

Create `lib/storage/memory.ts`:

```ts
import type { AssetStore } from "./types";

/**
 * The store used by tests.
 *
 * Exposes what it holds, so a test can assert that five documents and a
 * signature were uploaded without reaching for a network mock.
 */
export function createMemoryStore(): AssetStore & {
  objects: Map<string, { body: Uint8Array; contentType: string }>;
} {
  const objects = new Map<string, { body: Uint8Array; contentType: string }>();
  return {
    objects,
    async put(key, body, contentType) {
      objects.set(key, { body, contentType });
    },
  };
}
```

Create `lib/storage/r2.ts`:

```ts
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { AssetStore } from "./types";

/**
 * Cloudflare R2, over its S3-compatible API.
 *
 * R2 rather than Vercel Blob because the bucket's jurisdiction can be pinned
 * to the EU at creation — and with ID scans and driving licences in it, the
 * region is a legal requirement under the revised DSG and under GDPR for EU
 * tourists, not a preference.
 *
 * `region: "auto"` is what R2 expects; the SDK insists on the field.
 */
export function createR2Store(): AssetStore {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } =
    process.env;

  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
    throw new Error("R2 is not configured");
  }

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });

  return {
    async put(key, body, contentType) {
      await client.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: key,
          Body: body,
          ContentType: contentType,
        })
      );
    },
  };
}
```

Create `lib/storage/index.ts`:

```ts
import { createMemoryStore } from "./memory";
import { createR2Store } from "./r2";
import type { AssetStore } from "./types";

export type { AssetStore } from "./types";
export { createMemoryStore } from "./memory";

let cached: AssetStore | null = null;

/**
 * The store this process should use.
 *
 * Falls back to memory only when R2 is unconfigured, and says so loudly: a
 * production deploy that silently discarded every ID scan while reporting
 * success would be far worse than one that refuses to start.
 */
export function getAssetStore(): AssetStore {
  if (cached) return cached;

  if (process.env.R2_BUCKET) {
    cached = createR2Store();
  } else {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "R2 is not configured. Refusing to accept identity documents with nowhere to put them."
      );
    }
    console.warn(
      "[storage] R2 is not configured — uploads are held in memory and lost on restart."
    );
    cached = createMemoryStore();
  }

  return cached;
}
```

Create `lib/storage/upload.ts`:

```ts
import { assetKey, extensionFor } from "./keys";
import type { AssetStore } from "./types";

/**
 * Uploading a submission's images, kept separate from what is done with them.
 *
 * `kind` is a plain string rather than Prisma's `AssetKind` on purpose: this
 * module is about bytes and keys, and importing the database's enum here would
 * make the storage layer depend on the schema for no gain. The caller does the
 * narrowing.
 */
export interface PendingUpload {
  kind: string;
  body: Uint8Array;
  contentType: string;
}

export interface StoredAsset {
  kind: string;
  storageKey: string;
  contentType: string;
  bytes: number;
}

/**
 * Puts every object under one submission prefix and reports what landed where.
 *
 * Extracted rather than inlined into the pickup path because the return wizard
 * in Phase 4 uploads damage photographs and a second signature through exactly
 * this shape. Nothing here knows what a pickup is.
 */
export async function uploadAssets(
  store: AssetStore,
  submissionId: string,
  uploads: PendingUpload[]
): Promise<StoredAsset[]> {
  return Promise.all(
    uploads.map(async (upload) => {
      const key = assetKey(
        submissionId,
        upload.kind,
        extensionFor(upload.contentType)
      );
      await store.put(key, upload.body, upload.contentType);
      return {
        kind: upload.kind,
        storageKey: key,
        contentType: upload.contentType,
        bytes: upload.body.byteLength,
      };
    })
  );
}
```

Re-export it from `lib/storage/index.ts`:

```ts
export { uploadAssets } from "./upload";
export type { PendingUpload, StoredAsset } from "./upload";
```

Install the SDK:

```bash
pnpm add @aws-sdk/client-s3
```

- [ ] **Step 6: Document the environment**

Add to `.env.local.example`:

```
# --- Object storage (Cloudflare R2) -----------------------------------
# ID scans, driving licences, the portrait, the signature and condition
# photos. Create the bucket with an EU jurisdiction:
#   wrangler r2 bucket create zuriauto-assets --jurisdiction eu
# Left empty in development, uploads are held in memory and lost on restart.
# Left empty in production, the app refuses to start.
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
```

- [ ] **Step 7: Verify**

Run: `pnpm test` and `pnpm exec tsc --noEmit`
Expected: both pass.

- [ ] **Step 8: Commit**

```bash
git add lib/storage .env.local.example package.json pnpm-lock.yaml
git commit -m "feat(storage): add the R2-backed asset store"
```

---

## Task 11: The Car table, seeded from the fleet file

**Files:**
- Create: `prisma/seed.ts`, `app/api/fleet/route.ts`, `tests/db/seed.test.ts`
- Modify: `lib/rental/fleet.ts`, `components/rental/RentalPickupWizard.tsx`, `package.json`

**Interfaces:**
- Consumes: `fleet`, `FleetVehicle` from `lib/rental/fleet.ts`; `prisma`.
- Produces: `seedFleet(client, organisationId): Promise<void>` and `ensureOrganisation(client): Promise<{ id: string }>`, both exported from `prisma/seed.ts`; `GET /api/fleet/` returning `{ vehicles: FleetVehicle[] }`.

- [ ] **Step 1: Write the failing test**

Create `tests/db/seed.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { ensureOrganisation, seedFleet } from "@/prisma/seed";
import { fleet } from "@/lib/rental/fleet";

describe("ensureOrganisation", () => {
  it("creates exactly one organisation", async () => {
    await ensureOrganisation(prisma);
    await ensureOrganisation(prisma);
    expect(await prisma.organisation.count()).toBe(1);
  });
});

describe("seedFleet", () => {
  it("puts every vehicle from the file in the table", async () => {
    const org = await ensureOrganisation(prisma);
    await seedFleet(prisma, org.id);
    expect(await prisma.car.count()).toBe(fleet.length);
  });

  it("is safe to run twice", async () => {
    const org = await ensureOrganisation(prisma);
    await seedFleet(prisma, org.id);
    await seedFleet(prisma, org.id);
    expect(await prisma.car.count()).toBe(fleet.length);
  });

  it("refreshes identity from the file", async () => {
    const org = await ensureOrganisation(prisma);
    await seedFleet(prisma, org.id);
    await prisma.car.updateMany({ data: { model: "WRONG" } });
    await seedFleet(prisma, org.id);
    expect(await prisma.car.count({ where: { model: "WRONG" } })).toBe(0);
  });

  it("never touches status, so a car taken out of service stays out", async () => {
    // This is the whole point of the split: identity is reviewed in code,
    // availability is changed by the office without a deploy.
    const org = await ensureOrganisation(prisma);
    await seedFleet(prisma, org.id);
    const car = await prisma.car.findFirstOrThrow();
    await prisma.car.update({
      where: { id: car.id },
      data: { status: "maintenance" },
    });

    await seedFleet(prisma, org.id);

    const after = await prisma.car.findUniqueOrThrow({ where: { id: car.id } });
    expect(after.status).toBe("maintenance");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test:db`
Expected: FAIL — cannot resolve `@/prisma/seed`.

- [ ] **Step 3: Implement the seed**

Create `prisma/seed.ts`:

```ts
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

import type { PrismaClient } from "@prisma/client";
import { PrismaClient as Client } from "@prisma/client";
import { fleet } from "../lib/rental/fleet";

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
      where: {
        organisationId_slug: { organisationId, slug: vehicle.id },
      },
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

async function main() {
  const client = new Client();
  try {
    const org = await ensureOrganisation(client);
    await seedFleet(client, org.id);
    console.log(`[seed] organisation ${org.id}, ${fleet.length} vehicles`);
  } finally {
    await client.$disconnect();
  }
}

// Only when run as a script, so importing it from a test does not seed.
if (process.argv[1]?.endsWith("seed.ts")) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test:db`
Expected: PASS.

- [ ] **Step 5: Run the seed for real**

Run: `pnpm db:seed`
Expected: `[seed] organisation c..., 8 vehicles`

Verify:
```bash
docker compose exec db psql -U zuriauto -d zuriauto -c 'SELECT slug, plate, status FROM "Car" ORDER BY slug;'
```

- [ ] **Step 6: Serve the fleet from the table**

Create `app/api/fleet/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { FleetVehicle } from "@/lib/rental/fleet";

/**
 * The vehicles the picker may offer.
 *
 * Reads the table so that taking a car off the road is a status change, not a
 * deploy. Only `available` cars are returned — a customer must never be able
 * to sign a contract naming a car that is in the garage, so unavailable ones
 * are omitted rather than shown disabled, exactly as the fleet file already
 * filters placeholders.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const cars = await prisma.car.findMany({
    where: { status: "available" },
    orderBy: { slug: "asc" },
    select: { slug: true, model: true, plate: true, vin: true },
  });

  const vehicles: FleetVehicle[] = cars.map((car) => ({
    id: car.slug,
    model: car.model,
    plate: car.plate,
    vin: car.vin ?? undefined,
  }));

  return NextResponse.json({ vehicles });
}
```

- [ ] **Step 7: Have the wizard read it**

In `components/rental/RentalPickupWizard.tsx`, add state and a fetch beside the other effects:

```ts
/**
 * The picker's options, from the database.
 *
 * Seeded with the compiled-in fleet so the form is usable on first paint and
 * still works if the request fails — a car sitting at the kerb with a customer
 * beside it is not the moment to discover the fleet endpoint is down. The
 * response, when it arrives, is authoritative: it reflects what is actually
 * available.
 */
const [vehicles, setVehicles] = useState<FleetVehicle[]>(availableFleet);

useEffect(() => {
  let cancelled = false;
  fetch("/api/fleet/")
    .then((response) => (response.ok ? response.json() : null))
    .then((payload) => {
      if (cancelled || !payload?.vehicles?.length) return;
      setVehicles(payload.vehicles as FleetVehicle[]);
    })
    .catch(() => {
      // Keep the compiled-in list. Logged, not surfaced: the form works.
      console.warn("[apply] fleet endpoint unavailable, using the bundled list");
    });
  return () => {
    cancelled = true;
  };
}, []);
```

Add `FleetVehicle` to the existing import from `@/lib/rental/fleet`.

Then replace the two places that read the compiled-in list:
- The vehicle `<select>` in the step-1 block (around line 660) iterates `availableFleet` — change it to `vehicles`.
- `const vehicle = useMemo(() => findVehicle(form.vehicleId), [form.vehicleId]);` (line 192) becomes:
  ```ts
  const vehicle = useMemo(
    () => vehicles.find((candidate) => candidate.id === form.vehicleId),
    [vehicles, form.vehicleId]
  );
  ```
- `EMPTY_FORM.vehicleId` still uses `availableFleet` at module scope, which is correct — it is the pre-fetch default.

- [ ] **Step 8: Verify by hand**

Run: `pnpm dev`, open `/apply/`, confirm eight vehicles are offered. Then:

```bash
docker compose exec db psql -U zuriauto -d zuriauto \
  -c "UPDATE \"Car\" SET status = 'maintenance' WHERE plate = 'ZH 886 530';"
```

Reload `/apply/` and confirm the Skoda Octavia `ZH 886 530` is gone, with no deploy. Put it back:

```bash
docker compose exec db psql -U zuriauto -d zuriauto \
  -c "UPDATE \"Car\" SET status = 'available' WHERE plate = 'ZH 886 530';"
```

- [ ] **Step 9: Commit**

```bash
git add prisma/seed.ts app/api/fleet/route.ts tests/db/seed.test.ts components/rental/RentalPickupWizard.tsx package.json
git commit -m "feat(rental): seed the fleet into the database and serve the picker from it"
```

---

## Task 12: The write fence

**Files:**
- Create: `lib/applyKey.ts`, `lib/applyKey.test.ts`
- Modify: `components/rental/RentalPickupWizard.tsx`, `app/api/rental-contract/route.ts`, `lib/rental/labels.ts`

**Interfaces:**
- Produces: `APPLY_KEY_PARAM = "k"`, `APPLY_KEY_HEADER = "x-apply-key"`, and `applyKeyValid(supplied: string | null): boolean`.

- [ ] **Step 1: Write the failing test**

Create `lib/applyKey.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyKeyValid } from "./applyKey";

const original = process.env.APPLY_SECRET;
beforeEach(() => {
  process.env.APPLY_SECRET = "correct-horse-battery-staple";
});
afterEach(() => {
  process.env.APPLY_SECRET = original;
});

describe("applyKeyValid", () => {
  it("accepts the configured secret", () => {
    expect(applyKeyValid("correct-horse-battery-staple")).toBe(true);
  });

  it("rejects a wrong secret", () => {
    expect(applyKeyValid("wrong")).toBe(false);
  });

  it("rejects a missing secret", () => {
    expect(applyKeyValid(null)).toBe(false);
    expect(applyKeyValid("")).toBe(false);
  });

  it("rejects a prefix of the secret", () => {
    expect(applyKeyValid("correct-horse")).toBe(false);
  });

  it("refuses everything when the server has no secret configured", () => {
    // Fail closed. An unset secret must not mean an open write endpoint.
    delete process.env.APPLY_SECRET;
    expect(applyKeyValid("anything")).toBe(false);
    expect(applyKeyValid("")).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test`
Expected: FAIL — cannot resolve `./applyKey`.

- [ ] **Step 3: Implement**

Create `lib/applyKey.ts`:

```ts
import { timingSafeEqual } from "node:crypto";

/**
 * The fence around the write endpoint.
 *
 * From Phase 2 `/apply` stops being merely a spam-relay target and becomes a
 * write to the system of record. An open endpoint would let anyone create a
 * rental against a real plate — and a fabricated rental naming a real driver
 * is a far worse artifact than a spam email, because the traffic-fine lookup
 * would answer with it.
 *
 * A shared secret, not a login: the page is already unindexed, the office
 * pastes the link into WhatsApp, and named accounts arrive in Phase 5 with the
 * dashboard, where they are needed anyway. Accepted trade-off — no attribution
 * and no per-person revocation, because the secret leaks the moment a URL is
 * forwarded. Rotate it by changing the environment variable.
 */

export const APPLY_KEY_PARAM = "k";
export const APPLY_KEY_HEADER = "x-apply-key";

export function applyKeyValid(supplied: string | null): boolean {
  const expected = process.env.APPLY_SECRET;
  // Fail closed: an unconfigured secret is a misconfiguration, not permission.
  if (!expected || !supplied) return false;

  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on a length mismatch, which would itself leak the
  // length, so the comparison is guarded rather than short-circuited on it.
  if (a.length !== b.length) {
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 5: Check it in the handler**

In `app/api/rental-contract/route.ts`, make this the very first thing `POST` does — before the origin check, before `formData()`:

```ts
  // First, so an unauthorised request costs nothing to reject.
  if (!applyKeyValid(request.headers.get(APPLY_KEY_HEADER))) {
    return NextResponse.json({ code: "unauthorised" }, { status: 401 });
  }
```

with the import:

```ts
import { APPLY_KEY_HEADER, applyKeyValid } from "@/lib/applyKey";
```

- [ ] **Step 6: Send it from the wizard, and gate the page at load**

This gate must be at load, not at submit. A customer who fills in five steps, photographs four documents and signs, only to be told the link was invalid, has been made to do all of that for nothing.

In `components/rental/RentalPickupWizard.tsx`:

```ts
/**
 * The key from the link the office sent.
 *
 * Read from `window.location.search` rather than `useSearchParams`, because
 * this page is statically prerendered and `useSearchParams` would force it
 * into a Suspense boundary for one string.
 */
const [applyKey, setApplyKey] = useState<string | null | undefined>(undefined);

useEffect(() => {
  setApplyKey(
    new URLSearchParams(window.location.search).get(APPLY_KEY_PARAM)
  );
}, []);
```

Render the gate before anything else in the component's return, and note `undefined` means "not yet read on the client" — rendering the refusal during that moment would flash it at every legitimate visitor:

```tsx
if (applyKey === null) {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="text-xl font-semibold">{L.gate.title}</h1>
      <p className="mt-3 text-muted-foreground">{L.gate.body}</p>
    </div>
  );
}
```

Add the header to the submit `fetch` (line 506):

```ts
const response = await fetch("/api/rental-contract/", {
  method: "POST",
  headers: applyKey ? { [APPLY_KEY_HEADER]: applyKey } : undefined,
  body,
});
```

Import both constants from `@/lib/applyKey`.

- [ ] **Step 7: Add the gate copy**

To `de` in `lib/rental/labels.ts`:

```ts
  gate: {
    title: "Link nicht gültig",
    body:
      "Dieser Link ist unvollständig oder abgelaufen. Bitte fordern Sie bei ZURIAUTO einen neuen Link an.",
  },
```

To `en`:

```ts
  gate: {
    title: "Link not valid",
    body:
      "This link is incomplete or has expired. Please ask ZURIAUTO for a new one.",
  },
```

- [ ] **Step 8: Verify by hand**

Set `APPLY_SECRET=dev-secret` in `.env.local`, restart `pnpm dev`, then:

- Open `http://localhost:3000/apply/` — expect the "Link nicht gültig" panel and no form.
- Open `http://localhost:3000/apply/?k=dev-secret` — expect the wizard.
- With the wizard open, run:
  ```bash
  curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3000/api/rental-contract/
  ```
  Expect `401`.
- Complete a submission through the wizard and confirm it still succeeds.

- [ ] **Step 9: Commit**

```bash
git add lib/applyKey.ts lib/applyKey.test.ts components/rental/RentalPickupWizard.tsx app/api/rental-contract/route.ts lib/rental/labels.ts
git commit -m "feat(rental): fence the write endpoint with a shared secret"
```

---

## Task 13: The route handler writes records

The assembly. Every earlier task exists so this one is short.

**Files:**
- Create: `lib/rental/mail.ts`, `lib/rental/persistPickup.ts`, `tests/db/persistPickup.test.ts`
- Modify: `app/api/rental-contract/route.ts`, `components/rental/RentalPickupWizard.tsx`, `lib/rental/labels.ts`, `lib/rental/schema.ts`

**Interfaces:**
- Consumes: everything from Tasks 2, 3, 4, 7, 8, 9, 10, 12.
- Produces:
  - `interface PickupUpload { kind: AssetKind; body: Uint8Array; contentType: string }`
  - `persistPickup(input: { organisationId: string; details: ContractDetails; vehicleSlug: string; uploads: PickupUpload[]; pdf: { body: Uint8Array }; store: AssetStore; now?: Date }): Promise<{ contractId: string; contractNumber: string; rentalId: string }>`
  - `sendContractMails(...)` in `lib/rental/mail.ts`, extracted verbatim from the current handler.
  - `contractMetaSchema` gains `terms` so the handler can validate what it is asked to store.

- [ ] **Step 1: Extend the meta schema**

In `lib/rental/schema.ts`, add to `contractMetaSchema`:

```ts
  /**
   * The full validated detail, not a summary.
   *
   * Phase 1 sent a summary because the handler only had to address an email.
   * It now writes the system of record, and re-validating what the browser
   * claims is the whole reason the schema runs on both sides.
   */
  details: contractDetailsSchema,
```

and in `components/rental/RentalPickupWizard.tsx`, add `details: parsed.data,` to the object stringified into `body.append("meta", ...)` at line 490.

- [ ] **Step 2: Extract the mail sending**

Create `lib/rental/mail.ts` and move `MailConfig`, `readMailConfig`, `warnedAboutArchive` and both `sendMail` calls out of the route handler into it, unchanged in behaviour:

```ts
import nodemailer from "nodemailer";
import { PAYMENT_URL } from "@/lib/payment";
import { labelsFor } from "./labels";
import type { ContractMeta } from "./schema";

/** ...move the existing MailConfig interface and readMailConfig here verbatim... */

export interface MailOutcome {
  delivered: "both" | "office" | "none";
  error?: string;
}

/**
 * Sends the office copy and the customer copy.
 *
 * Never throws. From Phase 2 the records are already committed when this runs,
 * so a mail failure is a fact to be recorded on the contract and retried in
 * Phase 3 — not an error that should unwind a signed handover.
 */
export async function sendContractMails(
  meta: ContractMeta,
  pdf: Buffer
): Promise<MailOutcome> {
  const config = readMailConfig();
  if (!config) return { delivered: "none", error: "mail-not-configured" };

  const L = labelsFor(meta.language);
  const attachment = {
    filename: `${meta.contractNumber}.pdf`,
    content: pdf,
    contentType: "application/pdf",
  };

  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: { user: config.user, pass: config.pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });

  const officeSummary = [
    `${L.pdf.contractNumber}: ${meta.contractNumber}`,
    `${L.pdf.customerSection}: ${meta.customerName}`,
    `${L.pdf.email}: ${meta.customerEmail}`,
    `${L.pdf.model}: ${meta.vehicleLabel}`,
    `${L.pdf.plate}: ${meta.plate}`,
    `${L.pdf.mileage}: ${meta.mileageKm} ${L.pdf.km}`,
  ].join("\n");

  try {
    await transport.sendMail({
      from: config.from,
      to: config.office,
      bcc: config.archive,
      replyTo: meta.customerEmail,
      subject: `${L.email.officeSubject} – ${meta.plate} – ${meta.customerName}`,
      text: officeSummary,
      attachments: [attachment],
    });
  } catch (error) {
    console.error("[rental-contract] office mail failed:", error);
    return { delivered: "none", error: String(error) };
  }

  try {
    await transport.sendMail({
      from: config.from,
      to: meta.customerEmail,
      subject: `${L.email.customerSubject} – ${meta.contractNumber}`,
      text: [
        L.email.customerGreeting,
        "",
        `${L.email.customerPayment}`,
        PAYMENT_URL,
        "",
        L.email.customerSignature,
      ].join("\n"),
      attachments: [attachment],
    });
  } catch (error) {
    console.error("[rental-contract] customer copy failed:", error);
    return { delivered: "office", error: String(error) };
  }

  return { delivered: "both" };
}
```

- [ ] **Step 3: Write the failing test**

Create `tests/db/persistPickup.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { ensureOrganisation, seedFleet } from "@/prisma/seed";
import { persistPickup, type PickupUpload } from "@/lib/rental/persistPickup";
import { createMemoryStore } from "@/lib/storage";
import type { ContractDetails } from "@/lib/rental/schema";

const details: ContractDetails = {
  vehicleId: "prius-zh513925",
  mileageKm: 120_000,
  fuelLevel: "3/4",
  existingDamage: "Kratzer hinten links",
  terms: {
    type: "WEEKLY",
    startAt: "2026-08-17T08:00:00.000Z",
    totalWeeks: 4,
    weeklyAmountCents: 45_000,
    depositCents: 50_000,
  },
  lastName: "Meier",
  firstName: "Anna",
  birthDate: "1990-04-12",
  street: "Bahnhofstrasse 1",
  postalCode: "8001",
  city: "Zürich",
  country: "Switzerland",
  mobile: "+41791234567",
  email: "Anna@Example.CH",
  gtcAccepted: true,
  gtcVersion: "2026-07-31",
  gtcLanguage: "de",
  acceptedAt: "2026-08-17T08:00:00.000Z",
  place: "Zurich",
};

const uploads: PickupUpload[] = [
  { kind: "PORTRAIT", body: new Uint8Array([1]), contentType: "image/jpeg" },
  { kind: "ID_FRONT", body: new Uint8Array([2]), contentType: "image/jpeg" },
  { kind: "ID_BACK", body: new Uint8Array([3]), contentType: "image/jpeg" },
  { kind: "LICENCE_FRONT", body: new Uint8Array([4]), contentType: "image/jpeg" },
  { kind: "LICENCE_BACK", body: new Uint8Array([5]), contentType: "image/jpeg" },
  { kind: "SIGNATURE", body: new Uint8Array([6]), contentType: "image/png" },
];

async function ready() {
  const org = await ensureOrganisation(prisma);
  await seedFleet(prisma, org.id);
  return { organisationId: org.id, store: createMemoryStore() };
}

const pdf = { body: new Uint8Array([7, 8, 9]) };

describe("persistPickup", () => {
  it("writes a customer, a rental, a contract and one asset per upload", async () => {
    const { organisationId, store } = await ready();
    const result = await persistPickup({
      organisationId,
      details,
      vehicleSlug: details.vehicleId,
      uploads,
      pdf,
      store,
    });

    expect(result.contractNumber).toMatch(/^ZA-\d{8}-\d{4}$/);
    expect(await prisma.customer.count()).toBe(1);
    expect(await prisma.rental.count()).toBe(1);
    expect(await prisma.contract.count()).toBe(1);
    expect(await prisma.asset.count()).toBe(uploads.length);
  });

  it("uploads every asset and the PDF", async () => {
    const { organisationId, store } = await ready();
    await persistPickup({
      organisationId,
      details,
      vehicleSlug: details.vehicleId,
      uploads,
      pdf,
      store,
    });
    // Six assets plus the contract PDF.
    expect(store.objects.size).toBe(uploads.length + 1);
  });

  it("derives endAt from the weekly term", async () => {
    const { organisationId, store } = await ready();
    await persistPickup({
      organisationId,
      details,
      vehicleSlug: details.vehicleId,
      uploads,
      pdf,
      store,
    });
    const rental = await prisma.rental.findFirstOrThrow();
    expect(rental.endAt.toISOString()).toBe("2026-09-14T08:00:00.000Z");
    expect(rental.weeklyAmountCents).toBe(45_000);
    expect(rental.totalAmountCents).toBeNull();
    expect(rental.depositCents).toBe(50_000);
  });

  it("stores a fixed-term rental's own end and total", async () => {
    const { organisationId, store } = await ready();
    await persistPickup({
      organisationId,
      details: {
        ...details,
        terms: {
          type: "FIXED_TERM",
          startAt: "2026-08-17T08:00:00.000Z",
          endAt: "2026-08-24T17:00:00.000Z",
          totalAmountCents: 60_000,
          depositCents: 0,
        },
      },
      vehicleSlug: details.vehicleId,
      uploads,
      pdf,
      store,
    });
    const rental = await prisma.rental.findFirstOrThrow();
    expect(rental.endAt.toISOString()).toBe("2026-08-24T17:00:00.000Z");
    expect(rental.totalAmountCents).toBe(60_000);
    expect(rental.weeklyAmountCents).toBeNull();
  });

  it("marks the car rented", async () => {
    const { organisationId, store } = await ready();
    await persistPickup({
      organisationId,
      details,
      vehicleSlug: details.vehicleId,
      uploads,
      pdf,
      store,
    });
    const car = await prisma.car.findFirstOrThrow({
      where: { slug: details.vehicleId },
    });
    expect(car.status).toBe("rented");
  });

  it("records a pickup.completed event", async () => {
    const { organisationId, store } = await ready();
    await persistPickup({
      organisationId,
      details,
      vehicleSlug: details.vehicleId,
      uploads,
      pdf,
      store,
    });
    const event = await prisma.rentalEvent.findFirstOrThrow();
    expect(event.type).toBe("pickup.completed");
  });

  it("stores the fuel level in its database spelling", async () => {
    const { organisationId, store } = await ready();
    await persistPickup({
      organisationId,
      details,
      vehicleSlug: details.vehicleId,
      uploads,
      pdf,
      store,
    });
    const contract = await prisma.contract.findFirstOrThrow();
    expect(contract.fuelLevel).toBe("three_quarter");
  });

  it("refuses a car that is already rented", async () => {
    const { organisationId, store } = await ready();
    const args = {
      organisationId,
      details,
      vehicleSlug: details.vehicleId,
      uploads,
      pdf,
      store,
    };
    await persistPickup(args);
    await expect(persistPickup(args)).rejects.toThrow(/already rented/i);
  });

  it("rolls back completely when a step inside the transaction fails", async () => {
    const { organisationId, store } = await ready();
    await expect(
      persistPickup({
        organisationId,
        details,
        vehicleSlug: "no-such-car",
        uploads,
        pdf,
        store,
      })
    ).rejects.toThrow();

    // Not a single orphan row, in particular no Customer: a half-written
    // handover is worse than none, because it looks like a real record.
    expect(await prisma.customer.count()).toBe(0);
    expect(await prisma.rental.count()).toBe(0);
    expect(await prisma.contract.count()).toBe(0);
    expect(await prisma.asset.count()).toBe(0);
  });

  it("gives a returning customer a second rental, not a second identity", async () => {
    const { organisationId, store } = await ready();
    await persistPickup({
      organisationId,
      details,
      vehicleSlug: details.vehicleId,
      uploads,
      pdf,
      store,
    });
    await prisma.car.updateMany({ data: { status: "available" } });
    await persistPickup({
      organisationId,
      details: { ...details, email: "anna@example.ch" },
      vehicleSlug: details.vehicleId,
      uploads,
      pdf,
      store,
    });

    expect(await prisma.customer.count()).toBe(1);
    expect(await prisma.rental.count()).toBe(2);
  });
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `pnpm test:db`
Expected: FAIL — cannot resolve `@/lib/rental/persistPickup`.

- [ ] **Step 5: Implement**

Create `lib/rental/persistPickup.ts`:

```ts
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
import type { AssetKind, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assetKey } from "@/lib/storage/keys";
import { uploadAssets, type AssetStore } from "@/lib/storage";
import { allocateContractNumber } from "./contractNumber";
import { upsertCustomer } from "./customers";
import { fuelLevelToDb } from "./fleet";
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
  // Outside the transaction on purpose: an S3 call inside one would hold a
  // database connection open across the network for as long as six photos
  // take to upload. A failure here means orphaned objects under one prefix,
  // which is sweepable; a failure the other way round would mean a contract
  // row pointing at images that do not exist.
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
        // Two handovers of one car is a real-world mistake the office has to
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
        // `uploadAssets` deals in plain strings so the storage layer stays
        // free of the schema; the narrowing happens here, where the enum
        // actually matters. Safe because `uploads` arrived typed as AssetKind.
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

      await tx.rentalEvent.create({
        data: {
          rentalId: rental.id,
          type: "pickup.completed",
          payload: { contractNumber, submissionId } as Prisma.InputJsonValue,
        },
      });

      return {
        contractId: contract.id,
        contractNumber,
        rentalId: rental.id,
      };
    },
    // The default 5 s is tight for eight statements on a cold Neon branch.
    { timeout: 15_000 }
  );
}
```

Note the `"CONTRACT_PDF"` string passed to `assetKey` — it is only part of an object key, not an `AssetKind`, since the PDF is referenced by `Contract.pdfKey` rather than by an `Asset` row.

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm test:db`
Expected: PASS, all `persistPickup` tests.

- [ ] **Step 7: Rewrite the route handler around it**

`app/api/rental-contract/route.ts`'s `POST` becomes, in order: key check → origin → rate limit → parse form → honeypot → file checks → meta validation → collect uploads from the form → `persistPickup` → `sendContractMails` → stamp the outcome.

The wizard must also send the images. Currently only the PDF is posted. In `RentalPickupWizard.tsx`'s `submit`, after `body.append("pdf", pdf, fileName)`, append each image so the handler can store them:

```ts
// The images travel alongside the PDF so they can be stored under their own
// keys. They are already inside the document, but a PDF is not a place to
// look one up from — Phase 4's return wizard compares against these.
for (const slot of DOCUMENT_SLOTS) {
  body.append(`asset:${SLOT_TO_KIND[slot.key]}`, docs[slot.key]!.blob);
}
condition.forEach((photo) => body.append("asset:CONDITION_PHOTO", photo.blob));
body.append(
  "asset:SIGNATURE",
  new Blob([dataUrlToBytes(signature) as unknown as BlobPart], {
    type: "image/png",
  })
);
```

with, near `DOCUMENT_SLOTS`:

```ts
/** Wizard slot to database asset kind. */
const SLOT_TO_KIND: Record<DocumentKey, string> = {
  portrait: "PORTRAIT",
  idFront: "ID_FRONT",
  idBack: "ID_BACK",
  licenceFront: "LICENCE_FRONT",
  licenceBack: "LICENCE_BACK",
};
```

**Watch the body size.** The images now travel twice — once embedded in the PDF and once loose — which roughly doubles the payload against the ~4.5 MB cap. Lower `SOFT_LIMIT` to `2.0 * 1024 * 1024` and `HARD_LIMIT` to `2.2 * 1024 * 1024` so the existing recompress-and-retry path triggers early enough, and raise `MAX_PDF_BYTES` handling in the handler to check the *total* request size rather than the PDF alone. If the manual test in Step 9 hits `too-large` with ordinary phone photos, that is the spec's deferred presigned-upload decision arriving early — stop and raise it rather than degrading image quality further.

Then in the handler:

```ts
  const uploads: PickupUpload[] = [];
  for (const [field, value] of form.entries()) {
    if (!field.startsWith("asset:") || !(value instanceof File)) continue;
    uploads.push({
      kind: field.slice("asset:".length) as AssetKind,
      body: new Uint8Array(await value.arrayBuffer()),
      contentType: value.type || "application/octet-stream",
    });
  }

  const organisation = await prisma.organisation.findFirst({
    select: { id: true },
  });
  if (!organisation) {
    console.error("[rental-contract] no organisation row — run pnpm db:seed");
    return NextResponse.json({ code: "not-configured" }, { status: 503 });
  }

  const pdfBytes = new Uint8Array(await file.arrayBuffer());

  let saved;
  try {
    saved = await persistPickup({
      organisationId: organisation.id,
      details: meta.details,
      vehicleSlug: meta.details.vehicleId,
      uploads,
      pdf: { body: pdfBytes },
      store: getAssetStore(),
    });
  } catch (error) {
    console.error("[rental-contract] could not record the contract:", error);
    // The wizard falls back to the Phase 1 path on this code: download the
    // PDF and mail it by hand. Nothing is lost that the customer is holding.
    return NextResponse.json({ code: "not-recorded" }, { status: 503 });
  }

  // Committed. From here, mail is best-effort.
  const outcome = await sendContractMails(
    { ...meta, contractNumber: saved.contractNumber },
    Buffer.from(pdfBytes)
  );

  await prisma.contract.update({
    where: { id: saved.contractId },
    data:
      outcome.delivered === "none"
        ? { mailError: outcome.error?.slice(0, 500) ?? "unknown" }
        : { mailSentAt: new Date(), mailError: outcome.error?.slice(0, 500) },
  });

  return NextResponse.json({
    delivered: outcome.delivered,
    contractNumber: saved.contractNumber,
  });
```

Replace the file's header comment — "Stateless by design: nothing is written down in Phase 1" is now the opposite of true:

```ts
/**
 * Records a signed pickup contract and emails it.
 *
 * The write is the point: records commit first and mail is sent afterwards, so
 * a mail failure leaves a contract that exists and an email to retry, rather
 * than the Phase 1 failure mode where it existed nowhere. The endpoint is
 * fenced with a shared secret, an origin check, a honeypot, a size cap and a
 * database-backed per-IP limiter.
 */
```

- [ ] **Step 8: Teach the wizard the new outcomes**

`Status`'s `outcome` gains `"stored"` — recorded, but no email went out:

```ts
| { kind: "done"; outcome: "both" | "office" | "stored" | "offline" | "failed" };
```

In `submit`'s response handling:

```ts
if (response.ok) {
  const payload = (await response.json()) as {
    delivered?: "both" | "office" | "none";
  };
  setStatus({
    kind: "done",
    outcome:
      payload.delivered === "both"
        ? "both"
        : payload.delivered === "office"
          ? "office"
          : "stored",
  });
  return;
}
```

and in the error branch, map `not-recorded` and `not-configured` to `"offline"` alongside `mail-not-configured`.

Add the copy to `de.result`:

```ts
    storedTitle: "Vertrag erfasst",
    storedBody:
      "Der Vertrag ist bei ZURIAUTO hinterlegt. Der E-Mail-Versand hat nicht geklappt — bitte laden Sie ihn hier herunter.",
```

and `en.result`:

```ts
    storedTitle: "Contract recorded",
    storedBody:
      "The contract is on file with ZURIAUTO. The email did not go out — please download it here.",
```

Render it in the result panel wherever `outcome === "office"` is handled, as a sibling case.

- [ ] **Step 9: Verify end to end**

Run: `pnpm test:all` — expect every project green.
Run: `pnpm exec tsc --noEmit` — expect zero errors.

Then, with `pnpm dev` and a real SMTP configuration in `.env.local`, submit one contract at `/apply/?k=dev-secret` and check all of it:

```bash
docker compose exec db psql -U zuriauto -d zuriauto -c '
  SELECT c."contractNumber", c."mailSentAt", c."mailError",
         r."type", r."startAt", r."endAt", r."weeklyAmountCents",
         cu."email", ca."plate", ca."status",
         (SELECT count(*) FROM "Asset" a WHERE a."contractId" = c.id) AS assets
  FROM "Contract" c
  JOIN "Rental" r ON r.id = c."rentalId"
  JOIN "Customer" cu ON cu.id = r."customerId"
  JOIN "Car" ca ON ca.id = r."carId";'
```

Expect: one row, `mailSentAt` set, `mailError` null, six assets, the car `rented`, the email lowercased, and `endAt` matching what the wizard displayed.

Compare the emailed PDF against one produced before Task 6 and confirm the only difference is the terms block.

- [ ] **Step 10: Commit**

```bash
git add lib/rental/persistPickup.ts lib/rental/mail.ts tests/db/persistPickup.test.ts app/api/rental-contract/route.ts components/rental/RentalPickupWizard.tsx lib/rental/labels.ts lib/rental/schema.ts
git commit -m "feat(rental): record every pickup contract in the database"
```

---

## Task 14: The radar-ticket lookup

The spec's standalone payoff. One index and one query — *who was driving `ZH 589 864` at 14:30 on the 10th*.

**Files:**
- Create: `lib/rental/lookup.ts`, `tests/db/lookup.test.ts`

**Interfaces:**
- Consumes: `prisma`.
- Produces: `driverAt(client, organisationId, plate, at): Promise<{ firstName; lastName; email; phone; street; postalCode; city; country; contractNumber; rentalId } | null>`

- [ ] **Step 1: Write the failing test**

Create `tests/db/lookup.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { ensureOrganisation, seedFleet } from "@/prisma/seed";
import { driverAt } from "@/lib/rental/lookup";

const PLATE = "ZH 589 864";

async function aRental(opts: {
  organisationId: string;
  email: string;
  lastName: string;
  startAt: string;
  endAt: string;
}) {
  const car = await prisma.car.findFirstOrThrow({ where: { plate: PLATE } });
  const customer = await prisma.customer.create({
    data: {
      organisationId: opts.organisationId,
      firstName: "Anna",
      lastName: opts.lastName,
      email: opts.email,
      phone: "+41791234567",
      birthDate: new Date("1990-04-12T00:00:00.000Z"),
      street: "Bahnhofstrasse 1",
      postalCode: "8001",
      city: "Zürich",
      country: "Switzerland",
    },
  });
  const rental = await prisma.rental.create({
    data: {
      organisationId: opts.organisationId,
      carId: car.id,
      customerId: customer.id,
      createdBy: "office",
      type: "FIXED_TERM",
      startAt: new Date(opts.startAt),
      endAt: new Date(opts.endAt),
      totalAmountCents: 60_000,
    },
  });
  await prisma.contract.create({
    data: {
      organisationId: opts.organisationId,
      rentalId: rental.id,
      contractNumber: `ZA-20260801-${opts.lastName.length}001`,
      createdBy: "office",
      kind: "PICKUP",
      mileageKm: 1,
      fuelLevel: "full",
      gtcVersion: "2026-07-31",
      gtcLanguage: "de",
      acceptedAt: new Date(opts.startAt),
    },
  });
  return rental;
}

async function ready() {
  const org = await ensureOrganisation(prisma);
  await seedFleet(prisma, org.id);
  return org.id;
}

describe("driverAt", () => {
  it("names the driver for a moment inside a rental", async () => {
    const organisationId = await ready();
    await aRental({
      organisationId,
      email: "anna@example.ch",
      lastName: "Meier",
      startAt: "2026-08-08T10:00:00.000Z",
      endAt: "2026-08-12T10:00:00.000Z",
    });

    const found = await driverAt(
      prisma,
      organisationId,
      PLATE,
      new Date("2026-08-10T14:30:00.000Z")
    );
    expect(found?.lastName).toBe("Meier");
    expect(found?.street).toBe("Bahnhofstrasse 1");
  });

  it("names nobody for a moment in the gap between rentals", async () => {
    const organisationId = await ready();
    await aRental({
      organisationId,
      email: "a@example.ch",
      lastName: "Meier",
      startAt: "2026-08-01T10:00:00.000Z",
      endAt: "2026-08-05T10:00:00.000Z",
    });
    await aRental({
      organisationId,
      email: "b@example.ch",
      lastName: "Weber",
      startAt: "2026-08-12T10:00:00.000Z",
      endAt: "2026-08-18T10:00:00.000Z",
    });

    const found = await driverAt(
      prisma,
      organisationId,
      PLATE,
      new Date("2026-08-08T14:30:00.000Z")
    );
    expect(found).toBeNull();
  });

  it("picks the right one of two consecutive rentals", async () => {
    const organisationId = await ready();
    await aRental({
      organisationId,
      email: "a@example.ch",
      lastName: "Meier",
      startAt: "2026-08-01T10:00:00.000Z",
      endAt: "2026-08-08T10:00:00.000Z",
    });
    await aRental({
      organisationId,
      email: "b@example.ch",
      lastName: "Weber",
      startAt: "2026-08-08T10:00:00.000Z",
      endAt: "2026-08-15T10:00:00.000Z",
    });

    const found = await driverAt(
      prisma,
      organisationId,
      PLATE,
      new Date("2026-08-10T09:00:00.000Z")
    );
    expect(found?.lastName).toBe("Weber");
  });

  it("names nobody for an unknown plate", async () => {
    const organisationId = await ready();
    const found = await driverAt(
      prisma,
      organisationId,
      "ZH 000 000",
      new Date("2026-08-10T14:30:00.000Z")
    );
    expect(found).toBeNull();
  });

  it("ignores a cancelled rental", async () => {
    const organisationId = await ready();
    const rental = await aRental({
      organisationId,
      email: "a@example.ch",
      lastName: "Meier",
      startAt: "2026-08-08T10:00:00.000Z",
      endAt: "2026-08-12T10:00:00.000Z",
    });
    await prisma.rental.update({
      where: { id: rental.id },
      data: { status: "CANCELLED" },
    });

    const found = await driverAt(
      prisma,
      organisationId,
      PLATE,
      new Date("2026-08-10T14:30:00.000Z")
    );
    expect(found).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test:db`
Expected: FAIL — cannot resolve `@/lib/rental/lookup`.

- [ ] **Step 3: Implement**

Create `lib/rental/lookup.ts`:

```ts
/**
 * Who was driving this car at this moment.
 *
 * The office's most frequent question, and until now unanswerable without
 * reading a mailbox: a radar ticket arrives naming a plate and a timestamp,
 * and the fine has to be attributed within a deadline. Served by the
 * `[carId, startAt, endAt]` index, so it stays one query however many rentals
 * accumulate.
 */

import type { PrismaClient } from "@prisma/client";

export interface DriverRecord {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  contractNumber: string | null;
  rentalId: string;
}

export async function driverAt(
  client: PrismaClient,
  organisationId: string,
  plate: string,
  at: Date
): Promise<DriverRecord | null> {
  const rental = await client.rental.findFirst({
    where: {
      organisationId,
      car: { plate },
      // Half-open interval: the moment a rental ends belongs to the next one.
      // Two consecutive rentals of the same car share a boundary instant, and
      // attributing a fine to the wrong driver on a handover day is exactly
      // the mistake this query exists to prevent.
      startAt: { lte: at },
      endAt: { gt: at },
      status: { not: "CANCELLED" },
    },
    orderBy: { startAt: "desc" },
    select: {
      id: true,
      customer: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          street: true,
          postalCode: true,
          city: true,
          country: true,
        },
      },
      contracts: {
        where: { kind: "PICKUP" },
        select: { contractNumber: true },
        take: 1,
      },
    },
  });

  if (!rental) return null;

  return {
    ...rental.customer,
    contractNumber: rental.contracts[0]?.contractNumber ?? null,
    rentalId: rental.id,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test:db`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/rental/lookup.ts tests/db/lookup.test.ts
git commit -m "feat(rental): answer who was driving a plate at a given moment"
```

---

## Task 15: Data protection — retention, region and the privacy page

The spec is explicit that this is cheap now and expensive to retrofit. It is not optional and it is not "documentation" — it is the condition on which storing ID scans is lawful.

**Files:**
- Create: `docs/DATA-RETENTION.md`
- Modify: `app/privacy/page.tsx` (find its real path first — `find app -ipath '*privacy*'`), `docs/RENTAL-CONTRACT-SETUP.md`

- [ ] **Step 1: Confirm the regions**

This is a deploy-time check, not code. Record the answers in `docs/DATA-RETENTION.md`:

- Neon project region — must be an EU one (`eu-central-1` Frankfurt is the usual choice). Check in the Neon console; a project created in a US region cannot be moved and must be recreated before any production data exists.
- R2 bucket jurisdiction — created with `--jurisdiction eu`. Verify with `wrangler r2 bucket list`.

If either is wrong, fix it **before** the first production submission. After that it is a data migration with a notification obligation attached.

- [ ] **Step 2: Write the retention note**

Create `docs/DATA-RETENTION.md`:

```markdown
# What is kept, where, and for how long

Phase 2 changed the obligation. Until now identity documents were emailed and
no server-side copy was kept — the route handler documented that deliberately.
They are now stored, which brings this under the revised Swiss DSG and, for EU
tourists, under GDPR.

## What is stored

| Data | Where | Why |
|---|---|---|
| Name, address, birth date, phone, email | Postgres (Neon, EU) | Party to a signed contract |
| ID / passport photographs, front and back | R2 (EU jurisdiction) | Identity verification at handover |
| Driving licence photographs, front and back | R2 (EU jurisdiction) | Legal requirement to verify entitlement to drive |
| Portrait photograph | R2 (EU jurisdiction) | Matching the person to the document |
| Signature image | R2 (EU jurisdiction) | Evidence of acceptance |
| Vehicle condition photographs | R2 (EU jurisdiction) | Condition at handover, compared on return |
| Contract PDF | R2 (EU jurisdiction) | The document itself |
| Hashed client IP | Postgres | Abuse limiting; deleted after 10 minutes |

Raw IP addresses are never written. Payment card details are never handled —
payment is a hosted link.

## Retention

**OPEN — requires the owner's sign-off. Do not deploy to production without a
number here.** The spec lists this as open question 1 and the roadmap repeats
it. Recommended starting position, to be confirmed:

- Identity and licence images: delete 90 days after the rental ends. They
  serve verification at handover and any dispute that follows immediately; they
  are not needed for the ten-year retention that applies to the contract
  itself.
- Contract PDF and rental records: ten years, matching the Swiss commercial
  record-keeping obligation under OR 958f.
- Condition photographs: two years, long enough for a damage claim.

No deletion job exists yet — it belongs with the Phase 3 scheduler, which is
the first thing in this system that runs on a timer. Until then, deletion is
manual and the retention clock is documented rather than enforced. **This is a
known gap, and it is the reason a retention period must be agreed now rather
than after the first hundred contracts.**

## Deletion on request

A renter may ask for their data. Until the Phase 5 dashboard exists this is a
manual procedure:

1. Find the customer: `SELECT * FROM "Customer" WHERE email = '...';`
2. Find their assets: join `Rental` → `Contract` → `Asset` and collect
   `storageKey`.
3. Delete those objects from R2.
4. Redact the `Customer` row.

The contract itself is not deleted — a signed rental agreement is a commercial
record with its own retention obligation, which overrides an erasure request
for its duration. Say so when answering the request.
```

- [ ] **Step 3: Update the privacy page**

Find it: `find app -ipath '*privacy*'`. Read the existing page and extend it in the same voice and both languages, covering: what is now stored, that it is held in the EU, how long it is kept (the agreed number from Step 2, not "as long as necessary"), and how to ask for deletion.

Do not paste the retention table above into a customer-facing page. It is an internal document; the privacy page needs plain sentences.

- [ ] **Step 4: Update the setup doc**

In `docs/RENTAL-CONTRACT-SETUP.md`, add a Phase 2 section covering: `docker compose up -d db`, `pnpm db:migrate`, `pnpm db:seed`, the four new environment groups (`DATABASE_URL`, `APPLY_SECRET`, `RATE_LIMIT_SALT`, the R2 keys), how the office gets its `/apply/?k=...` link, and how to take a car out of service with one SQL statement.

- [ ] **Step 5: Commit**

```bash
git add docs/DATA-RETENTION.md docs/RENTAL-CONTRACT-SETUP.md app
git commit -m "docs: record what Phase 2 retains, where, and for how long"
```

---

## Done when

Straight from the spec, each one checkable:

- [ ] A submitted pickup contract produces `Customer`, `Rental`, `Contract` and `Asset` rows, and the email arrives exactly as it does today. — Task 13, Step 9.
- [ ] Restarting the server does not reset the rate limiter. — Task 9; verify by hand: submit twice, restart `pnpm dev`, confirm the count in `SubmissionAttempt` has not dropped.
- [ ] Given a plate and a timestamp, one SQL query names the driver. — Task 14.
- [ ] The car picker reads from the database, and taking a car out of service needs no deploy. — Task 11, Step 8.
- [ ] Neon and the object store are both in an EU or Swiss region, and `/privacy` describes what is now retained and for how long. — Task 15.
- [ ] `pnpm test:all` is green and `pnpm exec tsc --noEmit` reports zero errors.

## Still open after this plan

These are the spec's and the roadmap's open questions that Phase 2 does not close, restated so they are not lost:

1. **Retention period for identity documents, and who signs it off.** Blocks production deployment (Task 15).
2. **Does the existing SumUp link already offer TWINT?** Decides whether Phase 3 ships a working payment path or a manual one. Nothing in Phase 2 depends on the answer.
3. **Vercel plan tier**, which decides the cron trigger for Phase 3.
4. **Deposit handling.** Recorded here as `depositCents`; whether it is ever collected through the system is Phase 4's decision.
5. **Backfilling `MAIL_ARCHIVE`.** Recommended: no. Those contracts have no rental terms, and inventing them would put fiction in the system of record.
6. **Presigned direct-to-storage upload.** Deferred by the spec until the 4.5 MB cap bites — Task 13, Step 7 notes it may bite sooner than expected now that images travel twice.
