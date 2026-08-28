# Admin Accounts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fleet dashboard's single shared code with named accounts in two roles, and rewrite the dashboard around them in German and English.

**Architecture:** An `AdminUser` table with scrypt-hashed passwords. The session stays a signed cookie but carries the user id and its issue time, so validation reads the user on every request — which is what makes disabling somebody and changing a password take effect immediately rather than in twelve hours. `ADMIN_SECRET` keeps its name and narrows from being the password to signing sessions.

**Tech Stack:** Next.js 15 App Router, Prisma 7 with the `PrismaPg` adapter, Postgres, Zod, `node:crypto` scrypt, Vitest (two projects: `unit` needs nothing, `db` needs `pnpm db:up`), Tailwind.

**Spec:** `docs/superpowers/specs/2026-08-28-admin-accounts-design.md`

## Global Constraints

- **No new dependencies.** Password hashing uses `scrypt` from `node:crypto`. Do not add `bcrypt`, `bcryptjs` or `argon2`.
- **Hash format:** `scrypt$N$r$p$<salt base64url>$<hash base64url>`. Parameters are read from the stored string, never from a constant.
- **scrypt parameters for new hashes:** `N=16384, r=8, p=1`, 32-byte key, 16-byte salt.
- **`ADMIN_SECRET` keeps its name.** It signs sessions. Do not rename it; four deployed environments already set it.
- **Every credential comparison uses `timingSafeEqual`**, guarded on length first. Never `===`.
- **Fail closed.** A missing secret, a missing user, a wrong password, a disabled account: all answer `401 {"code":"unauthorised"}`. One answer, so a caller learns only that they are not in.
- **`createdBy` stays `"office"`** on rentals and contracts. Do not attempt to thread a user into `persistPickup` or `persistReturn`; both are reached from public forms with no signed-in user. See spec decision 6.
- **German is the default language.** English is a toggle, remembered in `localStorage`.
- **Migrations are additive.** Nothing existing changes shape. Use `pnpm db:migrate` locally; never `prisma migrate dev` against a deployed database.
- **Tests:** `pnpm test` (unit), `pnpm test:db` (needs `pnpm db:up`), `pnpm test:all`. All must pass before each commit.

---

### Task 1: Password hashing

Pure, no database. Everything else depends on it.

**Files:**
- Create: `lib/admin/password.ts`
- Test: `lib/admin/password.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `hashPassword(password: string, params?: ScryptParams): Promise<string>`
  - `passwordMatches(password: string, stored: string): Promise<boolean>`
  - `SCRYPT: { readonly N: 16384; readonly r: 8; readonly p: 1 }`
  - `type ScryptParams = { N: number; r: number; p: number }`

- [ ] **Step 1: Write the failing test**

Create `lib/admin/password.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { hashPassword, passwordMatches, SCRYPT } from "./password";

describe("hashPassword", () => {
  it("produces a self-describing hash", async () => {
    const stored = await hashPassword("correct horse");
    const parts = stored.split("$");
    expect(parts[0]).toBe("scrypt");
    expect(Number(parts[1])).toBe(SCRYPT.N);
    expect(Number(parts[2])).toBe(SCRYPT.r);
    expect(Number(parts[3])).toBe(SCRYPT.p);
    expect(parts).toHaveLength(6);
  });

  it("salts, so the same password hashes differently every time", async () => {
    const a = await hashPassword("correct horse");
    const b = await hashPassword("correct horse");
    expect(a).not.toBe(b);
    expect(await passwordMatches("correct horse", a)).toBe(true);
    expect(await passwordMatches("correct horse", b)).toBe(true);
  });
});

