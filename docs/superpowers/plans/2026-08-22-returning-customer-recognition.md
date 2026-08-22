# Returning-Customer Recognition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the pickup desk find an existing renter by phone number, prefill their details, and carry their identity documents forward from their last rental without the images ever reaching the browser.

**Architecture:** A normalised `Customer.phoneKey` makes the lookup one indexed query. A fenced `POST /api/customers/lookup` returns prefillable fields plus a 30-minute HMAC token naming the contract whose documents may be reused — never image bytes and never a contract id. On submit, the server verifies that token and asks R2 to copy each object server-side into the new contract's prefix, so every contract still owns its own files on its own retention clock. The PDF gets a reference page in place of the five document pages.

**Tech Stack:** Next.js 15.5 App Router, Prisma 7.9 (`prisma-client` generator → `generated/prisma`), PostgreSQL 18, Cloudflare R2 via `@aws-sdk/client-s3`, Zod v4, Vitest (`unit` + `db` projects), pdf-lib.

**Spec:** `docs/superpowers/specs/2026-08-22-returning-customer-recognition-design.md`

## Global Constraints

- **Every route file** declares `export const runtime = "nodejs"`. Prisma needs Node APIs; the Edge runtime cannot run it.
- **`trailingSlash: true`** is set in `next.config.ts`. Fetch `/api/customers/lookup/` with the slash — the unslashed path 308-redirects and a POST redirect loses its body.
- **Unit tests** live beside the code as `lib/**/*.test.ts` and must need no services. **DB tests** live in `tests/db/**/*.test.ts` and need `pnpm db:up` first.
- **`fileParallelism: false`** — DB suites share one database and truncate between tests. Never add a test that assumes parallel isolation.
- **Retention periods, verbatim:** five years for everything about the person; ten years for the contract PDF (OR 958f).
- **Reusable asset kinds, verbatim:** `PORTRAIT`, `ID_FRONT`, `ID_BACK`, `LICENCE_FRONT`, `LICENCE_BACK`. Never `SIGNATURE`, never `CONDITION_PHOTO`.
- **Reuse token TTL:** 30 minutes. **Lookup match cap:** 5.
- **PDF languages:** `de` and `en` only. `RENTAL_LABELS` has exactly those two keys.
- **Never log or return a phone number.** The audit table stores a salted hash, using `hashIp`'s construction from `lib/rental/rateLimit.ts`.
- **Commit after every task.** Conventional-commit prefixes (`feat:`, `test:`, `docs:`), and end each message with the `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>` trailer.

---

### Task 1: Phone normalisation

**Files:**
- Create: `lib/rental/phone.ts`
- Test: `lib/rental/phone.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `normalisePhone(input: string): string | null`

- [ ] **Step 1: Write the failing test**

Create `lib/rental/phone.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { normalisePhone } from "./phone";