describe("passwordMatches", () => {
  it("accepts the right password", async () => {
    const stored = await hashPassword("Sommer2026!");
    expect(await passwordMatches("Sommer2026!", stored)).toBe(true);
  });

  it("refuses the wrong one, including near misses", async () => {
    const stored = await hashPassword("Sommer2026!");
    expect(await passwordMatches("sommer2026!", stored)).toBe(false);
    expect(await passwordMatches("Sommer2026", stored)).toBe(false);
    expect(await passwordMatches("", stored)).toBe(false);
  });

  it("verifies a hash written at a lower cost, so the cost can be raised later", async () => {
    // The whole point of storing parameters: an old hash keeps working.
    const cheap = await hashPassword("Sommer2026!", { N: 1024, r: 8, p: 1 });
    expect(cheap).toContain("$1024$");
    expect(await passwordMatches("Sommer2026!", cheap)).toBe(true);
  });

  it("refuses a malformed stored value rather than throwing", async () => {
    for (const bad of [
      "",
      "not-a-hash",
      "scrypt$16384$8$1$onlyfiveparts",
      "bcrypt$16384$8$1$aaaa$bbbb",
      "scrypt$notanumber$8$1$aaaa$bbbb",
    ]) {
      expect(await passwordMatches("Sommer2026!", bad)).toBe(false);
    }
  });

  it("refuses absurd parameters instead of allocating gigabytes", async () => {
    // A tampered row must not be able to turn a login into a memory bomb.
    const bomb = "scrypt$1073741824$32$16$aaaa$bbbb";
    expect(await passwordMatches("Sommer2026!", bomb)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project unit lib/admin/password.test.ts`
Expected: FAIL — `Failed to resolve import "./password"`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/admin/password.ts`:

```ts
/**
 * Password hashing for the fleet dashboard's accounts.
 *
 * scrypt from `node:crypto`, which is the same module every other credential
 * in this codebase already goes through — `createHmac` for the session cookie,
 * `timingSafeEqual` for the write fence, `randomBytes` for action tokens. No
 * new dependency, and nothing native to fail on a serverless build.
 *
 * The stored value carries its own parameters:
 *
 *   scrypt$16384$8$1$<salt base64url>$<hash base64url>
 *
 * Reading the cost out of the hash rather than a constant is what lets it be
 * raised later: new passwords get the new cost, existing ones keep verifying.
 * A constant would silently invalidate every password the day somebody edited
 * it.
 */

import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

export interface ScryptParams {
  N: number;
  r: number;
  p: number;
}

/** What new passwords are hashed with. Raise freely; old hashes keep working. */
export const SCRYPT: Readonly<ScryptParams> = { N: 16384, r: 8, p: 1 };

const KEY_BYTES = 32;
const SALT_BYTES = 16;

/**
 * Ceiling for scrypt's memory, and a real guard rather than a formality.
 *
 * Cost is roughly `128 * N * r` bytes — 16 MB at our parameters. A tampered
 * `passwordHash` naming N = 2^30 would otherwise ask Node for gigabytes on
 * a login attempt, so the parameters are bounded before they are used.
 */
const MAX_MEM = 64 * 1024 * 1024;
const MAX_N = 1 << 20;
const MAX_R = 32;
const MAX_P = 16;

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptParams & { maxmem: number }
) => Promise<Buffer>;

function derive(
  password: string,
  salt: Buffer,
  keylen: number,
  params: ScryptParams
): Promise<Buffer> {
  return scrypt(password, salt, keylen, { ...params, maxmem: MAX_MEM });
}

export async function hashPassword(
  password: string,
  params: ScryptParams = SCRYPT
): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await derive(password, salt, KEY_BYTES, params);
  return [
    "scrypt",
    params.N,
    params.r,
    params.p,
    salt.toString("base64url"),
    key.toString("base64url"),
  ].join("$");
}

function parseStored(
  stored: string
): { params: ScryptParams; salt: Buffer; key: Buffer } | null {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return null;

  const params = { N: Number(parts[1]), r: Number(parts[2]), p: Number(parts[3]) };
  if (
    !Number.isInteger(params.N) ||
    !Number.isInteger(params.r) ||
    !Number.isInteger(params.p) ||
    params.N < 2 ||
    params.r < 1 ||
    params.p < 1 ||
    params.N > MAX_N ||
    params.r > MAX_R ||
    params.p > MAX_P
  ) {
    return null;
  }

  const salt = Buffer.from(parts[4], "base64url");
  const key = Buffer.from(parts[5], "base64url");
  if (salt.length === 0 || key.length === 0) return null;

  return { params, salt, key };
}

/**
 * Returns false rather than throwing on a malformed stored value.
 *
 * The caller is a login handler, and a corrupt row should refuse the sign-in,
 * not return a 500 that tells an attacker they found something interesting.
 */
export async function passwordMatches(
  password: string,
  stored: string
): Promise<boolean> {
  const parsed = parseStored(stored);
  if (!parsed) return false;

  let actual: Buffer;
  try {
    actual = await derive(password, parsed.salt, parsed.key.length, parsed.params);
  } catch {
    return false;
  }

  // Guarded, because timingSafeEqual throws on a length mismatch — which would
  // itself leak the length.
  if (actual.length !== parsed.key.length) return false;
  return timingSafeEqual(actual, parsed.key);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project unit lib/admin/password.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/admin/password.ts lib/admin/password.test.ts
git commit -m "feat(admin): hash passwords with scrypt from node:crypto

Parameters travel with the hash so the cost can be raised later without
invalidating existing passwords, and are bounded on the way back in so a
tampered row cannot turn a login into a memory bomb."
```

---

### Task 2: Schema and migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_admin_accounts/migration.sql` (generated)

**Interfaces:**
- Consumes: nothing.
- Produces: Prisma model `AdminUser`, enum `AdminRole` (`owner` | `staff`), and `SubmissionAttempt.scope: string` defaulting to `"pickup"`. Generated types come from `@/generated/prisma/client`.

- [ ] **Step 1: Add the enum and model**

In `prisma/schema.prisma`, after the `AssetKind` enum, add:

```prisma
enum AdminRole {
  owner
  staff
}
```

At the end of the file, add:

```prisma
// ---------------------------------------------------------------------
// Phase 5, stage 1 — accounts for the fleet dashboard.
// See docs/superpowers/specs/2026-08-28-admin-accounts-design.md
// ---------------------------------------------------------------------

/// A person who can sign into the fleet page.
///
/// Disabled, never deleted: a rental event saying this person closed a rental
/// has to keep resolving after they leave the company.
model AdminUser {
  id             String @id @default(cuid())
  organisationId String

  /// Lowercased and trimmed on write. `[a-z0-9._-]{3,32}`.
  username String
  /// What attribution shows, e.g. "Eng Ahmed".
  displayName String
  role        AdminRole @default(staff)

  /// `scrypt$N$r$p$salt$hash`. See lib/admin/password.ts.
  passwordHash String

  /// Set to disable. Read on every request, so it takes effect at once.
  disabledAt DateTime?

  /// Bumped when the password changes, which invalidates every cookie issued
  /// before it.
  ///
  /// Deliberately not bumped on a role change: the cookie carries no role, so
  /// a demotion is already in force on the demoted person's next request.
  credentialsChangedAt DateTime @default(now())

  lastSignInAt DateTime?
  createdAt    DateTime  @default(now())
  /// The owner who created this account. Null for the seeded one.
  createdById String?

  organisation Organisation @relation(fields: [organisationId], references: [id])

  @@unique([organisationId, username])
  @@index([organisationId, disabledAt])
}
```

- [ ] **Step 2: Add the back-relation and the limiter scope**

In the `Organisation` model, add to the relation list:

```prisma
  adminUsers AdminUser[]
```

Replace the `SubmissionAttempt` model with:

```prisma
/// Client IPs are hashed, never stored, so the rate limiter is not itself a
/// store of personal data.
model SubmissionAttempt {
  id String @id @default(cuid())

  ipHash String
  /// Which fence recorded this attempt: "pickup", "signin".
  ///
  /// Added in Phase 5. A shared budget lets a burst against one endpoint
  /// starve another — the reasoning already written in
  /// app/api/rental-return/route.ts for keeping that route's limiter its own.
  scope     String   @default("pickup")
  createdAt DateTime @default(now())

  @@index([scope, ipHash, createdAt])
}
```

- [ ] **Step 3: Generate and apply the migration**

Run:

```bash
pnpm db:up
pnpm db:migrate --name admin_accounts
```

Expected: a new directory under `prisma/migrations/`, and `prisma generate` runs. Confirm the SQL only contains `CREATE TYPE`, `CREATE TABLE`, `ALTER TABLE ... ADD COLUMN`, `CREATE INDEX` — no `DROP`.

- [ ] **Step 4: Verify the client typechecks**

Run: `npx tsc --noEmit`
Expected: exit 0. The old `@@index([ipHash, createdAt])` is gone; nothing referenced it by name.

- [ ] **Step 5: Run the existing suites to prove the migration broke nothing**

Run: `pnpm test:all`
Expected: PASS, 32 files / 314 tests. Add `"AdminUser"` to the `TRUNCATE` list in `tests/db/setup.ts` if any test leaks rows between files — check first, since `CASCADE` from `Organisation` already reaches it.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations tests/db/setup.ts
git commit -m "feat(db): add AdminUser and a scope for the rate limiter

Both changes additive. The limiter gains a scope because a sign-in endpoint
must not share a per-IP budget with the pickup form: a burst against one
would otherwise starve the other."
```

---

### Task 3: Give the rate limiter its own budget per endpoint

**Files:**
- Modify: `lib/rental/rateLimit.ts`
- Modify: `app/api/rental-contract/route.ts` (pass the scope explicitly)
- Test: `tests/db/rateLimit.test.ts` (add cases)

**Interfaces:**
- Consumes: `SubmissionAttempt.scope` from Task 2.
- Produces: `rateLimited(client, ip, now?, options?)` where `options: { scope?: string; max?: number; windowMs?: number }`. `now` stays the **third positional** parameter so the six existing calls in `tests/db/rateLimit.test.ts` keep compiling.

- [ ] **Step 1: Write the failing test**

Append to `tests/db/rateLimit.test.ts`, inside the existing top-level `describe`:

```ts
  it("keeps a separate budget per scope", async () => {
    const ip = "198.51.100.9";
    // Exhaust the sign-in budget.
    for (let i = 0; i <= 10; i += 1) {
      await rateLimited(prisma, ip, undefined, { scope: "signin", max: 10 });
    }
    expect(
      await rateLimited(prisma, ip, undefined, { scope: "signin", max: 10 })
    ).toBe(true);

    // The pickup form is untouched by that burst.
    expect(await rateLimited(prisma, ip)).toBe(false);
  });

  it("honours a custom max", async () => {
    const ip = "198.51.100.10";
    for (let i = 0; i <= 1; i += 1) {
      await rateLimited(prisma, ip, undefined, { scope: "signin", max: 1 });
    }
    expect(
      await rateLimited(prisma, ip, undefined, { scope: "signin", max: 1 })
    ).toBe(true);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project db tests/db/rateLimit.test.ts`
Expected: FAIL — the fourth argument is not accepted, or the scopes share a budget.

- [ ] **Step 3: Write minimal implementation**

In `lib/rental/rateLimit.ts`, replace `rateLimited` with:

```ts
export interface RateLimitOptions {
  /** Which fence is asking. Budgets never cross scopes. */
  scope?: string;
  max?: number;
  windowMs?: number;
}

/**
 * Records this attempt and reports whether it should be refused.
 *
 * Records first, then counts, so a failure between the two cannot be turned
 * into a free attempt. Expired rows are deleted on the way past, which keeps
 * the table bounded without a scheduled job.
 *
 * `now` stays the third parameter and `options` the fourth so that adding
 * scopes did not have to touch every existing call.
 */
export async function rateLimited(
  client: PrismaClient,
  ip: string,
  now: Date = new Date(),
  options: RateLimitOptions = {}
): Promise<boolean> {
  const scope = options.scope ?? "pickup";
  const max = options.max ?? RATE_LIMIT.max;
  const windowMs = options.windowMs ?? RATE_LIMIT.windowMs;

  const ipHash = hashIp(ip);
  const windowStart = new Date(now.getTime() - windowMs);

  // Swept across every scope: an expired row is expired whoever wrote it.
  await client.submissionAttempt.deleteMany({
    where: { createdAt: { lt: windowStart } },
  });

  await client.submissionAttempt.create({
    data: { ipHash, scope, createdAt: now },
  });

  const attempts = await client.submissionAttempt.count({
    where: { scope, ipHash, createdAt: { gte: windowStart } },
  });

  return attempts > max;
}
```

Note the `now: Date = new Date()` default means `rateLimited(prisma, ip, undefined, {...})` works as the test expects.

- [ ] **Step 4: Make the pickup route's scope explicit**

In `app/api/rental-contract/route.ts`, change:

```ts
  if (await rateLimited(prisma, clientIp(request))) {
```

to:

```ts
  if (await rateLimited(prisma, clientIp(request), new Date(), { scope: "pickup" })) {
```

Explicit rather than relying on the default, so the two scopes read symmetrically at their call sites.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run --project db tests/db/rateLimit.test.ts && npx tsc --noEmit`
Expected: PASS, 10 tests; tsc exit 0.

- [ ] **Step 6: Commit**

```bash
git add lib/rental/rateLimit.ts app/api/rental-contract/route.ts tests/db/rateLimit.test.ts
git commit -m "feat(rental): scope the rate limiter per endpoint"
```

---

### Task 4: Bind the session to a user, and make the guard async

The wide, shallow edit. Nothing compiles halfway through, so it is one task.

**Files:**
- Modify: `lib/admin/session.ts`
- Modify: `lib/admin/session.test.ts` (rewrite — `adminSecretValid` is gone)
- Modify: `app/api/admin/overview/route.ts:56`, `app/api/admin/cars/route.ts:19`, `app/api/admin/cars/[id]/route.ts:22`, `app/api/admin/rentals/[id]/close/route.ts:27`
- Create: `tests/db/adminSession.test.ts`

**Interfaces:**
- Consumes: `AdminUser` from Task 2.
- Produces:
  - `interface AdminIdentity { id: string; username: string; displayName: string; role: "owner" | "staff" }`
  - `issueAdminSession(userId: string, now?: Date): string`
  - `readAdminCookie(token: string | undefined, now?: Date): { userId: string; issuedAt: number } | null`
  - `requireAdmin(request: Request, now?: Date): Promise<AdminIdentity | null>`
  - `requireOwner(request: Request, now?: Date): Promise<AdminIdentity | null>`
  - `ADMIN_COOKIE`, `ADMIN_SESSION_TTL_MS` unchanged.
  - **Removed:** `adminSecretValid`, `adminSessionValid`, `requestIsAdmin`.

- [ ] **Step 1: Write the failing unit test**

Replace `lib/admin/session.test.ts` entirely:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import {
  ADMIN_SESSION_TTL_MS,
  issueAdminSession,
  readAdminCookie,
} from "./session";

const NOW = new Date("2026-08-28T08:00:00.000Z");
const USER = "clx0000000000000000000000";

beforeEach(() => {
  process.env.ADMIN_SECRET = "signing-key-for-tests";
});

describe("issueAdminSession", () => {
  it("round-trips the user id and the issue time", () => {
    const token = issueAdminSession(USER, NOW);
    const read = readAdminCookie(token, NOW);
    expect(read).toEqual({ userId: USER, issuedAt: NOW.getTime() });
  });

  it("expires", () => {
    const token = issueAdminSession(USER, NOW);
    const after = new Date(NOW.getTime() + ADMIN_SESSION_TTL_MS + 1000);
    expect(readAdminCookie(token, after)).toBeNull();
  });
});

describe("readAdminCookie", () => {
  it("refuses a rewritten expiry", () => {
    const token = issueAdminSession(USER, NOW);
    const [payload, signature] = token.split(".");
    const decoded = Buffer.from(payload, "base64url").toString("utf8");
    const forged = decoded.replace(
      String(NOW.getTime() + ADMIN_SESSION_TTL_MS),
      String(NOW.getTime() + ADMIN_SESSION_TTL_MS + 10 * 365 * 24 * 3600 * 1000)
    );
    const tampered = `${Buffer.from(forged).toString("base64url")}.${signature}`;
    expect(readAdminCookie(tampered, NOW)).toBeNull();
  });

  it("refuses a rewritten user id", () => {
    const token = issueAdminSession(USER, NOW);
    const [payload, signature] = token.split(".");
    const decoded = Buffer.from(payload, "base64url").toString("utf8");
    const forged = decoded.replace(USER, "clxSOMEBODYELSE000000000");
    const tampered = `${Buffer.from(forged).toString("base64url")}.${signature}`;
    expect(readAdminCookie(tampered, NOW)).toBeNull();
  });

  it("refuses a token signed with a different key", () => {
    const token = issueAdminSession(USER, NOW);
    process.env.ADMIN_SECRET = "rotated";
    expect(readAdminCookie(token, NOW)).toBeNull();
  });

  it("refuses nonsense and absence without throwing", () => {
    for (const bad of [undefined, "", "no-dot", "a.b.c", "...."]) {
      expect(readAdminCookie(bad, NOW)).toBeNull();
    }
  });

  it("refuses everything when ADMIN_SECRET is unset", () => {
    const token = issueAdminSession(USER, NOW);
    delete process.env.ADMIN_SECRET;
    expect(readAdminCookie(token, NOW)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project unit lib/admin/session.test.ts`
Expected: FAIL — `readAdminCookie` is not exported, and `issueAdminSession` takes no user id.

- [ ] **Step 3: Rewrite the session module**

Replace everything in `lib/admin/session.ts` from the `secret()` helper downwards, keeping the file's existing header comment and updating its first paragraph to say what `ADMIN_SECRET` now does:

```ts
/**
 * The fence around the fleet admin page.
 *
 * `ADMIN_SECRET` is no longer the password. From Phase 5 it signs sessions:
 * people sign in with their own username and password against `AdminUser`,
 * and this key is what makes the resulting cookie unforgeable. It keeps its
 * name because four deployed environments already set it, and renaming it
 * would break every one of them for no gain.
 *
 * IMPORTANT: still deliberately NOT `APPLY_SECRET`. That one is pasted into
 * WhatsApp by staff and leaks the moment a link is forwarded — see the warning
 * in lib/applyKey.ts.
 *
 * A cookie rather than `?k=` in the URL, which is what the pickup form uses:
 * that link is opened once from a message, while this page is opened daily,
 * and a secret in a URL accumulates in history, bookmarks and referrer
 * headers.
 *
 * Rotating `ADMIN_SECRET` invalidates every cookie, which stays the way to
 * sign everybody out at once. Per-person revocation is `disabledAt`, checked
 * below on every request.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";

export const ADMIN_COOKIE = "zuriauto_admin";

/** One working day, so the office signs in once each morning. */
export const ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export interface AdminIdentity {
  id: string;
  username: string;
  displayName: string;
  role: "owner" | "staff";
}

function secret(): string {
  const value = process.env.ADMIN_SECRET;
  if (!value) throw new Error("ADMIN_SECRET is not set.");
  return value;
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

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/**
 * `admin.<userId>.<issuedAt>.<expiresAt>`, signed.
 *
 * `issuedAt` is in the payload because it is what `credentialsChangedAt` is
 * compared against: changing a password has to invalidate cookies handed out
 * before the change, and only the cookie knows when it was handed out.
 */
export function issueAdminSession(userId: string, now: Date = new Date()): string {
  const issuedAt = now.getTime();
  const payload = `admin.${userId}.${issuedAt}.${issuedAt + ADMIN_SESSION_TTL_MS}`;
  const encoded = Buffer.from(payload, "utf8").toString("base64url");
  return `${encoded}.${sign(payload)}`;
}

/**
 * Verifies the seal and the expiry, and reports what the cookie claims.
 *
 * Says nothing about whether the user still exists or is still enabled — that
 * needs the database, and lives in `requireAdmin`. Split so the signing half
 * can be tested without one.
 */
export function readAdminCookie(
  token: string | undefined,
  now: Date = new Date()
): { userId: string; issuedAt: number } | null {
  if (!token) return null;

  const parts = token.split(".");
  // base64url contains no dot, so a well-formed token has exactly two parts.
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts;
  if (!encoded || !signature) return null;

  const payload = Buffer.from(encoded, "base64url").toString("utf8");

  // Verified before anything is read out of it, so a rewritten payload never
  // reaches the parsing below.
  let expected: string;
  try {
    expected = sign(payload);
  } catch {
    // ADMIN_SECRET is unset: nothing can be verified, so nobody is signed in.
    return null;
  }
  if (!constantTimeEqual(signature, expected)) return null;

  const fields = payload.split(".");
  if (fields.length !== 4) return null;
  const [marker, userId, issuedAtRaw, expiresAtRaw] = fields;
  if (marker !== "admin" || !userId) return null;

  const issuedAt = Number(issuedAtRaw);
  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt)) return null;
  if (expiresAt <= now.getTime()) return null;

  return { userId, issuedAt };
}

export function adminCookieFrom(request: Request): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const pair of header.split(";")) {
    const [name, ...rest] = pair.trim().split("=");
    if (name === ADMIN_COOKIE) return rest.join("=");
  }
  return undefined;
}

/**
 * The signed-in user, or null.
 *
 * Reads the row on every request, which is what buys revocation a stateless
 * cookie cannot have: `disabledAt` takes effect on the next click, and a
 * password change invalidates that person's other sessions. One indexed read,
 * against a dashboard serving a handful of requests a day.
 */
export async function requireAdmin(
  request: Request,
  now: Date = new Date()
): Promise<AdminIdentity | null> {
  const claim = readAdminCookie(adminCookieFrom(request), now);
  if (!claim) return null;

  const user = await prisma.adminUser.findUnique({
    where: { id: claim.userId },
    select: {
      id: true,
      username: true,
      displayName: true,
      role: true,
      disabledAt: true,
      credentialsChangedAt: true,
    },
  });
  if (!user || user.disabledAt) return null;
  // Issued before the password last changed: a stale session.
  if (user.credentialsChangedAt.getTime() > claim.issuedAt) return null;

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
  };
}

/** As `requireAdmin`, and null unless the user is an owner. */
export async function requireOwner(
  request: Request,
  now: Date = new Date()
): Promise<AdminIdentity | null> {
  const user = await requireAdmin(request, now);
  return user?.role === "owner" ? user : null;
}
```

- [ ] **Step 4: Update the four existing route guards**

In each of `app/api/admin/overview/route.ts`, `app/api/admin/cars/route.ts`, `app/api/admin/cars/[id]/route.ts`, `app/api/admin/rentals/[id]/close/route.ts`:

Change the import from `requestIsAdmin` to `requireAdmin`, and the guard from:

```ts
  if (!requestIsAdmin(request)) {
    return NextResponse.json({ code: "unauthorised" }, { status: 401 });
  }
```

to:

```ts
  const user = await requireAdmin(request);
  if (!user) {
    return NextResponse.json({ code: "unauthorised" }, { status: 401 });
  }
```

In `app/api/admin/rentals/[id]/close/route.ts`, use the user in the event payload — replace `payload: { closedBy: "office" }` with:

```ts
        payload: { closedBy: user.username, closedByName: user.displayName },
```

- [ ] **Step 5: Typecheck and run the unit test**

Run: `npx tsc --noEmit && npx vitest run --project unit lib/admin/session.test.ts`
Expected: tsc exit 0; unit tests PASS, 8 tests.

- [ ] **Step 6: Write the database test for revocation**

Create `tests/db/adminSession.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/admin/password";
import {
  ADMIN_COOKIE,
  issueAdminSession,
  requireAdmin,
  requireOwner,
} from "@/lib/admin/session";
import { ensureOrganisation } from "@/prisma/seed";

function withCookie(token: string): Request {
  return new Request("https://example.test/api/admin/overview/", {
    headers: { cookie: `${ADMIN_COOKIE}=${token}` },
  });
}

async function makeUser(role: "owner" | "staff" = "staff") {
  const org = await ensureOrganisation(prisma);
  return prisma.adminUser.create({
    data: {
      organisationId: org.id,
      username: role === "owner" ? "chef" : "ahmed",
      displayName: role === "owner" ? "Die Chefin" : "Eng Ahmed",
      role,
      passwordHash: await hashPassword("Sommer2026!"),
    },
    select: { id: true, username: true },
  });
}

beforeEach(() => {
  process.env.ADMIN_SECRET = "signing-key-for-tests";
});

describe("requireAdmin", () => {
  it("resolves a live session to the user", async () => {
    const user = await makeUser();
    const identity = await requireAdmin(withCookie(issueAdminSession(user.id)));
    expect(identity?.username).toBe("ahmed");
    expect(identity?.role).toBe("staff");
  });

  it("refuses a cookie naming a user who does not exist", async () => {
    const token = issueAdminSession("clxdoesnotexist0000000000");
    expect(await requireAdmin(withCookie(token))).toBeNull();
  });

  it("refuses the same cookie once the user is disabled", async () => {
    const user = await makeUser();
    const token = issueAdminSession(user.id);
    expect(await requireAdmin(withCookie(token))).not.toBeNull();

    await prisma.adminUser.update({
      where: { id: user.id },
      data: { disabledAt: new Date() },
    });

    // The whole reason validation reads the row: this must not wait 12 hours.
    expect(await requireAdmin(withCookie(token))).toBeNull();
  });

  it("refuses cookies issued before the password changed", async () => {
    const user = await makeUser();
    const issuedAt = new Date("2026-08-28T08:00:00.000Z");
    const token = issueAdminSession(user.id, issuedAt);

    await prisma.adminUser.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword("Herbst2026!"),
        credentialsChangedAt: new Date("2026-08-28T09:00:00.000Z"),
      },
    });

    const later = new Date("2026-08-28T10:00:00.000Z");
    expect(await requireAdmin(withCookie(token), later)).toBeNull();

    // A fresh sign-in works.
    const fresh = issueAdminSession(user.id, later);
    expect(await requireAdmin(withCookie(fresh), later)).not.toBeNull();
  });
});

describe("requireOwner", () => {
  it("admits an owner and refuses a staff member", async () => {
    const staff = await makeUser("staff");
    expect(await requireOwner(withCookie(issueAdminSession(staff.id)))).toBeNull();

    await prisma.adminUser.deleteMany();
    const owner = await makeUser("owner");
    expect(
      await requireOwner(withCookie(issueAdminSession(owner.id)))
    ).not.toBeNull();
  });
});
```

- [ ] **Step 7: Run the database test**

Run: `npx vitest run --project db tests/db/adminSession.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 8: Run everything**

Run: `pnpm test:all`
Expected: PASS. `tests/db/adminOverview.test.ts` and `tests/db/adminCars.test.ts` will fail here because they build requests with the old `issueAdminSession()` signature and the old shared-secret sign-in — update them: create an `AdminUser` in the fixture and pass its id to `issueAdminSession(user.id)`.

- [ ] **Step 9: Commit**

```bash
git add lib/admin/session.ts lib/admin/session.test.ts tests/db/adminSession.test.ts \
        tests/db/adminOverview.test.ts tests/db/adminCars.test.ts \
        app/api/admin/overview/route.ts app/api/admin/cars/route.ts \
        "app/api/admin/cars/[id]/route.ts" "app/api/admin/rentals/[id]/close/route.ts"
git commit -m "feat(admin): bind the session to a user and check it on every request

Reading the row per request is what buys revocation a stateless cookie
cannot: disabling somebody takes effect on their next click, and changing a
password invalidates their other sessions. ADMIN_SECRET keeps its name and
narrows to signing.

Closing a rental now records who did it."
```

---

### Task 5: Sign in with a username and a password

**Files:**
- Modify: `app/api/admin/session/route.ts`
- Create: `tests/db/adminSignIn.test.ts`

**Interfaces:**
- Consumes: `passwordMatches` (Task 1), `issueAdminSession` (Task 4), `rateLimited` (Task 3).
- Produces: `POST /api/admin/session` accepting `{ username, password }`, answering `200 { ok: true, user: { username, displayName, role } }` and setting the cookie, or `401 { code: "unauthorised" }`, or `429 { code: "rate-limited" }`.

- [ ] **Step 1: Write the failing test**

Create `tests/db/adminSignIn.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/admin/session/route";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/admin/password";
import { ADMIN_COOKIE } from "@/lib/admin/session";
import { ensureOrganisation } from "@/prisma/seed";

function signIn(body: unknown, ip = "203.0.113.7"): Request {
  return new Request("https://example.test/api/admin/session/", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

async function seedUser(overrides: { disabledAt?: Date } = {}) {
  const org = await ensureOrganisation(prisma);
  return prisma.adminUser.create({
    data: {
      organisationId: org.id,
      username: "ahmed",
      displayName: "Eng Ahmed",
      role: "staff",
      passwordHash: await hashPassword("Sommer2026!"),
      ...overrides,
    },
    select: { id: true },
  });
}

beforeEach(() => {
  process.env.ADMIN_SECRET = "signing-key-for-tests";
});

describe("POST /api/admin/session", () => {
  it("signs in and sets the cookie", async () => {
    await seedUser();
    const response = await POST(signIn({ username: "ahmed", password: "Sommer2026!" }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.user).toEqual({
      username: "ahmed",
      displayName: "Eng Ahmed",
      role: "staff",
    });
    expect(response.headers.get("set-cookie")).toContain(`${ADMIN_COOKIE}=`);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  });

  it("accepts the username in any case", async () => {
    await seedUser();
    const response = await POST(signIn({ username: " AHMED ", password: "Sommer2026!" }));
    expect(response.status).toBe(200);
  });

  it("stamps lastSignInAt", async () => {
    const user = await seedUser();
    await POST(signIn({ username: "ahmed", password: "Sommer2026!" }));
    const after = await prisma.adminUser.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.lastSignInAt).not.toBeNull();
  });

  it("gives one answer for a wrong password, an unknown user and a disabled account", async () => {
    await seedUser();
    const wrong = await POST(signIn({ username: "ahmed", password: "nope" }));
    const unknown = await POST(signIn({ username: "nobody", password: "Sommer2026!" }));

    await prisma.adminUser.updateMany({ data: { disabledAt: new Date() } });
    const disabled = await POST(signIn({ username: "ahmed", password: "Sommer2026!" }));

    for (const response of [wrong, unknown, disabled]) {
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ code: "unauthorised" });
    }
  });

  it("refuses a malformed body with 400", async () => {
    const response = await POST(
      new Request("https://example.test/api/admin/session/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "not json",
      })
    );
    expect(response.status).toBe(400);
  });

  it("rate-limits repeated attempts from one address", async () => {
    await seedUser();
    let last = await POST(signIn({ username: "ahmed", password: "nope" }, "203.0.113.9"));
    for (let i = 0; i < 12; i += 1) {
      last = await POST(signIn({ username: "ahmed", password: "nope" }, "203.0.113.9"));
    }
    expect(last.status).toBe(429);

    // The pickup form's budget is untouched.
    const attempts = await prisma.submissionAttempt.count({ where: { scope: "pickup" } });
    expect(attempts).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project db tests/db/adminSignIn.test.ts`
Expected: FAIL — the route still expects `{ secret }` and answers 401.

- [ ] **Step 3: Write the implementation**

Replace the `POST` handler in `app/api/admin/session/route.ts`, keeping `cookieOptions` and `DELETE` as they are:

```ts
import { z } from "zod";
import { prisma } from "@/lib/db";
import { passwordMatches } from "@/lib/admin/password";
import { rateLimited } from "@/lib/rental/rateLimit";

/** How many sign-in attempts one address gets in ten minutes. */
const SIGNIN_MAX = 10;

const credentialsSchema = z.object({
  username: z.string().trim().toLowerCase().min(1).max(64),
  password: z.string().min(1).max(200),
});

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

export async function POST(request: Request) {
  let credentials;
  try {
    credentials = credentialsSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ code: "bad-request" }, { status: 400 });
  }

  // Its own budget, so a burst here cannot lock the office out of the pickup
  // form and vice versa.
  if (
    await rateLimited(prisma, clientIp(request), new Date(), {
      scope: "signin",
      max: SIGNIN_MAX,
    })
  ) {
    return NextResponse.json({ code: "rate-limited" }, { status: 429 });
  }

  const user = await prisma.adminUser.findFirst({
    where: { username: credentials.username, disabledAt: null },
    select: {
      id: true,
      username: true,
      displayName: true,
      role: true,
      passwordHash: true,
    },
  });

  // One answer for a wrong password, an unknown username, a disabled account
  // and an unconfigured server: a caller learns only that they are not in.
  //
  // The hash is verified even when no user was found, against a dummy of the
  // same shape, so the response time does not reveal which usernames exist.
  const hash = user?.passwordHash ?? DUMMY_HASH;
  const ok = await passwordMatches(credentials.password, hash);
  if (!user || !ok) {
    return NextResponse.json({ code: "unauthorised" }, { status: 401 });
  }

  await prisma.adminUser.update({
    where: { id: user.id },
    data: { lastSignInAt: new Date() },
  });

  const response = NextResponse.json({
    ok: true,
    user: {
      username: user.username,
      displayName: user.displayName,
      role: user.role,
    },
  });
  response.cookies.set(
    ADMIN_COOKIE,
    issueAdminSession(user.id),
    cookieOptions(ADMIN_SESSION_TTL_MS / 1000)
  );
  return response;
}
```

Add near the top of the file, below the imports:

```ts
/**
 * A real hash of a value nobody knows, verified when no user matched.
 *
 * Without it, an unknown username returns in a millisecond while a known one
 * takes the scrypt work — which turns the login into a way to enumerate who
 * works here. Generated once at module load, so it costs nothing per request.
 */
const DUMMY_HASH =
  "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
```

Update the imports at the top to include `ADMIN_COOKIE`, `ADMIN_SESSION_TTL_MS` and `issueAdminSession` from `@/lib/admin/session`, and drop `adminSecretValid`.

- [ ] **Step 4: Run the test**

Run: `npx vitest run --project db tests/db/adminSignIn.test.ts && npx tsc --noEmit`
Expected: PASS, 6 tests; tsc exit 0.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/session/route.ts tests/db/adminSignIn.test.ts
git commit -m "feat(admin): sign in with a username and a password

Verifies a dummy hash when no user matched, so response time does not
enumerate who works here. Sign-in attempts get their own rate-limit budget."
```

---

### Task 6: Seed the owner, and a way back in

**Files:**
- Modify: `prisma/seed.ts`
- Create: `scripts/set-admin-password.ts`
- Modify: `package.json` (one script)
- Modify: `.env.local.example`
- Create: `tests/db/adminSeedOwner.test.ts`

**Interfaces:**
- Consumes: `hashPassword` (Task 1), `AdminUser` (Task 2).
- Produces: `seedOwner(client: PrismaClient, organisationId: string): Promise<{ created: boolean }>` exported from `prisma/seed.ts`.

- [ ] **Step 1: Write the failing test**

Create `tests/db/adminSeedOwner.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { passwordMatches } from "@/lib/admin/password";
import { ensureOrganisation, seedOwner } from "@/prisma/seed";

const ORIGINAL = { ...process.env };

beforeEach(() => {
  process.env.ADMIN_OWNER_USERNAME = "chef";
  process.env.ADMIN_OWNER_PASSWORD = "Startpasswort2026!";
});

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("seedOwner", () => {
  it("creates the owner when there is none", async () => {
    const org = await ensureOrganisation(prisma);
    expect(await seedOwner(prisma, org.id)).toEqual({ created: true });

    const owner = await prisma.adminUser.findFirstOrThrow();
    expect(owner.username).toBe("chef");
    expect(owner.role).toBe("owner");
    expect(await passwordMatches("Startpasswort2026!", owner.passwordHash)).toBe(true);
  });

  it("NEVER overwrites a password that already exists", async () => {
    const org = await ensureOrganisation(prisma);
    await seedOwner(prisma, org.id);

    // The owner changes their password, as they should.
    const before = await prisma.adminUser.findFirstOrThrow();
    await prisma.adminUser.update({
      where: { id: before.id },
      data: { passwordHash: await (await import("@/lib/admin/password")).hashPassword("Eigenes2026!") },
    });

    // A later deploy runs the seed again.
    expect(await seedOwner(prisma, org.id)).toEqual({ created: false });

    const after = await prisma.adminUser.findFirstOrThrow();
    expect(await passwordMatches("Eigenes2026!", after.passwordHash)).toBe(true);
    expect(await passwordMatches("Startpasswort2026!", after.passwordHash)).toBe(false);
  });

  it("does nothing when the environment does not ask for an owner", async () => {
    delete process.env.ADMIN_OWNER_USERNAME;
    delete process.env.ADMIN_OWNER_PASSWORD;
    const org = await ensureOrganisation(prisma);
    expect(await seedOwner(prisma, org.id)).toEqual({ created: false });
    expect(await prisma.adminUser.count()).toBe(0);
  });

  it("leaves an existing owner alone even under a different username", async () => {
    const org = await ensureOrganisation(prisma);
    await seedOwner(prisma, org.id);

    process.env.ADMIN_OWNER_USERNAME = "somebodyelse";
    expect(await seedOwner(prisma, org.id)).toEqual({ created: false });
    expect(await prisma.adminUser.count()).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project db tests/db/adminSeedOwner.test.ts`
Expected: FAIL — `seedOwner` is not exported from `prisma/seed.ts`.

- [ ] **Step 3: Write the implementation**

Add to `prisma/seed.ts`, after `seedFleet`:

```ts
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
```

Add the import at the top of `prisma/seed.ts`:

```ts
import { hashPassword } from "../lib/admin/password";
```

And call it from `main()`, after `seedFleet`:

```ts
    const owner = await seedOwner(client, org.id);
    console.log(
      `[seed] organisation ${org.id}, ${fleet.length} vehicles` +
        (owner.created ? ", owner created" : "")
    );
```

- [ ] **Step 4: Write the recovery script**

Create `scripts/set-admin-password.ts`:

```ts
/**
 * Sets an account's password from the command line.
 *
 * The way back in when an owner has forgotten theirs. The seed deliberately
 * refuses to overwrite an existing password — see seedOwner — so this is the
 * escape hatch, and it is a script rather than a page because anyone who can
 * run it already has the database credentials.
 *
 *   DATABASE_URL="..." pnpm admin:password chef 'NeuesPasswort2026!'
 */

import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { hashPassword } from "../lib/admin/password";

async function main(): Promise<void> {
  config({ path: ".env.local" });

  const [username, password] = process.argv.slice(2);
  if (!username || !password) {
    console.error("Usage: pnpm admin:password <username> <password>");
    process.exit(1);
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set.");

  const client = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    const user = await client.adminUser.findFirst({
      where: { username: username.trim().toLowerCase() },
      select: { id: true, username: true },
    });
    if (!user) {
      console.error(`No account called ${username}.`);
      process.exit(1);
    }

    await client.adminUser.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(password),
        // Signs the account out everywhere, which is what you want if the
        // reason for the reset is that somebody else knew the old one.
        credentialsChangedAt: new Date(),
        disabledAt: null,
      },
    });

    console.log(`[admin] password set for ${user.username}, other sessions ended`);
  } finally {
    await client.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 5: Add the script and document the variables**

In `package.json`, add to `scripts`:

```json
    "admin:password": "tsx scripts/set-admin-password.ts",
```

In `.env.local.example`, replace the `ADMIN_SECRET` block's final line with the following, keeping the existing warning paragraphs above it:

```
ADMIN_SECRET=

# --- The first dashboard account (Phase 5) ----------------------------
# Used by `pnpm db:seed` to create an owner account when the organisation has
# none. Set these BEFORE the deploy that carries Phase 5, or the dashboard
# ships with no way to sign in.
#
# The seed never overwrites a password that already exists, so changing
# ADMIN_OWNER_PASSWORD later does nothing. Use `pnpm admin:password` instead.
ADMIN_OWNER_USERNAME=chef
ADMIN_OWNER_NAME=
ADMIN_OWNER_PASSWORD=
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run --project db tests/db/adminSeedOwner.test.ts tests/db/seed.test.ts && npx tsc --noEmit`
Expected: PASS, 10 tests; tsc exit 0.

- [ ] **Step 7: Commit**

```bash
git add prisma/seed.ts scripts/set-admin-password.ts package.json .env.local.example \
        tests/db/adminSeedOwner.test.ts
git commit -m "feat(admin): seed the first owner, and script the way back in

The seed runs on every deploy, so it creates an owner when there is none and
never touches a password that already exists — otherwise a deploy would
silently reset the owner's password and lock out whoever changed it."
```

---

### Task 7: Managing accounts

**Files:**
- Create: `lib/admin/users.ts`
- Create: `lib/admin/users.test.ts`
- Create: `app/api/admin/users/route.ts`
- Create: `app/api/admin/users/[id]/route.ts`
- Create: `tests/db/adminUsers.test.ts`

**Interfaces:**
- Consumes: `requireAdmin`, `requireOwner` (Task 4), `hashPassword` (Task 1).
- Produces:
  - `newUserSchema` — `{ username, displayName, password, role }`
  - `updateUserSchema` — `{ displayName?, password?, role?, disabled? }`, at least one key
  - `USERNAME_PATTERN: RegExp`
  - `GET`/`POST` on `/api/admin/users`, `PATCH` on `/api/admin/users/[id]`

- [ ] **Step 1: Write the failing validation test**

Create `lib/admin/users.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { newUserSchema, updateUserSchema } from "./users";

describe("newUserSchema", () => {
  it("lowercases and trims the username", () => {
    const parsed = newUserSchema.parse({
      username: "  Ahmed  ",
      displayName: "Eng Ahmed",
      password: "Sommer2026!",
      role: "staff",
    });
    expect(parsed.username).toBe("ahmed");
  });

  it("refuses usernames that would be ambiguous or unusable", () => {
    for (const username of ["ab", "a".repeat(33), "has space", "Grüezi", "semi;colon", ""]) {
      const result = newUserSchema.safeParse({
        username,
        displayName: "X",
        password: "Sommer2026!",
        role: "staff",
      });
      expect(result.success, username).toBe(false);
    }
  });

  it("accepts the punctuation an office actually uses", () => {
    for (const username of ["ahmed", "a.meier", "hans-peter", "user_2"]) {
      expect(
        newUserSchema.safeParse({
          username,
          displayName: "X",
          password: "Sommer2026!",
          role: "staff",
        }).success,
        username
      ).toBe(true);
    }
  });

  it("requires a password long enough to be worth hashing", () => {
    const result = newUserSchema.safeParse({
      username: "ahmed",
      displayName: "Eng Ahmed",
      password: "short",
      role: "staff",
    });
    expect(result.success).toBe(false);
  });

  it("defaults the role to staff", () => {
    const parsed = newUserSchema.parse({
      username: "ahmed",
      displayName: "Eng Ahmed",
      password: "Sommer2026!",
    });
    expect(parsed.role).toBe("staff");
  });
});

describe("updateUserSchema", () => {
  it("refuses an empty patch", () => {
    expect(updateUserSchema.safeParse({}).success).toBe(false);
  });

  it("accepts a password on its own", () => {
    expect(updateUserSchema.safeParse({ password: "Herbst2026!" }).success).toBe(true);
  });

  it("accepts disabling on its own", () => {
    expect(updateUserSchema.safeParse({ disabled: true }).success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project unit lib/admin/users.test.ts`
Expected: FAIL — cannot resolve `./users`.

- [ ] **Step 3: Write the validation module**

Create `lib/admin/users.ts`:

```ts
/**
 * The rules the accounts page enforces.
 *
 * Separated from the endpoints so the interesting parts — what a username may
 * contain, and what a patch is allowed to be — can be tested without a
 * database, exactly as lib/admin/cars.ts is.
 */

import { z } from "zod";

/**
 * Lowercase, and narrow on purpose.
 *
 * A username is typed at a login screen by somebody in a hurry, so anything
 * that renders two ways — accents, spaces, mixed case — is a support call.
 * Display names carry the real spelling.
 */
export const USERNAME_PATTERN = /^[a-z0-9._-]{3,32}$/;

const username = z
  .string()
  .trim()
  .toLowerCase()
  .refine((value) => USERNAME_PATTERN.test(value), "username");

/** Long enough that scrypt is not the only thing standing in the way. */
const password = z.string().min(10, "password").max(200, "password");

const displayName = z.string().trim().min(1, "displayName").max(100, "displayName");

const role = z.enum(["owner", "staff"]).default("staff");

export const newUserSchema = z.object({
  username,
  displayName,
  password,
  role,
});

export type NewUser = z.infer<typeof newUserSchema>;

/**
 * An edit. Every field optional, but not all of them at once.
 *
 * The username is absent deliberately: it is what somebody types to sign in,
 * and renaming it silently breaks their muscle memory for no gain. Create a
 * new account instead.
 */
export const updateUserSchema = z
  .object({
    displayName: displayName.optional(),
    password: password.optional(),
    role: z.enum(["owner", "staff"]).optional(),
    disabled: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "empty" });

export type UpdateUser = z.infer<typeof updateUserSchema>;
```

- [ ] **Step 4: Run the validation test**

Run: `npx vitest run --project unit lib/admin/users.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Write the failing endpoint test**

Create `tests/db/adminUsers.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/admin/users/route";
import { PATCH } from "@/app/api/admin/users/[id]/route";
import { prisma } from "@/lib/db";
import { hashPassword, passwordMatches } from "@/lib/admin/password";
import { ADMIN_COOKIE, issueAdminSession } from "@/lib/admin/session";
import { ensureOrganisation } from "@/prisma/seed";

async function makeUser(
  role: "owner" | "staff",
  username: string
): Promise<{ id: string }> {
  const org = await ensureOrganisation(prisma);
  return prisma.adminUser.create({
    data: {
      organisationId: org.id,
      username,
      displayName: username,
      role,
      passwordHash: await hashPassword("Sommer2026!"),
    },
    select: { id: true },
  });
}

function as(userId: string, body?: unknown, method = "GET"): Request {
  return new Request("https://example.test/api/admin/users/", {
    method,
    headers: {
      cookie: `${ADMIN_COOKIE}=${issueAdminSession(userId)}`,
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  process.env.ADMIN_SECRET = "signing-key-for-tests";
});

describe("GET /api/admin/users", () => {
  it("lists accounts for an owner", async () => {
    const owner = await makeUser("owner", "chef");
    await makeUser("staff", "ahmed");

    const body = await (await GET(as(owner.id))).json();
    expect(body.users).toHaveLength(2);
    // Never leaves the server, not even to an owner.
    expect(JSON.stringify(body)).not.toContain("scrypt$");
  });

  it("refuses a staff member with 403", async () => {
    const staff = await makeUser("staff", "ahmed");
    const response = await GET(as(staff.id));
    expect(response.status).toBe(403);
  });

  it("refuses a stranger with 401", async () => {
    const response = await GET(new Request("https://example.test/api/admin/users/"));
    expect(response.status).toBe(401);
  });
});

describe("POST /api/admin/users", () => {
  it("creates an account an owner can hand over", async () => {
    const owner = await makeUser("owner", "chef");
    const response = await POST(
      as(owner.id, {
        username: "ahmed",
        displayName: "Eng Ahmed",
        password: "Sommer2026!",
        role: "staff",
      }, "POST")
    );

    expect(response.status).toBe(201);
    const created = await prisma.adminUser.findFirstOrThrow({
      where: { username: "ahmed" },
    });
    expect(created.role).toBe("staff");
    expect(created.createdById).toBe(owner.id);
    expect(await passwordMatches("Sommer2026!", created.passwordHash)).toBe(true);
  });

  it("refuses a duplicate username with 409", async () => {
    const owner = await makeUser("owner", "chef");
    await makeUser("staff", "ahmed");

    const response = await POST(
      as(owner.id, {
        username: "ahmed",
        displayName: "Someone Else",
        password: "Sommer2026!",
      }, "POST")
    );
    expect(response.status).toBe(409);
  });

  it("refuses a staff member with 403", async () => {
    const staff = await makeUser("staff", "ahmed");
    const response = await POST(
      as(staff.id, {
        username: "sneaky",
        displayName: "Sneaky",
        password: "Sommer2026!",
      }, "POST")
    );
    expect(response.status).toBe(403);
    expect(await prisma.adminUser.count()).toBe(1);
  });
});

describe("PATCH /api/admin/users/[id]", () => {
  it("lets an owner set somebody else's password and ends their sessions", async () => {
    const owner = await makeUser("owner", "chef");
    const staff = await makeUser("staff", "ahmed");
    const before = await prisma.adminUser.findUniqueOrThrow({ where: { id: staff.id } });

    const response = await PATCH(
      as(owner.id, { password: "Herbst2026!" }, "PATCH"),
      params(staff.id)
    );
    expect(response.status).toBe(200);

    const after = await prisma.adminUser.findUniqueOrThrow({ where: { id: staff.id } });
    expect(await passwordMatches("Herbst2026!", after.passwordHash)).toBe(true);
    expect(after.credentialsChangedAt.getTime()).toBeGreaterThan(
      before.credentialsChangedAt.getTime()
    );
  });

  it("lets a staff member change their own password", async () => {
    const staff = await makeUser("staff", "ahmed");
    const response = await PATCH(
      as(staff.id, { password: "Herbst2026!" }, "PATCH"),
      params(staff.id)
    );
    expect(response.status).toBe(200);
  });

  it("refuses a staff member changing somebody else's password", async () => {
    const staff = await makeUser("staff", "ahmed");
    const other = await makeUser("staff", "bea");

    const response = await PATCH(
      as(staff.id, { password: "Herbst2026!" }, "PATCH"),
      params(other.id)
    );
    expect(response.status).toBe(403);
  });

  it("refuses a staff member promoting themselves", async () => {
    const staff = await makeUser("staff", "ahmed");
    const response = await PATCH(
      as(staff.id, { role: "owner" }, "PATCH"),
      params(staff.id)
    );
    expect(response.status).toBe(403);
    const after = await prisma.adminUser.findUniqueOrThrow({ where: { id: staff.id } });
    expect(after.role).toBe("staff");
  });

  it("refuses to disable the last enabled owner", async () => {
    const owner = await makeUser("owner", "chef");
    const response = await PATCH(
      as(owner.id, { disabled: true }, "PATCH"),
      params(owner.id)
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ code: "last-owner" });
  });

  it("refuses to demote the last enabled owner", async () => {
    const owner = await makeUser("owner", "chef");
    const response = await PATCH(
      as(owner.id, { role: "staff" }, "PATCH"),
      params(owner.id)
    );
    expect(response.status).toBe(409);
  });

  it("allows disabling one of two owners", async () => {
    const first = await makeUser("owner", "chef");
    const second = await makeUser("owner", "chef2");

    const response = await PATCH(
      as(first.id, { disabled: true }, "PATCH"),
      params(second.id)
    );
    expect(response.status).toBe(200);
  });

  it("answers 404 for an id that does not exist", async () => {
    const owner = await makeUser("owner", "chef");
    const response = await PATCH(
      as(owner.id, { displayName: "X" }, "PATCH"),
      params("clxnope00000000000000000")
    );
    expect(response.status).toBe(404);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run --project db tests/db/adminUsers.test.ts`
Expected: FAIL — cannot resolve `@/app/api/admin/users/route`.

- [ ] **Step 7: Write the list and create endpoint**

Create `app/api/admin/users/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/admin/password";
import { requireAdmin, requireOwner } from "@/lib/admin/session";
import { newUserSchema } from "@/lib/admin/users";

/**
 * The accounts an owner manages.
 *
 * Owner-only, both verbs. A staff member who could create an account could
 * mint themselves a second login, which is the reason the role exists at all.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 401 when nobody is signed in, 403 when somebody is but is not an owner. */
async function ownerOr(request: Request) {
  const user = await requireAdmin(request);
  if (!user) return { error: NextResponse.json({ code: "unauthorised" }, { status: 401 }) };
  const owner = await requireOwner(request);
  if (!owner) return { error: NextResponse.json({ code: "forbidden" }, { status: 403 }) };
  return { owner };
}

export async function GET(request: Request) {
  const { error } = await ownerOr(request);
  if (error) return error;

  const users = await prisma.adminUser.findMany({
    orderBy: [{ role: "asc" }, { username: "asc" }],
    // passwordHash is absent on purpose: it never leaves the server, not even
    // to an owner.
    select: {
      id: true,
      username: true,
      displayName: true,
      role: true,
      disabledAt: true,
      lastSignInAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    users: users.map((user) => ({
      ...user,
      disabledAt: user.disabledAt?.toISOString() ?? null,
      lastSignInAt: user.lastSignInAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  const { error, owner } = await ownerOr(request);
  if (error) return error;

  let input;
  try {
    input = newUserSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ code: "bad-request" }, { status: 400 });
  }

  const organisation = await prisma.organisation.findFirst({ select: { id: true } });
  if (!organisation) {
    console.error("[admin] no organisation row — run pnpm db:seed");
    return NextResponse.json({ code: "not-configured" }, { status: 503 });
  }

  const taken = await prisma.adminUser.findFirst({
    where: { organisationId: organisation.id, username: input.username },
    select: { id: true },
  });
  if (taken) {
    return NextResponse.json({ code: "username-taken" }, { status: 409 });
  }

  const created = await prisma.adminUser.create({
    data: {
      organisationId: organisation.id,
      username: input.username,
      displayName: input.displayName,
      role: input.role,
      passwordHash: await hashPassword(input.password),
      createdById: owner!.id,
    },
    select: { id: true, username: true, displayName: true, role: true },
  });

  return NextResponse.json({ user: created }, { status: 201 });
}
```

- [ ] **Step 8: Write the update endpoint**

Create `app/api/admin/users/[id]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/admin/password";
import { requireAdmin } from "@/lib/admin/session";
import { updateUserSchema } from "@/lib/admin/users";

/**
 * Editing an account.
 *
 * Two callers with different rights, which is why this is not simply
 * owner-only: an owner may change anybody, and anybody may change their own
 * password. Nothing else is self-service — a staff member who could set their
 * own role could promote themselves.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await requireAdmin(request);
  if (!actor) {
    return NextResponse.json({ code: "unauthorised" }, { status: 401 });
  }

  const { id } = await params;

  let patch;
  try {
    patch = updateUserSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ code: "bad-request" }, { status: 400 });
  }

  const isOwner = actor.role === "owner";
  const isSelf = actor.id === id;
  // A staff member may change exactly one thing: their own password.
  const selfPasswordOnly =
    isSelf &&
    patch.password !== undefined &&
    patch.role === undefined &&
    patch.disabled === undefined;

  if (!isOwner && !selfPasswordOnly) {
    return NextResponse.json({ code: "forbidden" }, { status: 403 });
  }

  const target = await prisma.adminUser.findUnique({
    where: { id },
    select: { id: true, role: true, disabledAt: true },
  });
  if (!target) {
    return NextResponse.json({ code: "not-found" }, { status: 404 });
  }

  // The lockout guard. Without it one mis-click leaves an office with a
  // dashboard nobody can administer and no way back except the database.
  const losesOwner =
    target.role === "owner" &&
    !target.disabledAt &&
    (patch.disabled === true || patch.role === "staff");

  if (losesOwner) {
    const otherOwners = await prisma.adminUser.count({
      where: { role: "owner", disabledAt: null, id: { not: target.id } },
    });
    if (otherOwners === 0) {
      return NextResponse.json({ code: "last-owner" }, { status: 409 });
    }
  }

  const data: Record<string, unknown> = {};
  if (patch.displayName !== undefined) data.displayName = patch.displayName;
  if (patch.role !== undefined) data.role = patch.role;
  if (patch.disabled !== undefined) {
    data.disabledAt = patch.disabled ? new Date() : null;
  }
  if (patch.password !== undefined) {
    data.passwordHash = await hashPassword(patch.password);
    // Ends every session that was issued under the old password, which is the
    // point of a reset when somebody else knew it.
    data.credentialsChangedAt = new Date();
  }

  const updated = await prisma.adminUser.update({
    where: { id: target.id },
    data,
    select: { id: true, username: true, displayName: true, role: true, disabledAt: true },
  });

  return NextResponse.json({ user: updated });
}
```

- [ ] **Step 9: Run the tests**

Run: `npx vitest run --project db tests/db/adminUsers.test.ts && npx tsc --noEmit`
Expected: PASS, 15 tests; tsc exit 0.

- [ ] **Step 10: Commit**

```bash
git add lib/admin/users.ts lib/admin/users.test.ts app/api/admin/users \
        tests/db/adminUsers.test.ts
git commit -m "feat(admin): manage accounts, with a guard against locking yourself out

Owners manage everybody; anybody may change their own password and nothing
else. The API refuses to disable or demote the last enabled owner, because
one mis-click would otherwise leave the office with a dashboard nobody can
administer."
```

---

### Task 8: Delete a car, only where it cannot lose anything

**Files:**
- Modify: `app/api/admin/cars/[id]/route.ts` (add `DELETE`)
- Create: `tests/db/adminCarDelete.test.ts`

**Interfaces:**
- Consumes: `requireAdmin` (Task 4).
- Produces: `DELETE /api/admin/cars/[id]` → `200 { ok: true }`, `404 { code: "not-found" }`, or `409 { code: "has-history" }`.

- [ ] **Step 1: Write the failing test**

Create `tests/db/adminCarDelete.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { DELETE } from "@/app/api/admin/cars/[id]/route";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/admin/password";
import { ADMIN_COOKIE, issueAdminSession } from "@/lib/admin/session";
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
  mobile: "+41791234567",
  email: "anna@example.ch",
  gtcAccepted: true,
  gtcVersion: "2026-07-31",
  gtcLanguage: "de",
  acceptedAt: "2026-08-17T08:00:00.000Z",
  place: "Zurich",
};

const uploads: PickupUpload[] = [
  { kind: "SIGNATURE", body: new Uint8Array([1]), contentType: "image/png" },
];

async function signedIn(): Promise<Request> {
  const org = await ensureOrganisation(prisma);
  const user = await prisma.adminUser.create({
    data: {
      organisationId: org.id,
      username: "chef",
      displayName: "Die Chefin",
      role: "owner",
      passwordHash: await hashPassword("Sommer2026!"),
    },
    select: { id: true },
  });
  return new Request("https://example.test/api/admin/cars/x/", {
    method: "DELETE",
    headers: { cookie: `${ADMIN_COOKIE}=${issueAdminSession(user.id)}` },
  });
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  process.env.ADMIN_SECRET = "signing-key-for-tests";
});

describe("DELETE /api/admin/cars/[id]", () => {
  it("deletes a car that has no history", async () => {
    const request = await signedIn();
    const org = await prisma.organisation.findFirstOrThrow();
    const car = await prisma.car.create({
      data: {
        organisationId: org.id,
        slug: "typo-zh000000",
        model: "Typo",
        plate: "ZH 000 000",
      },
      select: { id: true },
    });

    const response = await DELETE(request, params(car.id));
    expect(response.status).toBe(200);
    expect(await prisma.car.count({ where: { id: car.id } })).toBe(0);
  });

  it("refuses a car with a rental, and keeps it", async () => {
    const request = await signedIn();
    const org = await prisma.organisation.findFirstOrThrow();
    await seedFleet(prisma, org.id);
    await persistPickup({
      organisationId: org.id,
      details,
      vehicleSlug: details.vehicleId,
      uploads,
      pdf: { body: new Uint8Array([2]) },
      store: createMemoryStore(),
    });

    const car = await prisma.car.findFirstOrThrow({
      where: { slug: details.vehicleId },
    });
    const response = await DELETE(request, params(car.id));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ code: "has-history" });
    // Still there: the traffic-fine lookup and the signed contract need it.
    expect(await prisma.car.count({ where: { id: car.id } })).toBe(1);
  });

  it("answers 404 for an unknown id", async () => {
    const request = await signedIn();
    const response = await DELETE(request, params("clxnope00000000000000000"));
    expect(response.status).toBe(404);
  });

  it("refuses a stranger", async () => {
    const response = await DELETE(
      new Request("https://example.test/api/admin/cars/x/", { method: "DELETE" }),
      params("whatever")
    );
    expect(response.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project db tests/db/adminCarDelete.test.ts`
Expected: FAIL — `DELETE` is not exported from the route.

- [ ] **Step 3: Write the implementation**

Append to `app/api/admin/cars/[id]/route.ts`:

```ts
/**
 * Removing a car, narrowly.
 *
 * Only a car with no rentals, which in practice means one somebody has just
 * mistyped. Anything with history stays: every rental and every contract
 * naming it points at this row, so deleting one would break the traffic-fine
 * lookup — "who was driving ZH 589 864 on the 12th" — and orphan signed
 * documents under a ten-year retention obligation.
 *
 * `retired` is the delete that is safe, and it is what the 409 points at.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin(request);
  if (!user) {
    return NextResponse.json({ code: "unauthorised" }, { status: 401 });
  }

  const { id } = await params;

  const car = await prisma.car.findUnique({
    where: { id },
    select: { id: true, _count: { select: { rentals: true } } },
  });
  if (!car) {
    return NextResponse.json({ code: "not-found" }, { status: 404 });
  }

  if (car._count.rentals > 0) {
    return NextResponse.json({ code: "has-history" }, { status: 409 });
  }

  await prisma.car.delete({ where: { id: car.id } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run --project db tests/db/adminCarDelete.test.ts && npx tsc --noEmit`
Expected: PASS, 4 tests; tsc exit 0.

- [ ] **Step 5: Commit**

```bash
git add "app/api/admin/cars/[id]/route.ts" tests/db/adminCarDelete.test.ts
git commit -m "feat(admin): delete a car only when it has no history

Anything with a rental stays and answers 409 pointing at retire, because
every contract naming the car points at the row and the traffic-fine lookup
reaches back through it."
```

---

### Task 9: German and English, and the dashboard shell

**Files:**
- Create: `lib/admin/labels.ts`
- Modify: `components/admin/AdminDashboard.tsx`
- Modify: `app/admin/page.tsx` (only if it passes props that change)

**Interfaces:**
- Consumes: the sign-in response from Task 5 (`{ ok, user: { username, displayName, role } }`).
- Produces: `labelsFor(language: AdminLanguage)` returning the label table; `type AdminLanguage = "de" | "en"`; `ADMIN_LANGUAGE_KEY = "zuriauto_admin_lang"`.

- [ ] **Step 1: Write the labels module**

Create `lib/admin/labels.ts`:

```ts
/**
 * German and English strings for the fleet dashboard.
 *
 * Outside the i18n catalogue, for the reason lib/rental/labels.ts already
 * gives: the dashboard is a self-contained tool, and routing it through `t()`
 * would mean adding keys to locales/de.ts, locales/en.ts and types/i18n.ts for
 * strings nothing else uses.
 *
 * German is the default, matching the rest of the site.
 */

export type AdminLanguage = "de" | "en";

/** Per-browser, not per-account: not worth a column and a migration. */
export const ADMIN_LANGUAGE_KEY = "zuriauto_admin_lang";

export function asAdminLanguage(value: string | null | undefined): AdminLanguage {
  return value === "en" ? "en" : "de";
}

// Deliberately not `as const`: the literal types that would produce make
// `en: typeof de` unsatisfiable, since every English string differs.
const de = {
  signIn: {
    heading: "Flottenverwaltung",
    username: "Benutzername",
    password: "Passwort",
    submit: "Anmelden",
    failed: "Anmeldung fehlgeschlagen.",
    rateLimited: "Zu viele Versuche. Bitte später erneut versuchen.",
  },
  nav: {
    signOut: "Abmelden",
    fleet: "Flotte",
    rentals: "Mieten",
    accounts: "Konten",
  },
  counts: {
    available: "Verfügbar",
    rented: "Vermietet",
    retired: "Ausser Betrieb",
    activeRentals: "Aktive Mieten",
    returnsAwaiting: "Rückgabe offen",
    contracts: "Verträge",
    mailFailed: "Mail offen",
  },
  fleet: {
    heading: "Fahrzeuge",
    model: "Marke und Modell",
    plate: "Kontrollschild",
    vin: "Fahrgestell-Nr.",
    status: "Status",
    add: "Hinzufügen",
    save: "Speichern",
    retire: "Ausser Betrieb",
    reactivate: "Wieder aktivieren",
    delete: "Löschen",
    deleteConfirm: "Wirklich löschen?",
    hasHistory: "Dieses Fahrzeug hat Mietverträge und kann nicht gelöscht werden. Bitte ausser Betrieb setzen.",
    statuses: {
      available: "Verfügbar",
      rented: "Vermietet",
      maintenance: "Werkstatt",
      retired: "Ausser Betrieb",
    },
  },
  rentals: {
    heading: "Laufende Mieten",
    returned: "Zurückgegeben – bestätigen",
    returnedOn: "Rückgabe",
    close: "Abschliessen",
    closeConfirm: "Wirklich abschliessen",
    cancel: "Abbrechen",
    none: "Keine laufenden Mieten.",
  },
  accounts: {
    heading: "Konten",
    displayName: "Name",
    username: "Benutzername",
    role: "Rolle",
    lastSignIn: "Letzte Anmeldung",
    never: "nie",
    newPassword: "Neues Passwort",
    setPassword: "Passwort setzen",
    disable: "Deaktivieren",
    enable: "Aktivieren",
    disabled: "Deaktiviert",
    create: "Konto erstellen",
    roles: { owner: "Inhaber", staff: "Mitarbeiter" },
    usernameTaken: "Dieser Benutzername ist bereits vergeben.",
    lastOwner: "Das ist der letzte Inhaber. Bitte zuerst einen weiteren Inhaber bestimmen.",
    passwordTooShort: "Mindestens 10 Zeichen.",
    usernameInvalid: "Nur Kleinbuchstaben, Zahlen, Punkt, Bindestrich und Unterstrich; 3–32 Zeichen.",
  },
  errors: {
    generic: "Etwas ist schiefgelaufen. Bitte erneut versuchen.",
    signedOut: "Sitzung abgelaufen. Bitte erneut anmelden.",
  },
};

const en: typeof de = {
  signIn: {
    heading: "Fleet management",
    username: "Username",
    password: "Password",
    submit: "Sign in",
    failed: "Sign-in failed.",
    rateLimited: "Too many attempts. Please try again later.",
  },
  nav: {
    signOut: "Sign out",
    fleet: "Fleet",
    rentals: "Rentals",
    accounts: "Accounts",
  },
  counts: {
    available: "Available",
    rented: "Rented out",
    retired: "Off the road",
    activeRentals: "Active rentals",
    returnsAwaiting: "Returns to confirm",
    contracts: "Contracts",
    mailFailed: "Mail unsent",
  },
  fleet: {
    heading: "Vehicles",
    model: "Make and model",
    plate: "Plate",
    vin: "Chassis no.",
    status: "Status",
    add: "Add",
    save: "Save",
    retire: "Take off the road",
    reactivate: "Put back on the road",
    delete: "Delete",
    deleteConfirm: "Delete this car?",
    hasHistory: "This car has rental history and cannot be deleted. Take it off the road instead.",
    statuses: {
      available: "Available",
      rented: "Rented out",
      maintenance: "In the garage",
      retired: "Off the road",
    },
  },
  rentals: {
    heading: "Open rentals",
    returned: "Returned – confirm",
    returnedOn: "Returned",
    close: "Close",
    closeConfirm: "Yes, close it",
    cancel: "Cancel",
    none: "No open rentals.",
  },
  accounts: {
    heading: "Accounts",
    displayName: "Name",
    username: "Username",
    role: "Role",
    lastSignIn: "Last sign-in",
    never: "never",
    newPassword: "New password",
    setPassword: "Set password",
    disable: "Disable",
    enable: "Enable",
    disabled: "Disabled",
    create: "Create account",
    roles: { owner: "Owner", staff: "Staff" },
    usernameTaken: "That username is already taken.",
    lastOwner: "This is the last owner. Make somebody else an owner first.",
    passwordTooShort: "At least 10 characters.",
    usernameInvalid: "Lowercase letters, digits, dot, hyphen and underscore only; 3–32 characters.",
  },
  errors: {
    generic: "Something went wrong. Please try again.",
    signedOut: "Session expired. Please sign in again.",
  },
};

export function labelsFor(language: AdminLanguage): typeof de {
  return language === "en" ? en : de;
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: exit 0. `const en: typeof de` is what catches a missing English key — if a key is missing, tsc names it here.

- [ ] **Step 3: Replace the sign-in form**

In `components/admin/AdminDashboard.tsx`, replace the single `Zugangscode` input and its submit handler with a username and password pair. The state becomes:

```tsx
  const [language, setLanguage] = useState<AdminLanguage>("de");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [me, setMe] = useState<{ displayName: string; role: "owner" | "staff" } | null>(null);

  const L = labelsFor(language);

  // Restored before first paint of the shell, so the form does not flash German
  // at somebody who chose English yesterday.
  useEffect(() => {
    try {
      setLanguage(asAdminLanguage(localStorage.getItem(ADMIN_LANGUAGE_KEY)));
    } catch {
      // A private window can throw on access; German is the right fallback.
    }
  }, []);

  function chooseLanguage(next: AdminLanguage) {
    setLanguage(next);
    try {
      localStorage.setItem(ADMIN_LANGUAGE_KEY, next);
    } catch {
      // Not worth telling anybody: the choice simply will not persist.
    }
  }
```

And the sign-in submit:

```tsx
  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");

    const response = await fetch("/api/admin/session/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (response.status === 429) {
      setMessage(L.signIn.rateLimited);
      return;
    }
    if (!response.ok) {
      setMessage(L.signIn.failed);
      setPassword("");
      return;
    }

    const body = (await response.json()) as {
      user: { displayName: string; role: "owner" | "staff" };
    };
    setMe(body.user);
    setPassword("");
    await load();
  }
```

The form markup:

```tsx
      <form onSubmit={signIn} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-slate-700">{L.signIn.username}</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            className="h-11 rounded-md border border-input px-3 text-base"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-slate-700">{L.signIn.password}</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="h-11 rounded-md border border-input px-3 text-base"
          />
        </label>
        <button
          type="submit"
          className="h-11 rounded-md bg-slate-900 px-4 text-base font-medium text-white"
        >
          {L.signIn.submit}
        </button>
      </form>
```

- [ ] **Step 4: Add the header, and route every visible string through `L`**

Replace the existing header with one carrying the signed-in person and the language toggle:

```tsx
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{L.signIn.heading}</h1>
          {me && (
            <p className="text-sm text-slate-500">
              {me.displayName} · {L.accounts.roles[me.role]}
            </p>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex overflow-hidden rounded-md border border-slate-300 text-sm">
            {(["de", "en"] as const).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => chooseLanguage(code)}
                aria-pressed={language === code}
                className={
                  language === code
                    ? "bg-slate-900 px-3 py-1.5 text-white"
                    : "px-3 py-1.5 text-slate-700"
                }
              >
                {code.toUpperCase()}
              </button>
            ))}
          </div>
          <button type="button" onClick={signOut} className="text-sm text-slate-600 underline">
            {L.nav.signOut}
          </button>
        </div>
      </header>
```

Then work through the file replacing every remaining hardcoded German string with its `L.` equivalent. The counters array becomes:

```tsx
              [L.counts.available, counts.available],
              [L.counts.rented, counts.rented],
              [L.counts.retired, counts.retired],
              [L.counts.activeRentals, counts.activeRentals],
              [L.counts.returnsAwaiting, counts.returnsAwaiting],
              [L.counts.contracts, counts.contracts],
              [L.counts.mailFailed, counts.mailFailed],
```

The returned-rental badge and its date line become `L.rentals.returned` and `L.rentals.returnedOn`; the close button `L.rentals.close` / `L.rentals.closeConfirm` / `L.rentals.cancel`; the add-car placeholders `L.fleet.model`, `L.fleet.plate`, `L.fleet.vin` and `L.fleet.add`.

Search for remaining literals before moving on:

```bash
grep -nE '"[A-ZÄÖÜ][a-zäöüß]+' components/admin/AdminDashboard.tsx
```

Expected: only `className` values and `L.` lookups; no German prose.

- [ ] **Step 5: Restyle the fleet as a table and confirm the build**

Convert the fleet from a stack of forms to a table with one row per car: model, plate, chassis number, a status pill, and the actions. Use `font-variant-numeric: tabular-nums` on the plate cell (`className="tabular-nums"`) so the column aligns. Wrap the table in `<div className="overflow-x-auto">` so a narrow phone scrolls the table rather than the page. Status pills:

```tsx
const STATUS_STYLE: Record<string, string> = {
  available: "bg-emerald-100 text-emerald-900",
  rented: "bg-sky-100 text-sky-900",
  maintenance: "bg-amber-100 text-amber-900",
  retired: "bg-slate-200 text-slate-700",
};
```

Give every action button a minimum height of `h-10` for tap targets, and keep the existing confirm-before-acting pattern for retire and delete.

Run: `npx tsc --noEmit && pnpm build`
Expected: tsc exit 0; build succeeds.

- [ ] **Step 6: Commit**

```bash
git add lib/admin/labels.ts components/admin/AdminDashboard.tsx
git commit -m "feat(admin): sign in by name, in German or English

The dashboard's strings live beside it in a de/en table, as the pickup flow's
already do, and outside the i18n catalogue for the same reason. Fleet becomes
a table; every action gets a tap target."
```

---

### Task 10: The accounts section, and the runbook

**Files:**
- Modify: `components/admin/AdminDashboard.tsx`
- Modify: `docs/DEPLOY-PHASE-2-3.md`

**Interfaces:**
- Consumes: `/api/admin/users` (Task 7), `labelsFor` (Task 9).
- Produces: nothing further.

- [ ] **Step 1: Add the accounts state and loader**

Owners only — the section is not rendered at all for staff, and the endpoint refuses them anyway, so the UI is a convenience rather than the fence.

```tsx
  interface Account {
    id: string;
    username: string;
    displayName: string;
    role: "owner" | "staff";
    disabledAt: string | null;
    lastSignInAt: string | null;
  }

  const [accounts, setAccounts] = useState<Account[]>([]);

  async function loadAccounts() {
    if (me?.role !== "owner") return;
    const response = await fetch("/api/admin/users/", { cache: "no-store" });
    if (!response.ok) return;
    const body = (await response.json()) as { users: Account[] };
    setAccounts(body.users);
  }
```

Call `loadAccounts()` alongside the existing `load()` after a successful sign-in, and again after any account mutation.

- [ ] **Step 2: Render the list**

```tsx
      {me?.role === "owner" && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium text-slate-900">{L.accounts.heading}</h2>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="p-3 text-left">{L.accounts.displayName}</th>
                  <th className="p-3 text-left">{L.accounts.username}</th>
                  <th className="p-3 text-left">{L.accounts.role}</th>
                  <th className="p-3 text-left">{L.accounts.lastSignIn}</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => (
                  <tr key={account.id} className="border-t border-slate-200">
                    <td className="p-3 font-medium text-slate-900">
                      {account.displayName}
                      {account.disabledAt && (
                        <span className="ml-2 rounded bg-slate-200 px-2 py-0.5 text-xs text-slate-700">
                          {L.accounts.disabled}
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-slate-600">{account.username}</td>
                    <td className="p-3 text-slate-600">
                      {L.accounts.roles[account.role]}
                    </td>
                    <td className="p-3 text-slate-500">
                      {account.lastSignInAt
                        ? day(account.lastSignInAt)
                        : L.accounts.never}
                    </td>
                    <td className="p-3">
                      <AccountActions
                        account={account}
                        L={L}
                        onChanged={loadAccounts}
                        onError={setMessage}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
```

- [ ] **Step 3: Write the actions component**

At the bottom of the file, beside `RentalRow`:

```tsx
function AccountActions({
  account,
  L,
  onChanged,
  onError,
}: {
  account: Account;
  L: ReturnType<typeof labelsFor>;
  onChanged: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    onError("");
    try {
      const response = await fetch(`/api/admin/users/${account.id}/`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (response.status === 409) {
        const { code } = (await response.json()) as { code: string };
        onError(code === "last-owner" ? L.accounts.lastOwner : L.errors.generic);
        return;
      }
      if (!response.ok) {
        onError(L.errors.generic);
        return;
      }
      setNewPassword("");
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        placeholder={L.accounts.newPassword}
        autoComplete="new-password"
        className="h-10 w-40 rounded-md border border-input px-2 text-sm"
      />
      <button
        type="button"
        disabled={busy || newPassword.length < 10}
        onClick={() => patch({ password: newPassword })}
        className="h-10 rounded-md bg-slate-900 px-3 text-sm text-white disabled:opacity-50"
      >
        {L.accounts.setPassword}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => patch({ disabled: !account.disabledAt })}
        className="h-10 rounded-md border border-slate-300 px-3 text-sm text-slate-700 disabled:opacity-50"
      >
        {account.disabledAt ? L.accounts.enable : L.accounts.disable}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Add the create form**

Below the accounts table, inside the same owner-only section:

```tsx
          <form onSubmit={createAccount} className="flex flex-wrap items-end gap-2">
            <input
              value={draft.displayName}
              onChange={(e) => setDraft({ ...draft, displayName: e.target.value })}
              placeholder={L.accounts.displayName}
              className="h-10 rounded-md border border-input px-3 text-sm"
            />
            <input
              value={draft.username}
              onChange={(e) => setDraft({ ...draft, username: e.target.value })}
              placeholder={L.accounts.username}
              autoCapitalize="none"
              spellCheck={false}
              className="h-10 rounded-md border border-input px-3 text-sm"
            />
            <input
              type="password"
              value={draft.password}
              onChange={(e) => setDraft({ ...draft, password: e.target.value })}
              placeholder={L.accounts.newPassword}
              autoComplete="new-password"
              className="h-10 rounded-md border border-input px-3 text-sm"
            />
            <select
              value={draft.role}
              onChange={(e) =>
                setDraft({ ...draft, role: e.target.value as "owner" | "staff" })
              }
              className="h-10 rounded-md border border-input px-2 text-sm"
            >
              <option value="staff">{L.accounts.roles.staff}</option>
              <option value="owner">{L.accounts.roles.owner}</option>
            </select>
            <button
              type="submit"
              className="h-10 rounded-md bg-slate-900 px-3 text-sm text-white"
            >
              {L.accounts.create}
            </button>
          </form>
```

With the handler, which maps the API's codes onto the office's language:

```tsx
  const [draft, setDraft] = useState({
    displayName: "",
    username: "",
    password: "",
    role: "staff" as "owner" | "staff",
  });

  async function createAccount(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");

    if (draft.password.length < 10) {
      setMessage(L.accounts.passwordTooShort);
      return;
    }
    if (!USERNAME_PATTERN.test(draft.username.trim().toLowerCase())) {
      setMessage(L.accounts.usernameInvalid);
      return;
    }

    const response = await fetch("/api/admin/users/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(draft),
    });

    if (response.status === 409) {
      setMessage(L.accounts.usernameTaken);
      return;
    }
    if (!response.ok) {
      setMessage(L.errors.generic);
      return;
    }

    setDraft({ displayName: "", username: "", password: "", role: "staff" });
    await loadAccounts();
  }
```

Import `USERNAME_PATTERN` from `@/lib/admin/users`.

- [ ] **Step 5: Verify the build and run everything**

Run: `npx tsc --noEmit && pnpm test:all && pnpm build`
Expected: tsc exit 0; all tests pass; build succeeds.

- [ ] **Step 6: Update the runbook's admin section**

In `docs/DEPLOY-PHASE-2-3.md`, replace the paragraph in "The fleet page" beginning "Sign-in exchanges the secret for an httpOnly cookie" with:

```markdown
Sign-in is a username and a password against an account in the database, and
exchanges them for an httpOnly cookie lasting twelve hours. `ADMIN_SECRET` is
no longer the password: it signs those cookies, so rotating it signs everyone
out at once, which stays the emergency lever.

Per-person revocation is real from Phase 5: disabling an account takes effect
on that person's next click, and changing their password ends their other
sessions. There are two roles — an owner manages accounts, staff manage the
fleet.
```

And add to the environment-variable table:

```markdown
| `ADMIN_OWNER_USERNAME` | the first account's username, e.g. `chef` |
| `ADMIN_OWNER_NAME` | how it is displayed, e.g. `Die Chefin` |
| `ADMIN_OWNER_PASSWORD` | its initial password — **set before the deploy** |
```

Add below the table:

> **Set the owner variables before the deploy that carries Phase 5.** The seed
> creates the first account only when the organisation has none, and never
> overwrites a password that already exists — so a deploy without them ships a
> dashboard nobody can sign into, and changing `ADMIN_OWNER_PASSWORD` later
> does nothing. `pnpm admin:password <username> <password>` is the way back in.

- [ ] **Step 7: Commit**

```bash
git add components/admin/AdminDashboard.tsx docs/DEPLOY-PHASE-2-3.md
git commit -m "feat(admin): manage accounts from the dashboard

Owner-only section: list, create, set a password, disable. The runbook now
says what ADMIN_SECRET does and what has to be set before the deploy."
```

---

## Self-review

**Spec coverage.** Every section of the design maps to a task: decision 1 → Tasks 2 and 7; decision 2 → Task 1; decisions 3 and 4 → Task 4; decision 5 → Task 6; decision 6 → Task 4 step 4, and the Global Constraints forbid going further; decision 7 → Task 8; decision 8 → Task 9; decision 9 → Task 9 steps 4–5 and Task 10. The schema section → Task 2. The endpoint table → Tasks 4, 5, 7, 8. Fail-closed behaviour → Task 1 step 1, Task 4 step 1, Task 5 step 1. The testing section's every bullet has a named test. Migration and rollout → Task 6 step 5 and Task 10 step 6.

**Gap found and closed.** The spec's endpoint table lists `DELETE /api/admin/session` as available to any signed-in user; it needs no change, since clearing a cookie is stateless and the existing handler already does exactly that. No task needed — recorded here so a reader does not go looking.

**Type consistency.** `requireAdmin` / `requireOwner` are used with those names in Tasks 4, 5, 7 and 8. `hashPassword` / `passwordMatches` in Tasks 1, 5, 6, 7. `issueAdminSession(userId, now?)` takes the id in Tasks 4, 5, 7, 8. `labelsFor` returns `typeof de` and is passed as `ReturnType<typeof labelsFor>` in Task 10. `AdminIdentity.role` is `"owner" | "staff"` throughout, matching the Prisma enum's generated union.

**Placeholder scan.** No "TBD", no "handle errors appropriately", no "similar to Task N". Every code step carries the code. Task 9 steps 4 and 5 describe edits to an existing 500-line component rather than reproducing it whole; each names the exact strings to replace and gives the replacement markup, and step 4 ends with a `grep` that fails if any German prose survives.