describe("normalisePhone", () => {
  it("reads the four ways an office types one Swiss mobile", () => {
    // The point of the function: these are one customer, not four.
    for (const written of [
      "079 123 45 67",
      "+41 79 123 45 67",
      "0041791234567",
      "+41791234567",
    ]) {
      expect(normalisePhone(written)).toBe("+41791234567");
    }
  });

  it("strips the punctuation people write numbers with", () => {
    expect(normalisePhone("079/123.45.67")).toBe("+41791234567");
    expect(normalisePhone(" (079) 123-45-67 ")).toBe("+41791234567");
  });

  it("keeps a foreign number on its own country code", () => {
    expect(normalisePhone("+49 151 23456789")).toBe("+4915123456789");
    expect(normalisePhone("0049 151 23456789")).toBe("+4915123456789");
  });

  it("refuses a bare number rather than guessing a country", () => {
    // 791234567 is probably Swiss without the trunk zero, and 41791234567 is
    // probably +41 without the plus — but guessing wrong builds a key that
    // matches the wrong person, and the cost of refusing is that the staff
    // member types the details.
    expect(normalisePhone("791234567")).toBeNull();
    expect(normalisePhone("41791234567")).toBeNull();
  });

  it("returns null for anything that cannot be a number", () => {
    expect(normalisePhone("")).toBeNull();
    expect(normalisePhone("   ")).toBeNull();
    expect(normalisePhone("ask at the desk")).toBeNull();
    expect(normalisePhone("+")).toBeNull();
  });

  it("rejects lengths outside E.164 rather than storing a typo as a key", () => {
    expect(normalisePhone("+41 79")).toBeNull();
    expect(normalisePhone("+4179123456789012")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- phone`
Expected: FAIL — `Failed to resolve import "./phone"`

- [ ] **Step 3: Write the implementation**

Create `lib/rental/phone.ts`:

```ts
/**
 * The phone number as stored for the desk lookup.
 *
 * One mobile reaches the database spelled four ways — `079 123 45 67`,
 * `+41 79 123 45 67`, `0041791234567`, `+41791234567` — and a lookup that
 * compares what was typed finds a returning customer only when the office
 * happens to type it the same way twice. This is the single spelling, in the
 * spirit of `normaliseEmail` in customers.ts.
 *
 * Hand-rolled rather than libphonenumber-js: 150 KB of parser to serve an
 * office typing Swiss numbers and the occasional German one, where a miss
 * degrades to typing the details by hand. If foreign numbers become common,
 * that is the upgrade.
 *
 * IMPORTANT: this function's output must stay stable for the life of the
 * `Customer.phoneKey` column. Change the rules and every key already written
 * silently stops matching — no error, just returning customers who are never
 * found again. Adding a country prefix is safe; changing how an existing input
 * maps is not, and needs a re-run of `pnpm db:backfill-phone-keys`.
 */

const SWISS_COUNTRY_CODE = "+41";

/** E.164 allows fifteen digits after the plus, and no real number is under eight. */
const MIN_DIGITS = 8;
const MAX_DIGITS = 15;

export function normalisePhone(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const explicitCountryCode = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  let e164: string;
  if (explicitCountryCode) {
    e164 = `+${digits}`;
  } else if (digits.startsWith("00")) {
    // The international access code, which is what `+` replaced.
    e164 = `+${digits.slice(2)}`;
  } else if (digits.startsWith("0")) {
    // National format. The trunk zero is a dialling instruction, not part of
    // the number, so it goes rather than being kept after the country code.
    e164 = `${SWISS_COUNTRY_CODE}${digits.slice(1)}`;
  } else {
    // No plus, no 00, no trunk zero: nothing says which country this is.
    // Refused deliberately — see the note on guessing in the test.
    return null;
  }

  const length = e164.length - 1;
  if (length < MIN_DIGITS || length > MAX_DIGITS) return null;

  return e164;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- phone`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/rental/phone.ts lib/rental/phone.test.ts
git commit -m "feat: normalise a phone number to one spelling for lookup"
```

---

### Task 2: The reuse token

**Files:**
- Create: `lib/rental/reuseToken.ts`
- Test: `lib/rental/reuseToken.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `REUSE_TOKEN_TTL_MS: number`, `issueReuseToken(contractId: string, now?: Date): string`, `readReuseToken(token: string, now?: Date): string | null`

- [ ] **Step 1: Write the failing test**

Create `lib/rental/reuseToken.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import {
  REUSE_TOKEN_TTL_MS,
  issueReuseToken,
  readReuseToken,
} from "./reuseToken";

const NOW = new Date("2026-08-22T10:00:00.000Z");

describe("reuse token", () => {
  beforeEach(() => {
    process.env.APPLY_SECRET = "test-secret-for-signing";
  });

  it("round-trips the contract id it was issued for", () => {
    const token = issueReuseToken("ckcontract123", NOW);
    expect(readReuseToken(token, NOW)).toBe("ckcontract123");
  });

  it("is still valid one minute before it expires", () => {
    const token = issueReuseToken("ckcontract123", NOW);
    const almost = new Date(NOW.getTime() + REUSE_TOKEN_TTL_MS - 60_000);
    expect(readReuseToken(token, almost)).toBe("ckcontract123");
  });

  it("refuses an expired token", () => {
    const token = issueReuseToken("ckcontract123", NOW);
    const after = new Date(NOW.getTime() + REUSE_TOKEN_TTL_MS + 1);
    expect(readReuseToken(token, after)).toBeNull();
  });

  it("refuses a tampered signature", () => {
    const token = issueReuseToken("ckcontract123", NOW);
    const [payload] = token.split(".");
    expect(readReuseToken(`${payload}.forged`, NOW)).toBeNull();
  });

  it("refuses a re-pointed payload", () => {
    // The whole point: a caller must not be able to name a different contract
    // and have its documents copied onto their own.
    const mine = issueReuseToken("ckcontract123", NOW);
    const [, signature] = mine.split(".");
    const theirs = Buffer.from(`ckSOMEONEELSE.${NOW.getTime() + 60_000}`)
      .toString("base64url");
    expect(readReuseToken(`${theirs}.${signature}`, NOW)).toBeNull();
  });

  it("refuses a token signed with a different secret", () => {
    const token = issueReuseToken("ckcontract123", NOW);
    process.env.APPLY_SECRET = "a-rotated-secret";
    expect(readReuseToken(token, NOW)).toBeNull();
  });

  it("refuses malformed input without throwing", () => {
    for (const bad of ["", ".", "no-dot", "a.b.c", "!!!.???"]) {
      expect(readReuseToken(bad, NOW)).toBeNull();
    }
  });

  it("refuses to issue without a configured secret", () => {
    delete process.env.APPLY_SECRET;
    expect(() => issueReuseToken("ckcontract123", NOW)).toThrow(/APPLY_SECRET/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- reuseToken`
Expected: FAIL — `Failed to resolve import "./reuseToken"`

- [ ] **Step 3: Write the implementation**

Create `lib/rental/reuseToken.ts`:

```ts
/**
 * Permission to copy one contract's identity documents onto a new one.
 *
 * Issued only by a successful lookup, so holding it proves the caller has
 * already legitimately read that the customer exists. It exists so the submit
 * path never has to trust a client-supplied contract id — the obvious
 * alternative, matching the submitted email against the stored one, refuses the
 * reuse precisely when a returning customer has changed their email, which is a
 * normal thing to have done.
 *
 * Deliberately NOT an ActionToken row. That is mailed to a customer and must be
 * single-use and revocable, properties that need a row. This lives for half an
 * hour inside one staff session, authorises nothing its holder has not already
 * read, and needs no revocation — so a row would buy a write and a cleanup
 * obligation and nothing else.
 *
 * Keyed with APPLY_SECRET, which is already the office credential for this
 * flow: rotating it invalidates outstanding tokens, which is the correct
 * behaviour and is why the "different secret" case is tested.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

/** Long enough for a handover, short enough that a copied URL goes stale. */
export const REUSE_TOKEN_TTL_MS = 30 * 60 * 1000;

function sign(payload: string): string {
  const secret = process.env.APPLY_SECRET;
  // Fail closed, as applyKeyValid does: an unconfigured secret is a
  // misconfiguration, not permission to skip signing.
  if (!secret) throw new Error("APPLY_SECRET is not set.");
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function constantTimeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  // timingSafeEqual throws on a length mismatch, which would itself leak the
  // length, so the comparison is guarded rather than short-circuited on it.
  if (left.length !== right.length) {
    timingSafeEqual(right, right);
    return false;
  }
  return timingSafeEqual(left, right);
}

export function issueReuseToken(contractId: string, now: Date = new Date()): string {
  const payload = `${contractId}.${now.getTime() + REUSE_TOKEN_TTL_MS}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`;
}

/** The contract id the token authorises, or null for any reason it does not. */
export function readReuseToken(
  token: string,
  now: Date = new Date()
): string | null {
  const parts = token.split(".");
  // base64url contains no dot, so a well-formed token has exactly two parts.
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts;
  if (!encoded || !signature) return null;

  const payload = Buffer.from(encoded, "base64url").toString("utf8");

  // Verified before anything is parsed out of it, so a forged payload never
  // reaches the parser.
  let expected: string;
  try {
    expected = sign(payload);
  } catch {
    return null;
  }
  if (!constantTimeEqual(signature, expected)) return null;

  const separator = payload.lastIndexOf(".");
  if (separator <= 0) return null;

  const contractId = payload.slice(0, separator);
  const expiresAt = Number(payload.slice(separator + 1));
  if (!contractId || !Number.isFinite(expiresAt)) return null;
  if (expiresAt <= now.getTime()) return null;

  return contractId;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- reuseToken`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/rental/reuseToken.ts lib/rental/reuseToken.test.ts
git commit -m "feat: sign short-lived permission to reuse a contract's documents"
```

---

### Task 3: Schema, backfill and the audit table

**Files:**
- Modify: `prisma/schema.prisma` (models `Customer` ~99-119, `Contract` ~170-200; append `CustomerLookup`)
- Modify: `lib/rental/customers.ts:30-57`
- Modify: `tests/db/setup.ts:13-18`
- Create: `scripts/backfill-phone-keys.ts`
- Modify: `package.json` (scripts)
- Test: `tests/db/phoneKey.test.ts`

**Interfaces:**
- Consumes: `normalisePhone` (Task 1).
- Produces: `Customer.phoneKey`, `Contract.documentsReusedFromId`, `Contract.identityCheckedAt`, model `CustomerLookup`, `backfillPhoneKeys(client): Promise<number>`

- [ ] **Step 1: Write the failing test**

Create `tests/db/phoneKey.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { upsertCustomer } from "@/lib/rental/customers";
import type { ContractDetails } from "@/lib/rental/schema";
import { backfillPhoneKeys } from "@/scripts/backfill-phone-keys";
import { ensureOrganisation } from "@/prisma/seed";

const details = {
  firstName: "Anna",
  lastName: "Meier",
  birthDate: "1990-04-12",
  street: "Bahnhofstrasse 1",
  postalCode: "8001",
  city: "Zürich",
  country: "Switzerland",
  mobile: "079 123 45 67",
  email: "anna@example.ch",
} as unknown as ContractDetails;

describe("phoneKey", () => {
  it("is written normalised when a customer is upserted", async () => {
    const org = await ensureOrganisation(prisma);
    await upsertCustomer(prisma, org.id, details);

    const customer = await prisma.customer.findFirstOrThrow();
    // Stored as typed, keyed as normalised — both, because the contract has to
    // print what the customer gave and the lookup has to match across spellings.
    expect(customer.phone).toBe("079 123 45 67");
    expect(customer.phoneKey).toBe("+41791234567");
  });

  it("finds one customer however the returning number is typed", async () => {
    const org = await ensureOrganisation(prisma);
    await upsertCustomer(prisma, org.id, details);

    const found = await prisma.customer.findMany({
      where: { organisationId: org.id, phoneKey: "+41791234567" },
    });
    expect(found).toHaveLength(1);
  });

  it("allows two customers to share one number", async () => {
    // A couple renting on one mobile. The lookup returns both and the staff
    // member picks; a unique constraint here would make that state impossible
    // to record at all.
    const org = await ensureOrganisation(prisma);
    await upsertCustomer(prisma, org.id, details);
    await upsertCustomer(prisma, org.id, {
      ...details,
      firstName: "Peter",
      email: "peter@example.ch",
    } as ContractDetails);

    const found = await prisma.customer.findMany({
      where: { organisationId: org.id, phoneKey: "+41791234567" },
    });
    expect(found).toHaveLength(2);
  });

  it("leaves the key null when the number cannot be normalised", async () => {
    const org = await ensureOrganisation(prisma);
    await upsertCustomer(prisma, org.id, {
      ...details,
      mobile: "ask at the desk",
    } as ContractDetails);

    const customer = await prisma.customer.findFirstOrThrow();
    expect(customer.phoneKey).toBeNull();
  });

  it("backfills rows written before the column existed", async () => {
    const org = await ensureOrganisation(prisma);
    // Simulates a pre-migration row: phone present, key absent.
    await prisma.customer.create({
      data: {
        organisationId: org.id,
        firstName: "Old",
        lastName: "Record",
        email: "old@example.ch",
        phone: "+41 79 999 88 77",
        birthDate: new Date("1980-01-01T00:00:00.000Z"),
        street: "Alte Gasse 2",
        postalCode: "8000",
        city: "Zürich",
        country: "Switzerland",
      },
    });

    expect(await backfillPhoneKeys(prisma)).toBe(1);
    const customer = await prisma.customer.findFirstOrThrow();
    expect(customer.phoneKey).toBe("+41799998877");

    // Idempotent: a second run has nothing left to do.
    expect(await backfillPhoneKeys(prisma)).toBe(0);
  });

  it("records a lookup as a hash, never as a number", async () => {
    await prisma.customerLookup.create({
      data: { phoneHash: "deadbeef", matches: 2 },
    });
    const row = await prisma.customerLookup.findFirstOrThrow();
    expect(row.matches).toBe(2);
    expect(row.phoneHash).toBe("deadbeef");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm db:up && pnpm test:db -- phoneKey`
Expected: FAIL — `phoneKey` does not exist on the Customer model.

- [ ] **Step 3: Add the schema changes**

In `prisma/schema.prisma`, inside `model Customer`, after the `phone` field:

```prisma
  /// E.164, written by normalisePhone(). The desk lookup's key.
  ///
  /// Deliberately not unique: one mobile can belong to a couple, and a UNIQUE
  /// migration is one that can fail on data already in the table. A lookup
  /// returns several matches and the staff member picks.
  ///
  /// Nullable because the backfill script populates it, not the migration —
  /// the normaliser is TypeScript and reimplementing it as SQL regex would give
  /// it two implementations that drift. Null also means "this number could not
  /// be normalised", which is a real state and correctly unfindable.
  phoneKey       String?
```

and add the index alongside the existing `@@unique`:

```prisma
  @@unique([organisationId, email])
  @@index([organisationId, phoneKey])
```

In `model Contract`, after `pdfKey`:

```prisma
  /// Set when identity documents were carried forward from an earlier contract
  /// instead of photographed at this handover.
  documentsReusedFromId String?
  /// When the staff member confirmed they had seen the original ID and licence.
  /// Required whenever documentsReusedFromId is set; null on a first rental,
  /// where the fresh photograph is itself the evidence someone looked.
  identityCheckedAt     DateTime?
```

and, with the other relations:

```prisma
  documentsReusedFrom Contract?  @relation("DocumentReuse", fields: [documentsReusedFromId], references: [id])
  documentsReusedBy   Contract[] @relation("DocumentReuse")
```

Append the audit model after `model SubmissionAttempt`:

```prisma
/// One row per desk lookup, so "who looked up whom" is answerable without the
/// audit log becoming a second copy of the customer list. The number is salted
/// and hashed exactly as an IP is in lib/rental/rateLimit.ts.
model CustomerLookup {
  id        String   @id @default(cuid())
  phoneHash String
  matches   Int
  createdAt DateTime @default(now())

  @@index([createdAt])
}
```

- [ ] **Step 4: Run the migration**

```bash
pnpm db:migrate --name returning_customer_recognition
```

Expected: a new directory under `prisma/migrations/`, and `generated/prisma` regenerated.

- [ ] **Step 5: Write `phoneKey` on upsert**

In `lib/rental/customers.ts`, add the import:

```ts
import { normalisePhone } from "./phone";
```

and inside `upsertCustomer`, extend `shared`:

```ts
  const shared = {
    firstName: details.firstName,
    lastName: details.lastName,
    phone: details.mobile,
    // Both, on purpose: `phone` is what the customer gave and what the contract
    // prints; `phoneKey` is the single spelling the desk lookup matches on.
    phoneKey: normalisePhone(details.mobile),
```

leaving the rest of the object unchanged.

- [ ] **Step 6: Add `CustomerLookup` to the test reset**

In `tests/db/setup.ts`, extend the TRUNCATE list. It has no foreign key, so `CASCADE` from another table will not reach it and it must be named explicitly:

```ts
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "Asset", "RentalEvent", "Contract", "Rental",
      "Customer", "Car", "ContractCounter", "SubmissionAttempt",
      "CustomerLookup", "Organisation"
    RESTART IDENTITY CASCADE
  `);
```

- [ ] **Step 7: Write the backfill script**

Create `scripts/backfill-phone-keys.ts`, following `scripts/backfill-charges.ts`:

```ts
/**
 * Fills Customer.phoneKey for rows written before the column existed.
 *
 * A script and not a migration because the normaliser is TypeScript:
 * reimplementing it as SQL regex would give one rule two implementations, and
 * they would drift the first time a country prefix was added. Running the real
 * function is the whole point.
 *
 * Dry by default. Pass --commit to write.
 *
 *   pnpm db:backfill-phone-keys
 *   pnpm db:backfill-phone-keys -- --commit
 */

import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { normalisePhone } from "../lib/rental/phone";

type Client = Pick<PrismaClient, "customer">;

/**
 * Returns how many rows were given a key. Exported so a test can drive it
 * against the test database rather than shelling out.
 */
export async function backfillPhoneKeys(
  client: Client,
  commit = true
): Promise<number> {
  const customers = await client.customer.findMany({
    where: { phoneKey: null },
    select: { id: true, phone: true },
  });

  let written = 0;
  for (const customer of customers) {
    const phoneKey = normalisePhone(customer.phone);
    // An unnormalisable number stays null. That row is simply not findable by
    // phone, which is the correct outcome and not an error.
    if (!phoneKey) continue;
    if (commit) {
      await client.customer.update({
        where: { id: customer.id },
        data: { phoneKey },
      });
    }
    written += 1;
  }
  return written;
}

async function main() {
  config({ path: ".env.local" });

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set.");

  const commit = process.argv.includes("--commit");
  const client = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    const pending = await client.customer.count({ where: { phoneKey: null } });
    const written = await backfillPhoneKeys(client, commit);

    console.log(
      `[backfill] ${pending} customer(s) without a phone key; ` +
        `${written} normalised, ${pending - written} unnormalisable` +
        `${commit ? "" : " (dry run)"}`
    );
    if (!commit) {
      console.log("[backfill] nothing written. Re-run with -- --commit to apply.");
    }
  } finally {
    await client.$disconnect();
  }
}

// Only when run directly, so importing this from a test does not start a job.
if (process.argv[1]?.includes("backfill-phone-keys")) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
```

- [ ] **Step 8: Register the script**

In `package.json`, beside `db:backfill-charges`:

```json
    "db:backfill-phone-keys": "tsx scripts/backfill-phone-keys.ts",
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `pnpm test:db -- phoneKey`
Expected: PASS, 6 tests.

Then confirm nothing else broke: `pnpm test:db`
Expected: PASS, all suites.

- [ ] **Step 10: Commit**

```bash
git add prisma/schema.prisma prisma/migrations lib/rental/customers.ts \
  tests/db/setup.ts tests/db/phoneKey.test.ts \
  scripts/backfill-phone-keys.ts package.json
git commit -m "feat: key customers by normalised phone number"
```

---

### Task 4: Server-side copy in the asset store

**Files:**
- Modify: `lib/storage/types.ts:10-12`
- Modify: `lib/storage/r2.ts:1`, `:59-70`
- Modify: `lib/storage/memory.ts:13-21`
- Test: `lib/storage/r2.test.ts` (append), `lib/storage/memory.test.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: `AssetStore.copy(fromKey: string, toKey: string, contentType: string): Promise<void>`, `copySource(bucket: string, key: string): string`

- [ ] **Step 1: Write the failing tests**

Append to `lib/storage/r2.test.ts`:

```ts
import { copySource } from "./r2";

describe("copySource", () => {
  it("joins the bucket and key the way CopyObject expects", () => {
    expect(copySource("zuriauto-assets", "pickup/abc/ID_FRONT-1234.jpg")).toBe(
      "zuriauto-assets/pickup/abc/ID_FRONT-1234.jpg"
    );
  });

  it("keeps the slashes that separate path segments", () => {
    // Encoding the whole string would turn the separators into %2F and address
    // one object whose name contains slashes, which does not exist.
    expect(copySource("b", "a/b/c.jpg")).toBe("b/a/b/c.jpg");
  });

  it("encodes a reserved character inside a segment", () => {
    expect(copySource("b", "pickup/a b/c+d.jpg")).toBe("b/pickup/a%20b/c%2Bd.jpg");
  });
});
```

Create `lib/storage/memory.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createMemoryStore } from "./memory";

describe("memory store copy", () => {
  it("copies an object to a new key, leaving the source in place", async () => {
    const store = createMemoryStore();
    await store.put("from.jpg", new Uint8Array([1, 2, 3]), "image/jpeg");
    await store.copy("from.jpg", "to.jpg", "image/jpeg");

    expect(store.objects.size).toBe(2);
    expect(store.objects.get("to.jpg")?.body).toEqual(new Uint8Array([1, 2, 3]));
    // The source contract keeps its own files; nothing is moved.
    expect(store.objects.get("from.jpg")).toBeDefined();
  });

  it("throws when the source is missing", async () => {
    const store = createMemoryStore();
    // Loud rather than silent: a missing source means a contract would be
    // written claiming documents that are not there.
    await expect(store.copy("nope.jpg", "to.jpg", "image/jpeg")).rejects.toThrow(
      /nope\.jpg/
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- storage`
Expected: FAIL — `copySource` is not exported; `store.copy` is not a function.

- [ ] **Step 3: Extend the interface**

In `lib/storage/types.ts`:

```ts
export interface AssetStore {
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  /**
   * Copies an existing object to a new key, server-side.
   *
   * For carrying a returning customer's identity documents onto a new
   * contract. The bytes never pass through a function — which is the whole
   * reason the reuse design does not send them to the browser — and the source
   * is left in place, because each contract owns its own set on its own
   * retention clock.
   */
  copy(fromKey: string, toKey: string, contentType: string): Promise<void>;
}
```

- [ ] **Step 4: Implement it for R2**

In `lib/storage/r2.ts`, change the import line to:

```ts
import { CopyObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
```

Add above `createR2Store`:

```ts
/**
 * The `CopySource` value CopyObject wants: `bucket/key`, URI-encoded.
 *
 * Encoded per segment, not as a whole: the slashes are meaningful separators,
 * so `encodeURIComponent` over the entire string would address one object whose
 * name happens to contain slashes. Any other reserved character inside a
 * segment must still be encoded or the source is misread.
 *
 * Separated from the client so it can be tested without a network — the same
 * reason r2Endpoint is separate, and it fails the same silent way.
 */
export function copySource(bucket: string, key: string): string {
  return `${bucket}/${key}`.split("/").map(encodeURIComponent).join("/");
}
```

and add the method to the returned object, after `put`:

```ts
    async copy(fromKey, toKey, contentType) {
      await client.send(
        new CopyObjectCommand({
          Bucket: R2_BUCKET,
          Key: toKey,
          CopySource: copySource(R2_BUCKET, fromKey),
          // REPLACE because ContentType is being set; under the default COPY
          // directive it would be silently ignored and the source's metadata
          // kept.
          ContentType: contentType,
          MetadataDirective: "REPLACE",
        })
      );
    },
```

- [ ] **Step 5: Implement it for the memory store**

In `lib/storage/memory.ts`, add after `put`:

```ts
    async copy(fromKey, toKey, contentType) {
      const source = objects.get(fromKey);
      // Loud, because the alternative is a contract recorded as carrying
      // documents that are not in the bucket.
      if (!source) throw new Error(`No such object: ${fromKey}`);
      objects.set(toKey, { body: source.body, contentType });
    },
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm test -- storage`
Expected: PASS — 5 existing `r2Endpoint` tests, 3 new `copySource` tests, 2 memory tests.

- [ ] **Step 7: Commit**

```bash
git add lib/storage/types.ts lib/storage/r2.ts lib/storage/memory.ts \
  lib/storage/r2.test.ts lib/storage/memory.test.ts
git commit -m "feat: copy an object server-side in the asset store"
```

---

### Task 5: Finding customers by phone

**Files:**
- Create: `lib/rental/findCustomers.ts`
- Test: `tests/db/findCustomers.test.ts`

**Interfaces:**
- Consumes: nothing at runtime; the caller normalises first.
- Produces: `MAX_MATCHES: number`, `REUSABLE_KINDS: readonly AssetKind[]`, `DOCUMENT_REUSE_MS: number`, `interface DocumentsOnFile { contractId: string; contractNumber: string; signedAt: string }`, `interface CustomerMatch { firstName, lastName, birthDate, street, postalCode, city, country, phone, email: string; rentalCount: number; firstRentalAt: string | null; documentsOnFile: DocumentsOnFile | null }`, `findCustomersByPhone(client: PrismaClient, organisationId: string, phoneKey: string, now?: Date): Promise<CustomerMatch[]>`

- [ ] **Step 1: Write the failing test**

Create `tests/db/findCustomers.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { findCustomersByPhone } from "@/lib/rental/findCustomers";
import { persistPickup, type PickupUpload } from "@/lib/rental/persistPickup";
import type { ContractDetails } from "@/lib/rental/schema";
import { createMemoryStore } from "@/lib/storage";
import { ensureOrganisation, seedFleet } from "@/prisma/seed";

const details: ContractDetails = {
  vehicleId: "prius-zh513925",
  mileageKm: 120_000,
  fuelLevel: "3/4",
  existingDamage: "",
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
  mobile: "079 123 45 67",
  email: "anna@example.ch",
  gtcAccepted: true,
  gtcVersion: "2026-07-31",
  gtcLanguage: "de",
  acceptedAt: "2026-08-17T08:00:00.000Z",
  place: "Zurich",
};

const ALL_FIVE: PickupUpload[] = [
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

async function pickup(
  organisationId: string,
  overrides: Partial<ContractDetails> = {},
  uploads: PickupUpload[] = ALL_FIVE
) {
  return persistPickup({
    organisationId,
    details: { ...details, ...overrides } as ContractDetails,
    vehicleSlug: (overrides.vehicleId ?? details.vehicleId) as string,
    uploads,
    pdf: { body: new Uint8Array([7]) },
    store: createMemoryStore(),
  });
}

describe("findCustomersByPhone", () => {
  it("returns nothing for a number nobody has rented on", async () => {
    const { organisationId } = await ready();
    expect(
      await findCustomersByPhone(prisma, organisationId, "+41790000000")
    ).toEqual([]);
  });

  it("returns the prefillable fields for a returning customer", async () => {
    const { organisationId } = await ready();
    await pickup(organisationId);

    const [match] = await findCustomersByPhone(
      prisma,
      organisationId,
      "+41791234567"
    );

    expect(match.firstName).toBe("Anna");
    expect(match.lastName).toBe("Meier");
    // ISO date, not a Date: this crosses JSON to the browser.
    expect(match.birthDate).toBe("1990-04-12");
    expect(match.street).toBe("Bahnhofstrasse 1");
    expect(match.email).toBe("anna@example.ch");
    expect(match.rentalCount).toBe(1);
    expect(match.firstRentalAt).toBe("2026-08-17");
  });

  it("offers the documents from the most recent pickup", async () => {
    const { organisationId } = await ready();
    const first = await pickup(organisationId);

    const [match] = await findCustomersByPhone(
      prisma,
      organisationId,
      "+41791234567"
    );
    expect(match.documentsOnFile?.contractId).toBe(first.contractId);
    expect(match.documentsOnFile?.contractNumber).toBe(first.contractNumber);
  });

  it("does not offer documents when the set is incomplete", async () => {
    const { organisationId } = await ready();
    // A signature and a portrait, no ID or licence. A half-populated document
    // step is worse than an empty one, so this is treated as nothing on file.
    await pickup(organisationId, {}, [
      { kind: "PORTRAIT", body: new Uint8Array([1]), contentType: "image/jpeg" },
      { kind: "SIGNATURE", body: new Uint8Array([6]), contentType: "image/png" },
    ]);

    const [match] = await findCustomersByPhone(
      prisma,
      organisationId,
      "+41791234567"
    );
    expect(match.rentalCount).toBe(1);
    expect(match.documentsOnFile).toBeNull();
  });

  it("does not offer documents past the retention window", async () => {
    const { organisationId } = await ready();
    await pickup(organisationId);
    // Five years and a day after the contract was signed.
    const later = new Date("2031-08-23T00:00:00.000Z");

    const [match] = await findCustomersByPhone(
      prisma,
      organisationId,
      "+41791234567",
      later
    );
    expect(match.documentsOnFile).toBeNull();
  });

  it("returns both people who share a number", async () => {
    const { organisationId } = await ready();
    await pickup(organisationId);
    await pickup(organisationId, {
      firstName: "Peter",
      email: "peter@example.ch",
      vehicleId: "corolla-zh589864",
    });

    const matches = await findCustomersByPhone(
      prisma,
      organisationId,
      "+41791234567"
    );
    expect(matches).toHaveLength(2);
    expect(matches.map((m) => m.firstName).sort()).toEqual(["Anna", "Peter"]);
  });
});
```

**Note for the implementer:** the second and sixth tests use two different vehicle slugs because `persistPickup` refuses a car already `rented`. `corolla-zh589864` must exist in `prisma/seed.ts` — check the seeded slugs and substitute a real second one if it differs.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:db -- findCustomers`
Expected: FAIL — cannot resolve `@/lib/rental/findCustomers`.

- [ ] **Step 3: Write the implementation**

Create `lib/rental/findCustomers.ts`:

```ts
/**
 * The renter, recognised at the desk.
 *
 * Phase 2 has deduplicated customers on email since the first contract, so a
 * repeat renter has always been one row with a history. Nothing read it back:
 * the identity existed and the path from a person at the desk to the record
 * describing them did not. This is that path.
 *
 * Returns no image bytes and no contract id. The caller turns
 * `documentsOnFile.contractId` into a signed token before anything reaches a
 * browser — see reuseToken.ts for why a client is never trusted with the id.
 */

import type { AssetKind, PrismaClient } from "@/generated/prisma/client";

/** Enough for a couple sharing a mobile, few enough that the chooser is short. */
export const MAX_MATCHES = 5;

/**
 * What may be carried onto a new contract.
 *
 * Not SIGNATURE, which is signed today by definition, and not CONDITION_PHOTO,
 * which describes the car rather than the person.
 */
export const REUSABLE_KINDS: readonly AssetKind[] = [
  "PORTRAIT",
  "ID_FRONT",
  "ID_BACK",
  "LICENCE_FRONT",
  "LICENCE_BACK",
];

/** Five years, matching the retention period in docs/DATA-RETENTION.md. */
export const DOCUMENT_REUSE_MS = 5 * 365.25 * 24 * 60 * 60 * 1000;

export interface DocumentsOnFile {
  contractId: string;
  contractNumber: string;
  /** ISO date. */
  signedAt: string;
}

export interface CustomerMatch {
  firstName: string;
  lastName: string;
  /** ISO date, because this crosses JSON on its way to the form. */
  birthDate: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  rentalCount: number;
  /** ISO date of the first rental, for "returning since March 2026". */
  firstRentalAt: string | null;
  documentsOnFile: DocumentsOnFile | null;
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export async function findCustomersByPhone(
  client: PrismaClient,
  organisationId: string,
  phoneKey: string,
  now: Date = new Date()
): Promise<CustomerMatch[]> {
  const customers = await client.customer.findMany({
    where: { organisationId, phoneKey },
    // Served by @@index([organisationId, phoneKey]).
    orderBy: { createdAt: "asc" },
    take: MAX_MATCHES,
    select: {
      firstName: true,
      lastName: true,
      birthDate: true,
      street: true,
      postalCode: true,
      city: true,
      country: true,
      phone: true,
      email: true,
      rentals: {
        orderBy: { startAt: "asc" },
        select: {
          startAt: true,
          contracts: {
            where: { kind: "PICKUP" },
            orderBy: { signedAt: "desc" },
            take: 1,
            select: {
              id: true,
              contractNumber: true,
              signedAt: true,
              assets: { select: { kind: true } },
            },
          },
        },
      },
    },
  });

  const earliest = now.getTime() - DOCUMENT_REUSE_MS;

  return customers.map((customer) => {
    // One pickup contract per rental, so flattening and re-sorting gives the
    // customer's most recent across all of them.
    const contracts = customer.rentals
      .flatMap((rental) => rental.contracts)
      .sort((a, b) => b.signedAt.getTime() - a.signedAt.getTime());

    const latest = contracts[0];
    const kinds = new Set(latest?.assets.map((asset) => asset.kind) ?? []);
    const complete = REUSABLE_KINDS.every((kind) => kinds.has(kind));
    const fresh = latest ? latest.signedAt.getTime() >= earliest : false;

    return {
      firstName: customer.firstName,
      lastName: customer.lastName,
      birthDate: isoDate(customer.birthDate),
      street: customer.street,
      postalCode: customer.postalCode,
      city: customer.city,
      country: customer.country,
      phone: customer.phone,
      email: customer.email,
      rentalCount: customer.rentals.length,
      firstRentalAt: customer.rentals[0]
        ? isoDate(customer.rentals[0].startAt)
        : null,
      documentsOnFile:
        latest && complete && fresh
          ? {
              contractId: latest.id,
              contractNumber: latest.contractNumber,
              signedAt: isoDate(latest.signedAt),
            }
          : null,
    };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:db -- findCustomers`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/rental/findCustomers.ts tests/db/findCustomers.test.ts
git commit -m "feat: find a returning customer and what documents they have on file"
```

---

### Task 6: The lookup endpoint

**Files:**
- Create: `app/api/customers/lookup/route.ts`
- Test: `tests/db/customerLookupRoute.test.ts`

**Interfaces:**
- Consumes: `normalisePhone` (1), `issueReuseToken` (2), `findCustomersByPhone`, `CustomerMatch` (5), `hashIp` and `rateLimited` from `lib/rental/rateLimit.ts`, `applyKeyValid` and `APPLY_KEY_HEADER` from `lib/applyKey.ts`.
- Produces: `POST /api/customers/lookup/` returning `{ matches: LookupMatch[] }` where `LookupMatch` is `CustomerMatch` with `documentsOnFile` replaced by `{ contractNumber, signedAt, reuseToken }`.

- [ ] **Step 1: Write the failing test**

Create `tests/db/customerLookupRoute.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/customers/lookup/route";
import { prisma } from "@/lib/db";
import { APPLY_KEY_HEADER } from "@/lib/applyKey";
import { persistPickup, type PickupUpload } from "@/lib/rental/persistPickup";
import { readReuseToken } from "@/lib/rental/reuseToken";
import type { ContractDetails } from "@/lib/rental/schema";
import { createMemoryStore } from "@/lib/storage";
import { ensureOrganisation, seedFleet } from "@/prisma/seed";

const SECRET = "test-office-secret";

const details: ContractDetails = {
  vehicleId: "prius-zh513925",
  mileageKm: 120_000,
  fuelLevel: "3/4",
  existingDamage: "",
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
  mobile: "079 123 45 67",
  email: "anna@example.ch",
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

function request(body: unknown, key: string | null = SECRET): Request {
  return new Request("https://zuriauto.ch/api/customers/lookup/", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(key ? { [APPLY_KEY_HEADER]: key } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function seedOneRental() {
  const org = await ensureOrganisation(prisma);
  await seedFleet(prisma, org.id);
  await persistPickup({
    organisationId: org.id,
    details,
    vehicleSlug: details.vehicleId,
    uploads,
    pdf: { body: new Uint8Array([7]) },
    store: createMemoryStore(),
  });
  return org;
}

describe("POST /api/customers/lookup", () => {
  beforeEach(() => {
    process.env.APPLY_SECRET = SECRET;
    process.env.RATE_LIMIT_SALT = "test-salt";
  });

  it("refuses an unfenced request", async () => {
    const response = await POST(request({ phone: "079 123 45 67" }, null));
    expect(response.status).toBe(401);
  });

  it("refuses the wrong key", async () => {
    const response = await POST(request({ phone: "079 123 45 67" }, "wrong"));
    expect(response.status).toBe(401);
  });

  it("finds a returning customer and hands back a usable token", async () => {
    await seedOneRental();
    const response = await POST(request({ phone: "079 123 45 67" }));
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.matches).toHaveLength(1);
    expect(body.matches[0].firstName).toBe("Anna");
    expect(body.matches[0].documentsOnFile.contractNumber).toMatch(
      /^ZA-\d{8}-\d{4}$/
    );

    // A token, not an id — and one the submit path will accept.
    expect(body.matches[0].documentsOnFile.contractId).toBeUndefined();
    const token = body.matches[0].documentsOnFile.reuseToken;
    expect(readReuseToken(token)).toMatch(/^c[a-z0-9]+$/);
  });

  it("answers 200 with an empty list for an unknown number", async () => {
    await seedOneRental();
    const response = await POST(request({ phone: "079 000 00 00" }));
    // A query that succeeded and found nothing, not a missing resource — a 404
    // would read to the staff member as a broken lookup.
    expect(response.status).toBe(200);
    expect((await response.json()).matches).toEqual([]);
  });

  it("answers 200 with an empty list for an unnormalisable number", async () => {
    await seedOneRental();
    const response = await POST(request({ phone: "ask at the desk" }));
    expect(response.status).toBe(200);
    expect((await response.json()).matches).toEqual([]);
  });

  it("rejects a missing phone field", async () => {
    const response = await POST(request({}));
    expect(response.status).toBe(400);
  });

  it("records every lookup as a hash, with the match count", async () => {
    await seedOneRental();
    await POST(request({ phone: "079 123 45 67" }));

    const [audit] = await prisma.customerLookup.findMany();
    expect(audit.matches).toBe(1);
    expect(audit.phoneHash).toMatch(/^[0-9a-f]{64}$/);
    // The number itself must never be recoverable from this table.
    expect(audit.phoneHash).not.toContain("791234567");
  });

  it("rate-limits repeated lookups", async () => {
    await seedOneRental();
    let last = 200;
    // RATE_LIMIT.max is 5, so the seventh is refused.
    for (let attempt = 0; attempt < 7; attempt += 1) {
      last = (await POST(request({ phone: "079 123 45 67" }))).status;
    }
    expect(last).toBe(429);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:db -- customerLookupRoute`
Expected: FAIL — cannot resolve `@/app/api/customers/lookup/route`.

- [ ] **Step 3: Write the route**

Create `app/api/customers/lookup/route.ts`:

```ts
import { NextResponse } from "next/server";
import { APPLY_KEY_HEADER, applyKeyValid } from "@/lib/applyKey";
import { prisma } from "@/lib/db";
import { findCustomersByPhone } from "@/lib/rental/findCustomers";
import { normalisePhone } from "@/lib/rental/phone";
import { hashIp, rateLimited } from "@/lib/rental/rateLimit";
import { issueReuseToken } from "@/lib/rental/reuseToken";

/**
 * Who is this, and what have we already got?
 *
 * POST rather than GET so the number never lands in a URL, an access log or a
 * referrer header — it is personal data, and a query string is the one place
 * that leaks it everywhere at once.
 *
 * Fenced with the office key, origin-checked and rate-limited, because an open
 * version of this is a way to test phone numbers against the customer list.
 * Returns no image bytes and no contract id: the permission to reuse documents
 * travels as a signed, expiring token instead.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

/** Rejects cross-site posts. Absent Origin (some native clients) is allowed. */
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  // First, so an unauthorised request costs nothing to reject.
  if (!applyKeyValid(request.headers.get(APPLY_KEY_HEADER))) {
    return NextResponse.json({ code: "unauthorised" }, { status: 401 });
  }

  if (!sameOrigin(request)) {
    return NextResponse.json({ code: "bad-origin" }, { status: 403 });
  }

  if (await rateLimited(prisma, clientIp(request))) {
    return NextResponse.json({ code: "rate-limited" }, { status: 429 });
  }

  let phone: unknown;
  try {
    phone = (await request.json())?.phone;
  } catch {
    return NextResponse.json({ code: "bad-request" }, { status: 400 });
  }
  if (typeof phone !== "string") {
    return NextResponse.json({ code: "bad-request" }, { status: 400 });
  }

  const phoneKey = normalisePhone(phone);

  const organisation = await prisma.organisation.findFirst({
    select: { id: true },
  });
  if (!organisation) {
    console.error("[customer-lookup] no organisation row — run pnpm db:seed");
    return NextResponse.json({ code: "not-configured" }, { status: 503 });
  }

  // An unnormalisable number is not an error. It is a number nobody can be
  // found by, which is the same answer as a number nobody has rented on.
  const matches = phoneKey
    ? await findCustomersByPhone(prisma, organisation.id, phoneKey)
    : [];

  // Audited even when nothing matched — a run of empty lookups is exactly the
  // shape of someone walking the number space, and hiding it would defeat the
  // reason the table exists.
  await prisma.customerLookup.create({
    data: { phoneHash: hashIp(phoneKey ?? phone), matches: matches.length },
  });

  return NextResponse.json({
    matches: matches.map((match) => ({
      ...match,
      documentsOnFile: match.documentsOnFile
        ? {
            contractNumber: match.documentsOnFile.contractNumber,
            signedAt: match.documentsOnFile.signedAt,
            // The id stays on the server; the client gets permission instead.
            reuseToken: issueReuseToken(match.documentsOnFile.contractId),
          }
        : null,
    })),
  });
}
```

**Note:** `hashIp` is reused rather than copied — it is already "salted SHA-256 of a string that is personal data", which is exactly this. If a reviewer objects to the name, rename it to `hashPersonalString` in `rateLimit.ts` and update both callers in the same commit.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:db -- customerLookupRoute`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add app/api/customers/lookup/route.ts tests/db/customerLookupRoute.test.ts
git commit -m "feat: add a fenced, audited customer lookup endpoint"
```

---

### Task 7: Carrying documents onto a new contract

**Files:**
- Create: `lib/rental/reuseDocuments.ts`
- Modify: `lib/rental/persistPickup.ts:22-43` (input types), `:54-63` (upload block), `:113-142` (contract and asset writes)
- Test: `tests/db/reuseDocuments.test.ts`

**Interfaces:**
- Consumes: `REUSABLE_KINDS` (5), `AssetStore.copy` (4), `assetKey` and `extensionFor` from `lib/storage`.
- Produces: `copyDocumentsForward(client, store, submissionId, sourceContractId): Promise<StoredAsset[]>`; `PersistPickupInput` gains `reuseFromContractId?: string` and `identityCheckedAt?: Date`.

- [ ] **Step 1: Write the failing test**

Create `tests/db/reuseDocuments.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { persistPickup, type PickupUpload } from "@/lib/rental/persistPickup";
import { copyDocumentsForward } from "@/lib/rental/reuseDocuments";
import type { ContractDetails } from "@/lib/rental/schema";
import { createMemoryStore, type MemoryStore } from "@/lib/storage";
import { ensureOrganisation, seedFleet } from "@/prisma/seed";

const details: ContractDetails = {
  vehicleId: "prius-zh513925",
  mileageKm: 120_000,
  fuelLevel: "3/4",
  existingDamage: "",
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
  mobile: "079 123 45 67",
  email: "anna@example.ch",
  gtcAccepted: true,
  gtcVersion: "2026-07-31",
  gtcLanguage: "de",
  acceptedAt: "2026-08-17T08:00:00.000Z",
  place: "Zurich",
};

const ALL_FIVE: PickupUpload[] = [
  { kind: "PORTRAIT", body: new Uint8Array([1]), contentType: "image/jpeg" },
  { kind: "ID_FRONT", body: new Uint8Array([2]), contentType: "image/jpeg" },
  { kind: "ID_BACK", body: new Uint8Array([3]), contentType: "image/jpeg" },
  { kind: "LICENCE_FRONT", body: new Uint8Array([4]), contentType: "image/jpeg" },
  { kind: "LICENCE_BACK", body: new Uint8Array([5]), contentType: "image/jpeg" },
  { kind: "SIGNATURE", body: new Uint8Array([6]), contentType: "image/png" },
];

/** One shared store, so a copy can find what the first pickup put there. */
async function firstPickup(store: MemoryStore) {
  const org = await ensureOrganisation(prisma);
  await seedFleet(prisma, org.id);
  const saved = await persistPickup({
    organisationId: org.id,
    details,
    vehicleSlug: details.vehicleId,
    uploads: ALL_FIVE,
    pdf: { body: new Uint8Array([7]) },
    store,
  });
  // Free the car so the same fleet can be rented again.
  await prisma.car.updateMany({ data: { status: "available" } });
  return { organisationId: org.id, saved };
}

describe("copyDocumentsForward", () => {
  it("copies the five identity documents and nothing else", async () => {
    const store = createMemoryStore();
    const { saved } = await firstPickup(store);

    const copied = await copyDocumentsForward(
      prisma,
      store,
      "new-submission",
      saved.contractId
    );

    expect(copied).toHaveLength(5);
    expect(copied.map((asset) => asset.kind).sort()).toEqual([
      "ID_BACK",
      "ID_FRONT",
      "LICENCE_BACK",
      "LICENCE_FRONT",
      "PORTRAIT",
    ]);
    // The signature is signed today and is never carried forward.
    expect(copied.some((asset) => asset.kind === "SIGNATURE")).toBe(false);
  });

  it("gives every copy a new key under the new submission", async () => {
    const store = createMemoryStore();
    const { saved } = await firstPickup(store);

    const copied = await copyDocumentsForward(
      prisma,
      store,
      "new-submission",
      saved.contractId
    );

    for (const asset of copied) {
      expect(asset.storageKey).toContain("pickup/new-submission/");
    }
    // Six from the first pickup, plus its PDF, plus five copies.
    expect(store.objects.size).toBe(12);
  });

  it("carries the size and content type from the source row", async () => {
    const store = createMemoryStore();
    const { saved } = await firstPickup(store);

    const copied = await copyDocumentsForward(
      prisma,
      store,
      "new-submission",
      saved.contractId
    );
    const portrait = copied.find((asset) => asset.kind === "PORTRAIT");
    expect(portrait?.contentType).toBe("image/jpeg");
    expect(portrait?.bytes).toBe(1);
  });

  it("refuses when the source set is incomplete", async () => {
    const store = createMemoryStore();
    const org = await ensureOrganisation(prisma);
    await seedFleet(prisma, org.id);
    const saved = await persistPickup({
      organisationId: org.id,
      details,
      vehicleSlug: details.vehicleId,
      uploads: [ALL_FIVE[0], ALL_FIVE[5]],
      pdf: { body: new Uint8Array([7]) },
      store,
    });

    // Loud, because the caller has already told the customer their documents
    // are on file.
    await expect(
      copyDocumentsForward(prisma, store, "new-submission", saved.contractId)
    ).rejects.toThrow(/incomplete/i);
  });
});

describe("persistPickup with reuse", () => {
  it("writes five copied assets plus the fresh signature", async () => {
    const store = createMemoryStore();
    const { organisationId, saved } = await firstPickup(store);
    const checkedAt = new Date("2026-11-01T09:00:00.000Z");

    const second = await persistPickup({
      organisationId,
      details: { ...details, vehicleId: "prius-zh513925" },
      vehicleSlug: "prius-zh513925",
      uploads: [ALL_FIVE[5]],
      pdf: { body: new Uint8Array([8]) },
      store,
      reuseFromContractId: saved.contractId,
      identityCheckedAt: checkedAt,
    });

    const assets = await prisma.asset.findMany({
      where: { contractId: second.contractId },
    });
    expect(assets).toHaveLength(6);

    const contract = await prisma.contract.findUniqueOrThrow({
      where: { id: second.contractId },
    });
    expect(contract.documentsReusedFromId).toBe(saved.contractId);
    expect(contract.identityCheckedAt).toEqual(checkedAt);
  });

  it("leaves the source contract's own assets untouched", async () => {
    const store = createMemoryStore();
    const { organisationId, saved } = await firstPickup(store);

    await persistPickup({
      organisationId,
      details,
      vehicleSlug: "prius-zh513925",
      uploads: [ALL_FIVE[5]],
      pdf: { body: new Uint8Array([8]) },
      store,
      reuseFromContractId: saved.contractId,
      identityCheckedAt: new Date(),
    });

    // Each contract owns its own set on its own retention clock; nothing is
    // shared and nothing is moved.
    expect(
      await prisma.asset.count({ where: { contractId: saved.contractId } })
    ).toBe(6);
  });

  it("records one customer, not two", async () => {
    const store = createMemoryStore();
    const { organisationId, saved } = await firstPickup(store);

    await persistPickup({
      organisationId,
      details,
      vehicleSlug: "prius-zh513925",
      uploads: [ALL_FIVE[5]],
      pdf: { body: new Uint8Array([8]) },
      store,
      reuseFromContractId: saved.contractId,
      identityCheckedAt: new Date(),
    });

    expect(await prisma.customer.count()).toBe(1);
    expect(await prisma.rental.count()).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:db -- reuseDocuments`
Expected: FAIL — cannot resolve `@/lib/rental/reuseDocuments`.

- [ ] **Step 3: Write the copy module**

Create `lib/rental/reuseDocuments.ts`:

```ts
/**
 * Carrying a returning customer's identity documents onto a new contract.
 *
 * Copies rather than shares. Hanging one Asset row off two contracts is the
 * obvious way to "reuse" a file and the wrong one: it turns a per-contract
 * deletion sweep into reference counting, and makes every retention question
 * a question about who else still points at the object. Copying keeps the
 * invariant that a contract owns its own set on its own clock, and costs a few
 * hundred kilobytes per rental.
 *
 * The copy is server-side, so the bytes never pass through a function — which
 * is also why the browser is never sent them.
 */

import type { PrismaClient } from "@/generated/prisma/client";
import { assetKey, extensionFor, type AssetStore, type StoredAsset } from "@/lib/storage";
import { REUSABLE_KINDS } from "./findCustomers";

export async function copyDocumentsForward(
  client: PrismaClient,
  store: AssetStore,
  submissionId: string,
  sourceContractId: string
): Promise<StoredAsset[]> {
  const source = await client.asset.findMany({
    where: { contractId: sourceContractId, kind: { in: [...REUSABLE_KINDS] } },
    select: { kind: true, storageKey: true, contentType: true, bytes: true },
  });

  // Checked here as well as at lookup time. The lookup decided what to offer
  // half an hour ago; this is the moment a contract is about to claim the
  // documents exist, and a partial set would make that claim false.
  if (source.length !== REUSABLE_KINDS.length) {
    throw new Error(
      `Cannot reuse documents from ${sourceContractId}: incomplete set ` +
        `(${source.length} of ${REUSABLE_KINDS.length})`
    );
  }

  return Promise.all(
    source.map(async (asset) => {
      const key = assetKey(
        submissionId,
        asset.kind,
        extensionFor(asset.contentType)
      );
      await store.copy(asset.storageKey, key, asset.contentType);
      // Every column comes from the source row, so nothing has to be
      // re-inspected in the bucket.
      return {
        kind: asset.kind,
        storageKey: key,
        contentType: asset.contentType,
        bytes: asset.bytes,
      };
    })
  );
}
```

- [ ] **Step 4: Wire it into `persistPickup`**

In `lib/rental/persistPickup.ts`, add the import:

```ts
import { copyDocumentsForward } from "./reuseDocuments";
```

Extend `PersistPickupInput` with two fields:

```ts
  /**
   * The contract whose identity documents this handover carries forward.
   *
   * Already authorised by the caller — the route verifies a signed reuse token
   * rather than trusting a client-supplied id. See lib/rental/reuseToken.ts.
   */
  reuseFromContractId?: string;
  /** When the staff member confirmed they saw the originals. Reuse path only. */
  identityCheckedAt?: Date;
```

In the destructure on line 48, add the new field:

```ts
  const { organisationId, details, vehicleSlug, uploads, store } = input;
```
becomes
```ts
  const { organisationId, details, vehicleSlug, uploads, store } = input;
  const reuseFrom = input.reuseFromContractId;
```

After the existing `uploadAssets` call and PDF put, add the copy:

```ts
  const stored = await uploadAssets(store, submissionId, uploads);

  // Copied in the same phase as the uploads and for the same reason: a storage
  // failure must abort before anything is written, leaving sweepable orphans
  // under one prefix rather than a contract pointing at objects that are not
  // there.
  const carried = reuseFrom
    ? await copyDocumentsForward(prisma, store, submissionId, reuseFrom)
    : [];
```

In the `contract.create` call, add to `data`:

```ts
          pdfKey,
          documentsReusedFromId: reuseFrom ?? null,
          identityCheckedAt: input.identityCheckedAt ?? null,
```

And change the asset write to include both sets:

```ts
      await tx.asset.createMany({
        // `uploadAssets` deals in plain strings so the storage layer stays free
        // of the schema; the narrowing happens here, where the enum matters.
        // Safe because `uploads` arrived typed as AssetKind, and the carried
        // rows were read from the column.
        data: [...stored, ...carried].map((asset) => ({
          ...asset,
          kind: asset.kind as AssetKind,
          contractId: contract.id,
        })),
      });
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test:db -- reuseDocuments`
Expected: PASS, 7 tests.

Then: `pnpm test:db`
Expected: PASS. The existing `persistPickup` suite must still pass untouched — reuse is opt-in.

- [ ] **Step 6: Commit**

```bash
git add lib/rental/reuseDocuments.ts lib/rental/persistPickup.ts \
  tests/db/reuseDocuments.test.ts
git commit -m "feat: copy identity documents forward onto a new contract"
```

---

### Task 8: The PDF reference page

**Files:**
- Modify: `lib/rental/contractPdf.ts:337-360` (input), `:503-528` (photo pages)
- Modify: `lib/rental/labels.ts` (`de.pdf` ~345-398, `en.pdf` ~721-774)
- Test: `lib/rental/contractPdf.test.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: `ContractPdfInput` with the five document images optional and a new `documentsOnFile?: { contractNumber: string; signedAt: string; checkedAt: string }`.

- [ ] **Step 1: Write the failing test**

Create `lib/rental/contractPdf.test.ts`. Only the document-page behaviour is new; the assertions are on bytes produced, because a PDF's text is not readable without a parser and the point is that it builds at all.

```ts
import { describe, expect, it } from "vitest";
import { buildContractPdf, type ContractPdfInput } from "./contractPdf";

/** A one-pixel JPEG, so embedJpg has something real to parse. */
const JPEG = Uint8Array.from(
  Buffer.from(
    "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8U" +
      "HRofHh0aHBwcJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA" +
      "/8QAFAABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFBEB" +
      "AAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AlgAAAA==",
    "base64"
  )
);

/** A one-pixel PNG for the signature, which is embedded with embedPng. */
const PNG = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAF" +
      "hAJ/wlseKgAAAABJRU5ErkJggg==",
    "base64"
  )
);

const base: ContractPdfInput = {
  details: {
    vehicleId: "prius-zh513925",
    mileageKm: 120_000,
    fuelLevel: "3/4",
    existingDamage: "",
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
    email: "anna@example.ch",
    gtcAccepted: true,
    gtcVersion: "2026-07-31",
    gtcLanguage: "de",
    acceptedAt: "2026-08-17T08:00:00.000Z",
    place: "Zurich",
  },
  conditionPhotos: [],
  signaturePng: PNG,
} as unknown as ContractPdfInput;

describe("buildContractPdf document pages", () => {
  it("builds with five captured documents, as it always has", async () => {
    const bytes = await buildContractPdf({
      ...base,
      portraitPhoto: JPEG,
      idFrontPhoto: JPEG,
      idBackPhoto: JPEG,
      licenceFrontPhoto: JPEG,
      licenceBackPhoto: JPEG,
    });
    expect(bytes.byteLength).toBeGreaterThan(1000);
  });

  it("builds with a reference page instead of the images", async () => {
    const bytes = await buildContractPdf({
      ...base,
      documentsOnFile: {
        contractNumber: "ZA-20260212-0007",
        signedAt: "2026-02-12",
        checkedAt: "2026-08-22",
      },
    });
    expect(bytes.byteLength).toBeGreaterThan(1000);
  });

  it("is smaller without the embedded images", async () => {
    const withImages = await buildContractPdf({
      ...base,
      portraitPhoto: JPEG,
      idFrontPhoto: JPEG,
      idBackPhoto: JPEG,
      licenceFrontPhoto: JPEG,
      licenceBackPhoto: JPEG,
    });
    const withReference = await buildContractPdf({
      ...base,
      documentsOnFile: {
        contractNumber: "ZA-20260212-0007",
        signedAt: "2026-02-12",
        checkedAt: "2026-08-22",
      },
    });
    expect(withReference.byteLength).toBeLessThan(withImages.byteLength);
  });

  it("refuses to build with no identity evidence at all", async () => {
    // A contract that names nobody's documents must be unbuildable, not merely
    // discouraged — this is the guard that makes the optional fields safe.
    await expect(buildContractPdf(base)).rejects.toThrow(/identity/i);
  });
});
```

**Note for the implementer:** check `buildContractPdf`'s real second parameter (the language / `includeGtcAppendix` arguments seen around line 362) and pass whatever the existing signature needs — the calls above show only the first argument.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- contractPdf`
Expected: FAIL — TypeScript rejects the missing required photo fields, and the last case does not throw.

- [ ] **Step 3: Make the images optional and add the new input**

In `lib/rental/contractPdf.ts`, in `ContractPdfInput` (lines 350-354), make the five optional and add the reference:

```ts
  /**
   * The identity documents, when photographed at this handover.
   *
   * Optional since returning customers carry theirs forward — see
   * `documentsOnFile`. Exactly one of the two must be present; the guard in
   * buildContractPdf enforces it.
   */
  portraitPhoto?: Uint8Array;
  idFrontPhoto?: Uint8Array;
  idBackPhoto?: Uint8Array;
  licenceFrontPhoto?: Uint8Array;
  licenceBackPhoto?: Uint8Array;
  /**
   * Set instead of the five images when the documents were carried forward
   * from an earlier contract. All three are display strings, already
   * formatted — this module does not decide what the dates mean.
   */
  documentsOnFile?: {
    contractNumber: string;
    signedAt: string;
    checkedAt: string;
  };
```

- [ ] **Step 4: Add the labels**

In `lib/rental/labels.ts`, inside `de.pdf`:

```ts
    documentsOnFileTitle: "Identitätsdokumente",
    documentsOnFileBody:
      "Ausweis- und Führerscheinkopien liegen aus Vertrag {contract} vom {signed} vor.",
    documentsOnFileChecked:
      "Die Originale wurden bei der Übergabe geprüft: Büro, {checked}.",
```

and the same keys inside `en.pdf`:

```ts
    documentsOnFileTitle: "Identity documents",
    documentsOnFileBody:
      "ID and driving licence copies are on file from contract {contract} of {signed}.",
    documentsOnFileChecked:
      "The originals were checked at handover: office, {checked}.",
```

- [ ] **Step 5: Replace the photo-page loop**

In `lib/rental/contractPdf.ts`, replace the `documentPages` block (lines 503-528) with:

```ts
  // --- Photo pages -----------------------------------------------------
  const documentPages: [Uint8Array, string][] = [
    // The portrait leads, so whoever checks the contract sees the person
    // before the documents they are being compared against.
    [input.portraitPhoto, L.portraitPhoto],
    [input.idFrontPhoto, L.idFrontPhoto],
    [input.idBackPhoto, L.idBackPhoto],
    [input.licenceFrontPhoto, L.licenceFrontPhoto],
    [input.licenceBackPhoto, L.licenceBackPhoto],
  ].filter((entry): entry is [Uint8Array, string] => Boolean(entry[0]));

  // One or the other, never neither. A contract carrying no identity evidence
  // at all has to be impossible to produce rather than merely unusual.
  if (documentPages.length === 0 && !input.documentsOnFile) {
    throw new Error(
      "No identity evidence: pass the document images or documentsOnFile."
    );
  }

  if (input.documentsOnFile) {
    const { contractNumber, signedAt, checkedAt } = input.documentsOnFile;
    w.newPage();
    w.sectionTitle(L.documentsOnFileTitle);
    w.gap(4);
    w.text(
      L.documentsOnFileBody
        .replace("{contract}", contractNumber)
        .replace("{signed}", signedAt),
      { size: 10 }
    );
    w.gap(6);
    w.text(L.documentsOnFileChecked.replace("{checked}", checkedAt), {
      size: 9,
      color: MUTED,
    });
  }

  for (const [bytes, caption] of documentPages) {
    if (isPdfBytes(bytes)) {
      // Every page of the upload, in case the scan spreads the document over
      // several; each keeps the caption, numbered when there is more than one.
      const source = await PDFDocument.load(bytes);
      const embedded = await doc.embedPdf(source, source.getPageIndices());
      embedded.forEach((page, index) => {
        const suffix =
          embedded.length > 1 ? ` (${index + 1}/${embedded.length})` : "";
        w.embeddedPdfPage(page, `${caption}${suffix}`);
      });
    } else {
      w.imagePage(await doc.embedJpg(bytes), caption);
    }
  }
```

**Note for the implementer:** confirm `w.newPage()`, `w.sectionTitle()`, `w.text()` and `w.gap()` exist with these signatures on the `Writer` class (around lines 200-300) and adjust the calls to match. `MUTED` is already imported in this file.

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm test -- contractPdf`
Expected: PASS, 4 tests.

- [ ] **Step 7: Commit**

```bash
git add lib/rental/contractPdf.ts lib/rental/labels.ts lib/rental/contractPdf.test.ts
git commit -m "feat: print a reference page when documents are carried forward"
```

---

### Task 9: Accepting reuse on the write endpoint

**Files:**
- Modify: `lib/rental/schema.ts:83-100` (`contractMetaSchema`)
- Modify: `app/api/rental-contract/route.ts:82-127`
- Test: `tests/db/rentalContractReuse.test.ts`

**Interfaces:**
- Consumes: `readReuseToken` (2), `persistPickup`'s new fields (7).
- Produces: `contractMetaSchema` accepting `reuseToken?: string` and `identityChecked?: boolean`.

- [ ] **Step 1: Write the failing test**

Create `tests/db/rentalContractReuse.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/rental-contract/route";
import { prisma } from "@/lib/db";
import { APPLY_KEY_HEADER } from "@/lib/applyKey";
import { persistPickup, type PickupUpload } from "@/lib/rental/persistPickup";
import { issueReuseToken } from "@/lib/rental/reuseToken";
import type { ContractDetails } from "@/lib/rental/schema";
import { createMemoryStore } from "@/lib/storage";
import { ensureOrganisation, seedFleet } from "@/prisma/seed";

const SECRET = "test-office-secret";

const details: ContractDetails = {
  vehicleId: "prius-zh513925",
  mileageKm: 120_000,
  fuelLevel: "3/4",
  existingDamage: "",
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
  mobile: "079 123 45 67",
  email: "anna@example.ch",
  gtcAccepted: true,
  gtcVersion: "2026-07-31",
  gtcLanguage: "de",
  acceptedAt: "2026-08-17T08:00:00.000Z",
  place: "Zurich",
};

const ALL_FIVE: PickupUpload[] = [
  { kind: "PORTRAIT", body: new Uint8Array([1]), contentType: "image/jpeg" },
  { kind: "ID_FRONT", body: new Uint8Array([2]), contentType: "image/jpeg" },
  { kind: "ID_BACK", body: new Uint8Array([3]), contentType: "image/jpeg" },
  { kind: "LICENCE_FRONT", body: new Uint8Array([4]), contentType: "image/jpeg" },
  { kind: "LICENCE_BACK", body: new Uint8Array([5]), contentType: "image/jpeg" },
  { kind: "SIGNATURE", body: new Uint8Array([6]), contentType: "image/png" },
];

async function seedFirstContract() {
  const org = await ensureOrganisation(prisma);
  await seedFleet(prisma, org.id);
  const saved = await persistPickup({
    organisationId: org.id,
    details,
    vehicleSlug: details.vehicleId,
    uploads: ALL_FIVE,
    pdf: { body: new Uint8Array([7]) },
    store: createMemoryStore(),
  });
  await prisma.car.updateMany({ data: { status: "available" } });
  return saved;
}

function submission(meta: Record<string, unknown>): Request {
  const body = new FormData();
  body.append(
    "pdf",
    new File([new Uint8Array([37, 80, 68, 70])], "c.pdf", {
      type: "application/pdf",
    })
  );
  body.append(
    "asset:SIGNATURE",
    new File([new Uint8Array([6])], "s.png", { type: "image/png" })
  );
  body.append("meta", JSON.stringify(meta));
  body.append("company", "");

  return new Request("https://zuriauto.ch/api/rental-contract/", {
    method: "POST",
    headers: { [APPLY_KEY_HEADER]: SECRET },
    body,
  });
}

const meta = {
  contractNumber: "ZA-20260822-0002",
  customerName: "Anna Meier",
  customerEmail: "anna@example.ch",
  vehicleLabel: "Toyota Prius",
  plate: "ZH 513925",
  mileageKm: 120_000,
  language: "de",
  details,
};

describe("POST /api/rental-contract with reuse", () => {
  beforeEach(() => {
    process.env.APPLY_SECRET = SECRET;
    process.env.RATE_LIMIT_SALT = "test-salt";
  });

  it("records a contract whose documents were carried forward", async () => {
    const first = await seedFirstContract();
    const response = await POST(
      submission({
        ...meta,
        reuseToken: issueReuseToken(first.contractId),
        identityChecked: true,
      })
    );

    expect(response.status).toBe(200);
    const second = await prisma.contract.findFirstOrThrow({
      where: { documentsReusedFromId: first.contractId },
    });
    expect(second.identityCheckedAt).toBeInstanceOf(Date);
    // Five copied plus the fresh signature.
    expect(await prisma.asset.count({ where: { contractId: second.id } })).toBe(6);
  });

  it("rejects a reuse token without the attestation", async () => {
    const first = await seedFirstContract();
    const response = await POST(
      submission({ ...meta, reuseToken: issueReuseToken(first.contractId) })
    );
    // The tick is a claim about what a person did and it has to stand behind a
    // contract later, so it cannot be enforced only in the browser.
    expect(response.status).toBe(400);
    expect(await prisma.contract.count()).toBe(1);
  });

  it("rejects a forged reuse token", async () => {
    await seedFirstContract();
    const response = await POST(
      submission({
        ...meta,
        reuseToken: "bm90LWEtdG9rZW4.forged",
        identityChecked: true,
      })
    );
    expect(response.status).toBe(400);
    expect(await prisma.contract.count()).toBe(1);
  });

  it("rejects an expired reuse token", async () => {
    const first = await seedFirstContract();
    const stale = issueReuseToken(
      first.contractId,
      new Date(Date.now() - 60 * 60 * 1000)
    );
    const response = await POST(
      submission({ ...meta, reuseToken: stale, identityChecked: true })
    );
    // Half an hour has passed; the wizard should say so rather than silently
    // fall back to capturing fresh photographs.
    expect(response.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:db -- rentalContractReuse`
Expected: FAIL — `contractMetaSchema` rejects the unknown `reuseToken` key, or the reuse is ignored.

- [ ] **Step 3: Extend the schema**

In `lib/rental/schema.ts`, add to `contractMetaSchema` before the closing brace, then attach a cross-field rule:

```ts
  details: contractDetailsSchema,

  /**
   * Permission to carry an earlier contract's identity documents forward,
   * issued by the lookup endpoint. Verified in the route — the schema only
   * establishes that a string arrived.
   */
  reuseToken: z.string().trim().min(1).max(512).optional(),
  /** The staff member's confirmation that they saw the original documents. */
  identityChecked: z.boolean().optional(),
});
```

and replace the bare `});` ending with a refinement:

```ts
}).superRefine((value, context) => {
  // Enforced here as well as in the form, for the reason stated at the top of
  // this file: the schema runs on both sides so a crafted request cannot skip
  // a check the wizard makes. This is the same rule as gtcAccepted's
  // z.literal(true) — a claim about what a person did, which has to stand
  // behind the contract afterwards.
  if (value.reuseToken && value.identityChecked !== true) {
    context.addIssue({
      code: "custom",
      path: ["identityChecked"],
      message: "identityCheck",
    });
  }
});
```

**Note for the implementer:** `contractMetaSchema` is also used for `z.infer`. Confirm `ContractMeta` still resolves after the `.superRefine`, which returns a `ZodEffects` — `z.infer` handles it, but any code calling `.extend()` or `.shape` on it will need the base object extracted to a named const first. Search for both before committing.

- [ ] **Step 4: Wire the route**

In `app/api/rental-contract/route.ts`, add the import:

```ts
import { readReuseToken } from "@/lib/rental/reuseToken";
```

After the `meta` parse (line 87), resolve the token:

```ts
  // Verified before anything is uploaded, so a stale token costs nothing.
  let reuseFromContractId: string | undefined;
  if (meta.reuseToken) {
    const contractId = readReuseToken(meta.reuseToken);
    if (!contractId) {
      // Expired, forged, or signed with a rotated secret. The wizard sends the
      // operator back to capture fresh photographs rather than guessing.
      return NextResponse.json({ code: "reuse-expired" }, { status: 400 });
    }
    reuseFromContractId = contractId;
  }
```

And pass both through to `persistPickup`:

```ts
    saved = await persistPickup({
      organisationId: organisation.id,
      details: meta.details,
      vehicleSlug: meta.details.vehicleId,
      uploads,
      pdf: { body: pdfBytes },
      store: getAssetStore(),
      reuseFromContractId,
      identityCheckedAt: reuseFromContractId ? new Date() : undefined,
    });
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test:db -- rentalContractReuse`
Expected: PASS, 4 tests.

Then the whole suite: `pnpm test:all`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/rental/schema.ts app/api/rental-contract/route.ts \
  tests/db/rentalContractReuse.test.ts
git commit -m "feat: accept a verified reuse token on the contract endpoint"
```

---

### Task 10: The wizard

**Files:**
- Modify: `components/rental/RentalPickupWizard.tsx` — state (~168-200), `validateStep` (447-451), step 3 body (1000+), step 4 body (1175+), submit (617-660)
- Modify: `lib/rental/labels.ts` — `de.details`/`en.details`, `de.documents`/`en.documents`, `de.errors`/`en.errors`

**Interfaces:**
- Consumes: `POST /api/customers/lookup/` (6), `reuseToken` and `identityChecked` on the meta (9), `documentsOnFile` on the PDF input (8).
- Produces: no exports. This is the last task that can be verified by hand.

- [ ] **Step 1: Add the labels**

In `lib/rental/labels.ts`, add to `de.details`:

```ts
    lookup: "Prüfen",
    lookupChecking: "Wird geprüft …",
    lookupFound: "Bestandskunde — {count} Mietverträge seit {since}",
    lookupNone: "Kein Eintrag zu dieser Nummer. Bitte neu erfassen.",
    lookupFailed: "Prüfung nicht möglich. Bitte Daten von Hand erfassen.",
    lookupPick: "Mehrere Einträge zu dieser Nummer — bitte auswählen:",
```

to `en.details`:

```ts
    lookup: "Check",
    lookupChecking: "Checking …",
    lookupFound: "Returning customer — {count} rentals since {since}",
    lookupNone: "No record for this number. Please enter the details.",
    lookupFailed: "Could not check. Please enter the details by hand.",
    lookupPick: "More than one record for this number — please choose:",
```

to `de.documents`:

```ts
    onFile: "Dokumente aus Vertrag {contract} vom {signed} werden übernommen.",
    onFileFresh: "Stattdessen neu aufnehmen",
    onFileAttest:
      "Ich habe Ausweis und Führerschein im Original gesehen; beide sind gültig.",
```

to `en.documents`:

```ts
    onFile: "Documents from contract {contract} of {signed} will be reused.",
    onFileFresh: "Use fresh photos instead",
    onFileAttest:
      "I have seen the original ID and driving licence today and they are valid.",
```

and to both `errors` blocks — `de.errors`:

```ts
    identityCheck: "Bitte bestätigen, dass die Originale geprüft wurden.",
```

`en.errors`:

```ts
    identityCheck: "Please confirm the originals were checked.",
```

- [ ] **Step 2: Add the state**

Near the other `useState` calls in `RentalPickupWizard.tsx`:

```ts
  /**
   * What the lookup found, if the operator pressed Check.
   *
   * `null` means not looked up or nothing found — both lead to typing the
   * details, which is why they are not distinguished here.
   */
  const [onFile, setOnFile] = useState<{
    contractNumber: string;
    signedAt: string;
    reuseToken: string;
  } | null>(null);
  const [identityChecked, setIdentityChecked] = useState(false);
  const [lookupState, setLookupState] = useState<
    "idle" | "checking" | "none" | "failed"
  >("idle");
  const [candidates, setCandidates] = useState<LookupMatch[] | null>(null);
```

with the response type declared above the component:

```ts
/** One row from POST /api/customers/lookup. */
interface LookupMatch {
  firstName: string;
  lastName: string;
  birthDate: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  rentalCount: number;
  firstRentalAt: string | null;
  documentsOnFile: {
    contractNumber: string;
    signedAt: string;
    reuseToken: string;
  } | null;
}
```

- [ ] **Step 3: Add the lookup handler**

```ts
  async function checkPhone() {
    setLookupState("checking");
    setCandidates(null);
    try {
      const response = await fetch("/api/customers/lookup/", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(applyKey ? { [APPLY_KEY_HEADER]: applyKey } : {}),
        },
        body: JSON.stringify({ phone: form.mobile }),
      });
      if (!response.ok) throw new Error(String(response.status));

      const matches: LookupMatch[] = (await response.json()).matches;
      if (matches.length === 0) {
        setLookupState("none");
        return;
      }
      if (matches.length > 1) {
        // Rare, and the person is standing right there — so the operator
        // chooses rather than the form guessing.
        setCandidates(matches);
        setLookupState("idle");
        return;
      }
      applyMatch(matches[0]);
    } catch {
      // A failed lookup must never block a handover. The form stays usable.
      setLookupState("failed");
    }
  }

  function applyMatch(match: LookupMatch) {
    setForm((previous) => ({
      ...previous,
      lastName: match.lastName,
      firstName: match.firstName,
      birthDate: match.birthDate,
      street: match.street,
      postalCode: match.postalCode,
      city: match.city,
      country: match.country,
      email: match.email,
    }));
    setOnFile(match.documentsOnFile);
    setIdentityChecked(false);
    setCandidates(null);
    setLookupState("idle");
  }
```

**Note for the implementer:** `setForm` and the `birthDate` field — step 3 stores the birth date as a typed string parsed by `parseTypedDate`, not as an ISO date. Check what `form.birthDate` holds and convert `match.birthDate` into the same shape, or the prefilled value will fail `validateStep(3)`.

- [ ] **Step 4: Render the Check button and banner in step 3**

Immediately after the mobile `Field` in the step 3 body, alongside it:

```tsx
              <div className="flex items-end gap-2">
                <Field label={L.details.mobile} error={errors.mobile} required>
                  <Input
                    value={form.mobile}
                    onChange={(e) => {
                      set("mobile", e.target.value);
                      // A changed number invalidates what the last one found.
                      setOnFile(null);
                      setLookupState("idle");
                    }}
                    placeholder="+41 79 123 45 67"
                  />
                </Field>
                <button
                  type="button"
                  onClick={checkPhone}
                  disabled={lookupState === "checking" || !form.mobile.trim()}
                  className="h-10 shrink-0 rounded-md border border-slate-300 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {lookupState === "checking"
                    ? L.details.lookupChecking
                    : L.details.lookup}
                </button>
              </div>

              {onFile && (
                <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
                  {L.documents.onFile
                    .replace("{contract}", onFile.contractNumber)
                    .replace("{signed}", onFile.signedAt)}
                </p>
              )}
              {lookupState === "none" && (
                <p className="text-sm text-slate-500">{L.details.lookupNone}</p>
              )}
              {lookupState === "failed" && (
                <p className="text-sm text-amber-700">
                  {L.details.lookupFailed}
                </p>
              )}

              {candidates && (
                <div className="space-y-2 rounded-lg border border-slate-200 p-3">
                  <p className="text-sm text-slate-700">
                    {L.details.lookupPick}
                  </p>
                  {candidates.map((match) => (
                    <button
                      key={match.email}
                      type="button"
                      onClick={() => applyMatch(match)}
                      className="block w-full rounded-md border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50"
                    >
                      {match.firstName} {match.lastName} · {match.birthDate}
                    </button>
                  ))}
                </div>
              )}
```

**Note:** the existing mobile `Field` must be *replaced* by this block, not duplicated. Find it in the step 3 body first.

- [ ] **Step 5: Collapse the document slots in step 4**

Wrap the existing `DOCUMENT_SLOTS` rendering in step 4:

```tsx
              {onFile ? (
                <div className="space-y-3 rounded-lg bg-slate-50 p-4">
                  <p className="text-sm text-slate-700">
                    {L.documents.onFile
                      .replace("{contract}", onFile.contractNumber)
                      .replace("{signed}", onFile.signedAt)}
                  </p>

                  <label className="flex items-start gap-2 text-sm text-slate-800">
                    <input
                      type="checkbox"
                      checked={identityChecked}
                      onChange={(e) => setIdentityChecked(e.target.checked)}
                      className="mt-1"
                    />
                    <span>{L.documents.onFileAttest}</span>
                  </label>
                  {errors.identityChecked && (
                    <p className="text-sm text-red-600">
                      {errors.identityChecked}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setOnFile(null);
                      setIdentityChecked(false);
                    }}
                    className="text-sm text-slate-600 underline"
                  >
                    {L.documents.onFileFresh}
                  </button>
                </div>
              ) : (
                /* the existing DOCUMENT_SLOTS grid, unchanged */
              )}
```

- [ ] **Step 6: Update `validateStep`**

Replace the `target === 4` block:

```ts
    if (target === 4) {
      if (onFile) {
        // The photographs are not required, but the attestation that replaces
        // them is — the server enforces the same rule.
        if (!identityChecked) found.identityChecked = L.errors.identityCheck;
      } else {
        for (const slot of DOCUMENT_SLOTS) {
          if (!documents[slot.key]) found[slot.key] = L.errors[slot.error];
        }
      }
    }
```

- [ ] **Step 7: Update the submit path**

In the submit function, guard the document append and pass the new meta. Replace the `DOCUMENT_SLOTS` append loop:

```ts
      if (!onFile) {
        for (const slot of DOCUMENT_SLOTS) {
          body.append(`asset:${SLOT_TO_KIND[slot.key]}`, docs[slot.key]!.blob);
        }
      }
```

and add to the object serialised into `meta`:

```ts
        reuseToken: onFile?.reuseToken,
        identityChecked: onFile ? identityChecked : undefined,
```

Then pass the reference to the PDF builder, where the five images are currently read:

```ts
        documentsOnFile: onFile
          ? {
              contractNumber: onFile.contractNumber,
              signedAt: onFile.signedAt,
              checkedAt: new Date().toISOString().slice(0, 10),
            }
          : undefined,
```

**Note for the implementer:** find where `buildContractPdf` is called and make the five `*Photo` arguments conditional on `!onFile`, since they are now optional. TypeScript will point at each site.

- [ ] **Step 8: Verify by hand**

```bash
pnpm db:up && pnpm db:seed && pnpm dev
```

Open `http://localhost:3000/pickup/?k=<APPLY_SECRET from .env.local>` and:

1. Complete a full pickup for a new customer with all five documents. Confirm the contract records and the PDF has five image pages.
2. Free the car: `UPDATE "Car" SET status = 'available';`
3. Start a second pickup. On step 3 type the same number in a *different format* (`079 123 45 67` if you first used `+41 79…`) and press Check. Confirm the fields fill and the banner appears.
4. On step 4, confirm the slots are replaced by the summary, and that Next is refused until the attestation is ticked.
5. Submit. Confirm the PDF has a reference page instead of five image pages, and:

```sql
SELECT c."contractNumber", c."documentsReusedFromId", c."identityCheckedAt",
       (SELECT count(*) FROM "Asset" a WHERE a."contractId" = c.id) AS assets
FROM "Contract" c ORDER BY c."signedAt";
```

Expected: the second row has a non-null `documentsReusedFromId`, a timestamp, and 6 assets.

6. Press Check on a number nobody has used. Confirm the "no record" line and that the form is still fully usable.

- [ ] **Step 9: Run the whole suite and commit**

Run: `pnpm test:all && pnpm lint`
Expected: PASS.

```bash
git add components/rental/RentalPickupWizard.tsx lib/rental/labels.ts
git commit -m "feat: recognise a returning customer at the pickup desk"
```

---

### Task 11: Retention and privacy

**Files:**
- Modify: `docs/DATA-RETENTION.md`
- Modify: `components/Privacy.tsx` (and `app/privacy/page.tsx` if the copy lives there)

**Interfaces:** none. Documentation and user-facing copy.

- [ ] **Step 1: Rewrite the retention section**

In `docs/DATA-RETENTION.md`, replace the `## Retention` section — which currently opens `**OPEN — requires the owner's sign-off. Do not deploy to production without a number here.**` — with:

```markdown
## Retention

**Agreed by the owner, 2026-08-22.** This closes open question 1 in the
persistence spec and the roadmap.

- **Everything about the person: five years** after the rental ends. The
  `Customer` row, the identity and licence photographs, the portrait, the
  signature image and the condition photographs.
- **The contract PDF and the rental records: ten years**, matching the Swiss
  commercial record-keeping obligation under OR 958f. This is a floor, not a
  preference, and it overrides the five-year rule for these two.

This replaces the earlier proposal of 90 days for identity images and two years
for condition photographs. One clock is enforceable in a way that three are
not, and the condition photographs are not the sensitive part.

Two consequences, recorded because they are easy to discover late:

- **Passport and licence scans are held for five years.** This is the
  highest-risk data in the system, and "it saves typing at the desk" is a weak
  proportionality argument under the revised DSG. It was chosen deliberately,
  with the trade-off named, to make returning-customer document reuse possible.
- **A regular customer's documents live five years past their _last_ rental.**
  Reuse copies rather than shares, so each new contract starts a fresh clock on
  its own copy. For someone who rents every summer, the effective retention is
  indefinite. The privacy notice must not imply otherwise.

No deletion job exists yet. Until one ships, deletion is manual and the clock is
documented rather than enforced — which is why the periods had to be agreed
before the first hundred contracts rather than after.
```

- [ ] **Step 2: Update the "What is stored" table**

Add a row to the table in `docs/DATA-RETENTION.md`, and note the reuse in the Object-keys paragraph:

```markdown
| Lookup audit: salted hash of a phone number, match count | Postgres | Showing who was looked up, without a second copy of the customer list |
```

- [ ] **Step 3: Rewrite the privacy page**

`components/Privacy.tsx` currently describes a system that stores nothing. It must now say, in plain language and in the page's existing voice and languages:

1. What is held: name, address, date of birth, phone, email; photographs of ID or passport, driving licence and the renter; photographs of the vehicle; the signed contract.
2. Where: servers in the European Union (database in Frankfurt, files in an EU-restricted bucket). No transfer outside the EU or Switzerland.
3. How long: five years after the rental for personal data and documents; ten years for the signed contract, as Swiss commercial law requires.
4. That documents are reused: "if you rent from us again, we may use the identity documents we already hold rather than photographing them again."
5. How to ask for a copy or deletion, and that the signed contract cannot be deleted before its ten years are up.
6. That card details are never held — payment goes through a hosted link.

**Do not invent a contact address.** Use whatever address the site already
publishes; if there is none, leave a clearly marked placeholder and raise it,
because a privacy notice with no route to exercise a right is not compliant.

- [ ] **Step 4: Verify**

Run: `pnpm lint && pnpm build`
Expected: PASS.

Open `http://localhost:3000/privacy/` in each language the page supports and read it through.

- [ ] **Step 5: Commit**

```bash
git add docs/DATA-RETENTION.md components/Privacy.tsx app/privacy/page.tsx
git commit -m "docs: set retention at five years and say so on the privacy page"
```

---

## Self-review

**Spec coverage.** Decision 1 → Task 1 (normaliser) and Task 3 (column, index, backfill, `upsertCustomer`). Decision 2 → Task 2 (token) and Task 6 (issued on lookup), verified in Task 9. Decision 3 → Task 4 (`copy`) and Task 7 (`copyDocumentsForward`, `persistPickup`). Decision 4 → Task 8 (optional images, reference page, guard). Decision 5 → Task 8 (printed), Task 9 (enforced server-side), Task 10 (the tick). Decision 6 → Task 5 (all-five and window checks) and Task 7 (re-checked at copy time). Decision 7 → Task 11. Data model → Task 3. Data flow → Tasks 6 and 9. Wizard → Task 10. Error-handling table → Task 6 (unnormalisable, unreachable), Task 9 (expired token), Task 7 (missing object, partial set). Follow-on work → Task 11.

**Type consistency.** `documentsOnFile` carries `contractId` inside `findCustomers.ts` (Task 5) and is deliberately reshaped to `reuseToken` at the route boundary (Task 6); the browser type in Task 10 matches the route's shape, not the library's. `REUSABLE_KINDS` is declared once in `findCustomers.ts` and imported by `reuseDocuments.ts`. `StoredAsset` is the existing type from `lib/storage/upload.ts` and is what `copyDocumentsForward` returns, so `[...stored, ...carried]` in `persistPickup` is homogeneous.

**Known soft spots**, flagged rather than hidden — each has a note at the point of use:

- Task 5's tests assume a second seeded vehicle slug (`corolla-zh589864`). Verify against `prisma/seed.ts`.
- Task 8 assumes `Writer` exposes `newPage`, `sectionTitle`, `text` and `gap`, and does not know `buildContractPdf`'s full parameter list.
- Task 9's `.superRefine` changes `contractMetaSchema` from a `ZodObject` to a `ZodEffects`. Any existing `.extend()` or `.shape` access on it must be found first.
- Task 10's `form.birthDate` may hold a typed string rather than an ISO date, so the prefill needs converting.
