# Rental Account (Payments Ledger) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every rental has a true account — deposit, weeks, the balance after the return, credits — so a TWINT payment at the pickup, a late one after the return, or cash in the office lands on the right item, and the office sees who owes what.

**Architecture:** Additive schema (a `SETTLED` charge status, payment method and deposit share, a kept-after-return flag, payer aliases). A one-off cut-over script makes old weeks settled as data. One booking function (`bookPayment`) pays the deposit and at most one week. The pure decision gains a payer-led rule; evidence gathers the payer's own rentals of the named car. A rental-account query feeds a "Mietkonto" dialog, a "Wofür" column and an "Offene Beträge" tab plus Overview item.

**Tech Stack:** Next.js 15 App Router (Node runtime), Prisma 7 + Postgres (Neon), zod, Vitest, Playwright (`playwright-core`) for the browser checks.

**Spec:** `docs/superpowers/specs/2026-10-15-payments-ledger-design.md` — read it first, and the TWINT spec it extends (`docs/superpowers/specs/2026-10-12-twint-payments-design.md`). This plan argues from both.

## Global Constraints

- Migrations are **additive only**: new enums, enum values, nullable or defaulted columns, new tables. No drop, no rename, no type change.
- **Never run tests, migrations or the dev server against the live database** (host `ep-snowy-heart…`). Every helper that sets `DATABASE_URL` refuses that host. Read the live database only inside `BEGIN TRANSACTION READ ONLY`.
- **Previews share the live database today.** Do not push this branch until Task D2 Steps 1–3 are done (a Neon branch database and branch-scoped Preview variables).
- API URLs end with a slash (`trailingSlash: true`).
- Every route touching Prisma: `export const runtime = "nodejs"` and `export const dynamic = "force-dynamic"`. Every admin route starts with `requireAdmin` (`lib/admin/session.ts`) and answers `401 {code:"unauthorised"}` without it.
- Open charge statuses stay `OPEN_CHARGE` (`lib/payments/twint/decide.ts`): `SCHEDULED`, `REQUESTED`, `REMINDED`, `OVERDUE`. `SETTLED` is **not** open.
- One payment pays **at most the deposit plus one week**. `Charge` becomes `PAID` only in `bookPayment` (`lib/payments/book.ts`), conditionally on the status it read.
- Every money change is attributed: `PaymentEvent` (actor id and name, null = system) for payments, `RentalEvent` with `actorId`/`actorName` in the payload for charge changes (cut-over, reopen, weeks after close).
- Office copy in `lib/admin/labels.ts`, German (`de`) and English (`en`, typed `typeof de`), in the existing tone.
- Unit tests: `lib/**/*.test.ts` (`pnpm test`). Database tests: `tests/db/**/*.test.ts` (`pnpm test:db`) against a **test** database (local Docker `pnpm db:up`, or a throwaway Neon project as on 12–15.10 — run with `--testTimeout=180000` for a remote one). New tables go into the truncation list in `tests/db/setup.ts`.
- Every guard test is proven: re-introduce the bug, run, read the failure (it must name the real cause), restore. (Memory: guard-tests-must-be-proven-to-fail.)
- Every UI task ends with a browser check at 1280 px and 390 px, said plainly as seen or not seen. (Memory: verify-ui-in-a-browser-before-deploying.)

## Review Focus

- **Deposit equals the weekly amount** (CHF 250 / 250) and the renter pays CHF 250 at the pickup → waits `PICKUP_PAYMENT`; it must never guess deposit or week. Test: Task B2 (unit).
- **A returned renter pays while the next renter holds the car**, both with an open week of the same amount → the payer's own rental is booked, never the holder's. Test: Task B2 (database).
- **The cut-over runs twice, or after payments were booked** → the second run settles nothing; a week paid by a payment keeps its `PAID` and `paidAt`. Test: Task A2.
- **Undo of a deposit + week booking** → the week is back to its previous status and the deposit no longer counts as received; undo of an office cash payment cancels it rather than sending it to review. Tests: Tasks A3, B3.
- **The daily job after the cut-over and the early-return decision**: a settled week is never requested; a week kept after the return is requested once due; a voided one never. Tests: Tasks A2, A4 (guards).

---

## File Structure

| File | Responsibility |
| --- | --- |
| `prisma/schema.prisma` + migration `…_payments_ledger` | `SETTLED`, `PaymentMethod`, `Payment.method/depositCents/note`, `Charge.keptAfterReturn`, `Organisation.paymentsCutoverAt`, `PayerAlias`, two review reasons |
| `lib/payments/cutover.ts` | `planCutover`, `applyCutover`, `reopenCharge` |
| `scripts/payments-cutover.ts` | Dry-run-by-default cut-over for one database |
| `app/api/admin/charges/[id]/reopen/route.ts` | Reopen a settled week |
| `lib/payments/book.ts` | `bookPayment` (deposit + at most one week); `bookCharge` kept as a wrapper |
| `lib/payments/office.ts` | `officePaymentSchema`, `recordOfficePayment` |
| `app/api/admin/rentals/[id]/payments/route.ts` | Barzahlung erfassen |
| `lib/payments/actions.ts` | book with deposit and "remember payer"; undo cancels office payments; export `inTransaction` |
| `lib/rental/passes.ts` | `isOwedAfterReturn` honours `keptAfterReturn` |
| `lib/payments/afterClose.ts` | `closedAtOf`, `pendingAfterClose`, `decideWeeksAfterClose` |
| `app/api/admin/rentals/[id]/weeks-after-close/route.ts` | The early-return decision |
| `lib/payments/twint/evidence.ts` | Payer aliases; `payerRentals` of the named car; `paidAt` |
| `lib/payments/twint/decide.ts` | Pickup and payer-led rules; `Decision` carries `depositCents` |
| `lib/payments/twint/ingest.ts`, `lib/payments/twint/dryRunReport.ts` | Book via `bookPayment`; report the deposit |
| `lib/payments/payerAlias.ts` | `rememberPayer`, `forgetPayerFrom` |
| `lib/payments/account.ts` | `rentalAccount`, `openBalances` |
| `lib/payments/queries.ts` | `purpose`, `method`, deposit facts for the book form |
| `app/api/admin/rentals/[id]/account/route.ts`, `app/api/admin/payments/owed/route.ts` | Reads for the dialog and the tab |
| `components/admin/parts/RentalAccountDialog.tsx` | The Mietkonto dialog |
| `components/admin/parts/RentalRow.tsx`, `components/admin/parts/HistoryPeriod.tsx`, `components/admin/parts/PaymentDetail.tsx`, `components/admin/sections/PaymentsSection.tsx` | Entry points, Wofür column, book form, Offene Beträge tab |
| `lib/admin/attention.ts`, `components/admin/overview/attentionText.ts`, `app/api/admin/overview/route.ts`, `components/admin/types.ts`, `lib/admin/labels.ts` | Overview item and copy |
| `docs/PAYMENTS-SETUP.md`, `docs/client/2026-10-15-twint-payments.html` | Go-live steps and the client explainer |

---

## A · True records

### Task A1: The ledger's columns and tables

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_payments_ledger/migration.sql` (generated)
- Modify: `tests/db/setup.ts` (truncation list)
- Test: `tests/db/paymentLedgerSchema.test.ts`

**Interfaces:**
- Produces: `ChargeStatus.SETTLED`, `enum PaymentMethod`, `Payment.method/depositCents/note`, `Charge.keptAfterReturn`, `Organisation.paymentsCutoverAt`, `model PayerAlias`, `PaymentReviewReason.PICKUP_PAYMENT/PAID_AFTER_RETURN`. Every later task.

- [ ] **Step 1: Write the failing test**

`tests/db/paymentLedgerSchema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { seedOrganisation, seedRental } from "./fineHelpers";

describe("the ledger schema", () => {
  it("stores an office payment with its method, deposit share and note", async () => {
    const org = await seedOrganisation();
    const rental = await seedRental(org.id, { signedAt: new Date("2026-06-01T08:00:00Z") });

    const payment = await prisma.payment.create({
      data: {
        organisationId: org.id,
        externalId: "office:test-1",
        amountCents: 95_000,
        paidAt: new Date("2026-06-01T10:00:00Z"),
        method: "CASH",
        depositCents: 50_000,
        note: "Bar bei Übergabe",
        status: "BOOKED",
        rentalId: rental.id,
      },
    });

    expect(payment).toMatchObject({ method: "CASH", depositCents: 50_000, note: "Bar bei Übergabe" });
    expect(await prisma.payment.create({
      data: { organisationId: org.id, externalId: "twint-1", amountCents: 1, paidAt: new Date(), status: "NEEDS_REVIEW" },
    })).toMatchObject({ method: "TWINT", depositCents: 0, note: null });
  });

  it("lets a week be settled at the cut-over and kept after a return", async () => {
    const org = await seedOrganisation();
    const rental = await seedRental(org.id, { signedAt: new Date("2026-06-01T08:00:00Z") });
    const week1 = await prisma.charge.findFirstOrThrow({ where: { rentalId: rental.id, weekNumber: 1 } });

    expect(await prisma.charge.update({ where: { id: week1.id }, data: { status: "SETTLED", keptAfterReturn: true } }))
      .toMatchObject({ status: "SETTLED", keptAfterReturn: true });
    expect(await prisma.organisation.update({ where: { id: org.id }, data: { paymentsCutoverAt: new Date("2026-10-20T00:00:00Z") } }))
      .toMatchObject({ paymentsCutoverAt: new Date("2026-10-20T00:00:00Z") });
  });

  it("remembers a payer once per customer", async () => {
    const org = await seedOrganisation();
    const rental = await seedRental(org.id, { signedAt: new Date("2026-06-01T08:00:00Z") });
    const alias = { organisationId: org.id, customerId: rental.customerId, kind: "phone", value: "+41791112233" };

    await prisma.payerAlias.create({ data: alias });

    await expect(prisma.payerAlias.create({ data: alias })).rejects.toMatchObject({ code: "P2002" });
  });

  it("knows the two new reasons a payment waits", async () => {
    const org = await seedOrganisation();
    for (const reviewReason of ["PICKUP_PAYMENT", "PAID_AFTER_RETURN"] as const) {
      await prisma.payment.create({
        data: { organisationId: org.id, externalId: reviewReason, amountCents: 1, paidAt: new Date(), status: "NEEDS_REVIEW", reviewReason },
      });
    }
    expect(await prisma.payment.count({ where: { reviewReason: { in: ["PICKUP_PAYMENT", "PAID_AFTER_RETURN"] } } })).toBe(2);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm exec vitest run --project db --testTimeout=180000 tests/db/paymentLedgerSchema.test.ts`
Expected: FAIL — TypeScript/Prisma errors on `method`, `SETTLED`, `payerAlias` (unknown field / model).

- [ ] **Step 3: Change the schema**

In `prisma/schema.prisma`:

```prisma
enum ChargeStatus {
  SCHEDULED
  REQUESTED
  REMINDED
  OVERDUE
  PAID
  VOID
  /// Due before the payments feature went live, and counted as settled then
  /// (scripts/payments-cutover.ts). Not open: nothing chases it, nothing books
  /// to it. The office can reopen it (lib/payments/cutover.ts).
  SETTLED
}

/// How a payment reached us. TWINT payments arrive by email; the others the
/// office records by hand (lib/payments/office.ts).
enum PaymentMethod {
  TWINT
  CASH
  CARD
  BANK
}
```

`model Charge` — after `paidAt`:

```prisma
  /// The office decided this week stays owed although the rental closed before
  /// it began (lib/payments/afterClose.ts). isOwedAfterReturn honours it.
  keptAfterReturn Boolean @default(false)
```

`model Organisation` — add:

```prisma
  /// Weeks due before this moment were settled by the cut-over script.
  paymentsCutoverAt DateTime?
  payerAliases      PayerAlias[]
```

`model Customer` — add `payerAliases PayerAlias[]`.

`model Payment` — after `message`:

```prisma
  method       PaymentMethod @default(TWINT)
  /// The part of the amount that is the deposit. Deposit received = the sum
  /// over the rental's BOOKED payments. A payment pays at most the deposit and
  /// one week.
  depositCents Int           @default(0)
  /// The office's note on a payment it recorded by hand.
  note         String?
```

`enum PaymentReviewReason` — add:

```prisma
  /// Paid around the pickup, and the amount is not clearly the deposit, week 1
  /// or both.
  PICKUP_PAYMENT
  /// Paid by the renter after the rental closed, and no open item has this amount.
  PAID_AFTER_RETURN
```

New model:

```prisma
/// A payer's email or phone the office confirmed pays for a customer — a
/// friend, a partner, a second phone. Lets their next payment count as the
/// customer's (lib/payments/payerAlias.ts).
model PayerAlias {
  id             String   @id @default(cuid())
  organisationId String
  customerId     String
  /// "email" (lowercased) or "phone" (E.164, normalisePhone).
  kind           String
  value          String
  /// The booking that taught it; undoing that booking forgets it.
  sourcePaymentId String?
  createdById     String?
  createdByName   String?
  createdAt       DateTime @default(now())

  organisation Organisation @relation(fields: [organisationId], references: [id])
  customer     Customer     @relation(fields: [customerId], references: [id])

  @@unique([organisationId, kind, value, customerId])
  @@index([organisationId, kind, value])
  @@index([sourcePaymentId])
}
```

`tests/db/setup.ts`: add `"PayerAlias"` to the `TRUNCATE` list before `"Customer"`.

- [ ] **Step 4: Generate and read the migration**

Run (against the **test** database): `pnpm exec prisma migrate dev --name payments_ledger --create-only`, then read `migration.sql`. Expected: only `CREATE TYPE`, `ALTER TYPE … ADD VALUE`, `ALTER TABLE … ADD COLUMN … DEFAULT`, `CREATE TABLE "PayerAlias"`, indexes and foreign keys. Nothing dropped or altered in type. Then `pnpm exec prisma migrate dev` and `pnpm exec prisma generate`.

- [ ] **Step 5: Run the test to see it pass**

Run: `pnpm exec vitest run --project db --testTimeout=180000 tests/db/paymentLedgerSchema.test.ts tests/db/paymentSchema.test.ts`
Expected: PASS, both files.

- [ ] **Step 6: Type-check, then commit**

Run: `pnpm exec tsc --noEmit -p .` — any exhaustive `Record<ChargeStatus, …>` or switch that now misses `SETTLED` fails here; add the case (`SETTLED` behaves as `PAID` for display, as not open everywhere else).

```bash
git add prisma/schema.prisma prisma/migrations tests/db/setup.ts tests/db/paymentLedgerSchema.test.ts
git commit -m "feat(payments): the ledger's columns — settled weeks, payment method and deposit, payer aliases"
```

---

### Task A2: The cut-over, and reopening a week

**Files:**
- Create: `lib/payments/cutover.ts`
- Create: `scripts/payments-cutover.ts`, script `"payments:cutover": "tsx scripts/payments-cutover.ts"` in `package.json`
- Create: `app/api/admin/charges/[id]/reopen/route.ts`
- Test: `tests/db/paymentCutover.test.ts`

**Interfaces:**
- Consumes: `OPEN_CHARGE`, `Actor` (`@/lib/fines/events`), `weeklyChargePass` (`lib/rental/scheduler.ts`, guard only).
- Produces: `planCutover(client, organisationId, before): Promise<CutoverCharge[]>`, `applyCutover(client, organisationId, before): Promise<{ settled: number }>`, `reopenCharge(client, chargeId, actor): Promise<{ ok: true } | { ok: false; code: "conflict" | "not-found" }>`; route `POST /api/admin/charges/[id]/reopen/`.

- [ ] **Step 1: Write the failing tests**

`tests/db/paymentCutover.test.ts` (mail mocked at the module boundary exactly as `tests/db/scheduler.test.ts` does, so the guard can run `weeklyChargePass`):

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { applyCutover, planCutover, reopenCharge } from "@/lib/payments/cutover";
import { weeklyChargePass } from "@/lib/rental/scheduler";
import type { LifecycleMailConfig } from "@/lib/rental/lifecycleMail";
import { closeAt, seedOrganisation, seedRental } from "./fineHelpers";

const sent: { to: string }[] = [];
vi.mock("@/lib/rental/lifecycleMail", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/rental/lifecycleMail")>();
  return { ...original, sendMail: async (_c: unknown, message: { to: string }) => void sent.push(message) };
});
const mail: LifecycleMailConfig = { host: "localhost", port: 587, user: "u", pass: "p", from: "noreply@zuriauto.ch", office: "office@zuriauto.ch" };
beforeEach(() => void (sent.length = 0));

const office = { id: "user-1", displayName: "Ahmed" };
// seedRental: 8 weeks from 01.06, week N due 01.06 + (N-1) weeks.
const BEFORE = new Date("2026-06-20T00:00:00Z"); // weeks 1–3 due before, week 4 (22.06) after

async function setup() {
  const org = await seedOrganisation();
  const rental = await seedRental(org.id, { signedAt: new Date("2026-06-01T08:00:00Z") });
  const week = (n: number) => prisma.charge.findFirstOrThrow({ where: { rentalId: rental.id, weekNumber: n } });
  return { org, rental, week };
}

describe("applyCutover", () => {
  it("settles the open weeks due before the date and leaves later weeks open", async () => {
    const { org, week } = await setup();

    expect((await planCutover(prisma, org.id, BEFORE)).map((c) => c.weekNumber)).toEqual([1, 2, 3]);
    expect(await applyCutover(prisma, org.id, BEFORE)).toEqual({ settled: 3 });

    expect((await week(3)).status).toBe("SETTLED");
    expect((await week(4)).status).toBe("SCHEDULED");
  });

  it("never touches a week a payment already paid, nor a void one", async () => {
    const { org, week } = await setup();
    const paidAt = new Date("2026-06-02T09:00:00Z");
    await prisma.charge.update({ where: { id: (await week(1)).id }, data: { status: "PAID", paidAt } });
    await prisma.charge.update({ where: { id: (await week(2)).id }, data: { status: "VOID" } });

    expect(await applyCutover(prisma, org.id, BEFORE)).toEqual({ settled: 1 });

    expect(await week(1)).toMatchObject({ status: "PAID", paidAt });
    expect((await week(2)).status).toBe("VOID");
  });

  it("settles a returned rental's weeks too, and records what it did on each rental", async () => {
    const { org, rental } = await setup();
    await closeAt(org.id, rental, new Date("2026-06-10T08:00:00Z"));

    await applyCutover(prisma, org.id, BEFORE);

    const event = await prisma.rentalEvent.findFirstOrThrow({ where: { rentalId: rental.id, type: "charges.settled.cutover" } });
    expect(event.payload).toMatchObject({ before: BEFORE.toISOString(), charges: [{ weekNumber: 1, previous: "SCHEDULED" }, { weekNumber: 2 }, { weekNumber: 3 }] });
    expect(await prisma.organisation.findUniqueOrThrow({ where: { id: org.id } })).toMatchObject({ paymentsCutoverAt: BEFORE });
  });

  it("changes nothing the second time", async () => {
    const { org } = await setup();
    await applyCutover(prisma, org.id, BEFORE);

    expect(await applyCutover(prisma, org.id, BEFORE)).toEqual({ settled: 0 });
    expect(await prisma.rentalEvent.count({ where: { type: "charges.settled.cutover" } })).toBe(1);
  });

  it("keeps the daily job from asking for a settled week", async () => {
    const { org } = await setup();
    await applyCutover(prisma, org.id, BEFORE);

    // 21.06: weeks 1–3 are due; without the cut-over all three would be requested.
    const now = new Date("2026-06-21T08:00:00Z");
    expect(await weeklyChargePass({ client: prisma, now, baseUrl: "https://zuriauto.ch", mail })).toBe(0);
    expect(sent).toHaveLength(0);
  });
});

describe("reopenCharge", () => {
  it("puts a settled week back to scheduled and says who did it", async () => {
    const { org, rental, week } = await setup();
    await applyCutover(prisma, org.id, BEFORE);
    const week2 = await week(2);

    expect(await reopenCharge(prisma, week2.id, office)).toEqual({ ok: true });

    expect((await week(2)).status).toBe("SCHEDULED");
    const event = await prisma.rentalEvent.findFirstOrThrow({ where: { rentalId: rental.id, type: "charge.reopened" } });
    expect(event.payload).toMatchObject({ chargeId: week2.id, weekNumber: 2, actorId: "user-1", actorName: "Ahmed" });
  });

  it("refuses a week that is not settled", async () => {
    const { week } = await setup();
    expect(await reopenCharge(prisma, (await week(5)).id, office)).toEqual({ ok: false, code: "conflict" });
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm exec vitest run --project db --testTimeout=180000 tests/db/paymentCutover.test.ts`
Expected: FAIL — `Cannot find module '@/lib/payments/cutover'`.

- [ ] **Step 3: Write the module**

`lib/payments/cutover.ts`:

```ts
/**
 * The cut-over: weeks due before the payments feature went live count as
 * settled.
 *
 * Data, not a rule computed on read, because the daily job reads
 * Charge.status: weeklyChargePass requests every SCHEDULED week whose due day
 * has come, so a computed rule would leave it asking renters for weeks they
 * paid in cash months ago (the spec, decision 1). Paid and void weeks are not
 * touched; a second run finds nothing left to settle. The office can reopen a
 * week, and every change names who made it.
 */

import type { PrismaClient } from "@/generated/prisma/client";
import type { Actor } from "@/lib/fines/events";
import { OPEN_CHARGE } from "./twint/decide";

export interface CutoverCharge {
  id: string;
  rentalId: string;
  weekNumber: number;
  dueDate: Date;
  amountCents: number;
  status: string;
}

const select = { id: true, rentalId: true, weekNumber: true, dueDate: true, amountCents: true, status: true } as const;

const dueBefore = (organisationId: string, before: Date) => ({
  organisationId,
  status: { in: [...OPEN_CHARGE] },
  dueDate: { lt: before },
});

/** What applyCutover would settle, for the dry run. */
export async function planCutover(client: PrismaClient, organisationId: string, before: Date): Promise<CutoverCharge[]> {
  return client.charge.findMany({
    where: dueBefore(organisationId, before),
    orderBy: [{ rentalId: "asc" }, { weekNumber: "asc" }],
    select,
  });
}

export async function applyCutover(
  client: PrismaClient,
  organisationId: string,
  before: Date
): Promise<{ settled: number }> {
  return client.$transaction(
    async (tx) => {
      const planned = await tx.charge.findMany({
        where: dueBefore(organisationId, before),
        orderBy: [{ rentalId: "asc" }, { weekNumber: "asc" }],
        select,
      });
      const byRental = new Map<string, { id: string; weekNumber: number; previous: string }[]>();
      for (const charge of planned) {
        // Conditional on the status read: a payment booking the week in the
        // same moment wins, and the cut-over leaves it alone.
        const moved = await tx.charge.updateMany({
          where: { id: charge.id, status: charge.status as (typeof OPEN_CHARGE)[number] },
          data: { status: "SETTLED" },
        });
        if (moved.count === 0) continue;
        const list = byRental.get(charge.rentalId) ?? [];
        list.push({ id: charge.id, weekNumber: charge.weekNumber, previous: charge.status });
        byRental.set(charge.rentalId, list);
      }
      for (const [rentalId, charges] of byRental) {
        await tx.rentalEvent.create({
          data: { rentalId, type: "charges.settled.cutover", payload: { before: before.toISOString(), charges } },
        });
      }
      await tx.organisation.update({ where: { id: organisationId }, data: { paymentsCutoverAt: before } });
      return { settled: [...byRental.values()].reduce((sum, list) => sum + list.length, 0) };
    },
    { maxWait: 20_000, timeout: 120_000 }
  );
}

export async function reopenCharge(
  client: PrismaClient,
  chargeId: string,
  actor: Actor
): Promise<{ ok: true } | { ok: false; code: "conflict" | "not-found" }> {
  const charge = await client.charge.findUnique({
    where: { id: chargeId },
    select: { rentalId: true, weekNumber: true },
  });
  if (!charge) return { ok: false, code: "not-found" };
  return client.$transaction(async (tx) => {
    const moved = await tx.charge.updateMany({ where: { id: chargeId, status: "SETTLED" }, data: { status: "SCHEDULED" } });
    if (moved.count === 0) return { ok: false, code: "conflict" } as const;
    await tx.rentalEvent.create({
      data: {
        rentalId: charge.rentalId,
        type: "charge.reopened",
        payload: { chargeId, weekNumber: charge.weekNumber, actorId: actor.id, actorName: actor.displayName },
      },
    });
    return { ok: true } as const;
  });
}
```

- [ ] **Step 4: Run the tests to see them pass**

Same command. Expected: PASS (7).

- [ ] **Step 5: Prove the guard**

In `applyCutover`, temporarily change `data: { status: "SETTLED" }` to `data: {}`. Run only `-t "keeps the daily job"`. Expected: FAIL with `expected 3 to be +0` (three weeks requested). Restore; run again; PASS.

- [ ] **Step 6: The script and the route**

`scripts/payments-cutover.ts` — follow `scripts/backfill-charges.ts`: `config({ path: ".env.local" })` (an exported `DATABASE_URL` wins), print `database: <host>`, require `--before YYYY-MM-DD` (read as the start of that Zurich day with `zurichInstant(`${day}T00:00`)`; refuse anything else), resolve the organisation with `findFirstOrThrow`, print `planCutover` grouped by rental (plate, renter first name + initial, the weeks and their statuses, the sum), and only with `--commit` call `applyCutover` and print `{ settled }`. Without `--commit` end with `Dry run: nothing was changed.`

`app/api/admin/charges/[id]/reopen/route.ts` — `POST`, `requireAdmin`, `reopenCharge(prisma, id, { id: user.id, displayName: user.displayName })`, `409` for conflict, `404` for not-found, `{ ok: true }` otherwise. Before reopening, check the charge belongs to the admin's organisation (`organisation.findFirst`, the single-tenant pattern of the payments routes) and answer `404` if not.

- [ ] **Step 7: Type-check, lint, commit**

Run: `pnpm exec tsc --noEmit -p . && pnpm exec eslint lib/payments scripts/payments-cutover.ts app/api/admin/charges`

```bash
git add lib/payments/cutover.ts scripts/payments-cutover.ts package.json app/api/admin/charges tests/db/paymentCutover.test.ts
git commit -m "feat(payments): the cut-over settles weeks due before go-live, and the office can reopen one"
```

---

### Task A3: One booking function, and payments the office records

**Files:**
- Modify: `lib/payments/book.ts` (`bookPayment`; `bookCharge` becomes a wrapper)
- Modify: `lib/payments/actions.ts` (export `inTransaction`; `book` takes `depositCents`; undo per method)
- Create: `lib/payments/office.ts`
- Create: `app/api/admin/rentals/[id]/payments/route.ts`
- Test: `tests/db/officePayment.test.ts`; keep `tests/db/paymentActions.test.ts` and `tests/db/paymentIngest.test.ts` green

**Interfaces:**
- Consumes: Task A1 columns; `recordPaymentEvent`; `zurichInstant`.
- Produces: `bookPayment(tx, { paymentId, rentalId, chargeId: string | null, depositCents, matchedBy, paidAt, actor }): Promise<boolean>`; `officePaymentSchema`; `recordOfficePayment(client, rentalId, input, actor): Promise<PaymentActionResult>`; `paymentActionSchema.book` gains `depositCents` (default 0); route `POST /api/admin/rentals/[id]/payments/`.

- [ ] **Step 1: Write the failing tests**

`tests/db/officePayment.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { applyPaymentAction } from "@/lib/payments/actions";
import { recordOfficePayment } from "@/lib/payments/office";
import { seedOrganisation, seedRental } from "./fineHelpers";

const office = { id: "user-1", displayName: "Ahmed" };

async function setup() {
  const org = await seedOrganisation();
  // weekly 450, deposit 500 (seedRental's defaults)
  const rental = await seedRental(org.id, { signedAt: new Date("2026-06-01T08:00:00Z") });
  const week = (n: number) => prisma.charge.findFirstOrThrow({ where: { rentalId: rental.id, weekNumber: n } });
  const deposit = async () =>
    (await prisma.payment.aggregate({ where: { rentalId: rental.id, status: "BOOKED" }, _sum: { depositCents: true } }))._sum.depositCents ?? 0;
  return { rental, week, deposit };
}

const cash = (overrides: Record<string, unknown> = {}) => ({
  amountCents: 45_000,
  paidOn: "2026-06-08",
  method: "CASH" as const,
  chargeId: null as string | null,
  depositCents: 0,
  note: "",
  ...overrides,
});

describe("recordOfficePayment", () => {
  it("records cash for a week: the week is paid on that day, and the timeline names the office", async () => {
    const { rental, week } = await setup();
    const week2 = await week(2);

    expect(await recordOfficePayment(prisma, rental.id, cash({ chargeId: week2.id }), office)).toEqual({ ok: true });

    expect(await week(2)).toMatchObject({ status: "PAID" });
    const payment = await prisma.payment.findFirstOrThrow({ include: { events: { orderBy: { createdAt: "asc" } } } });
    expect(payment).toMatchObject({ method: "CASH", status: "BOOKED", matchedBy: "office", chargeId: week2.id });
    expect(payment.externalId).toMatch(/^office:/);
    expect(payment.events.map((e) => [e.type, e.actorName])).toEqual([["payment.recorded", "Ahmed"], ["payment.booked", "Ahmed"]]);
  });

  it("takes the deposit and week 1 from one payment", async () => {
    const { rental, week, deposit } = await setup();

    await recordOfficePayment(prisma, rental.id, cash({ amountCents: 95_000, chargeId: (await week(1)).id, depositCents: 50_000 }), office);

    expect((await week(1)).status).toBe("PAID");
    expect(await deposit()).toBe(50_000);
  });

  it("refuses an amount that is not the week plus the deposit, and stores nothing", async () => {
    const { rental, week } = await setup();

    expect(await recordOfficePayment(prisma, rental.id, cash({ amountCents: 40_000, chargeId: (await week(2)).id }), office))
      .toEqual({ ok: false, code: "bad-request" });
    expect(await prisma.payment.count()).toBe(0);
  });

  it("refuses more deposit than was agreed", async () => {
    const { rental } = await setup();

    expect(await recordOfficePayment(prisma, rental.id, cash({ amountCents: 60_000, depositCents: 60_000 }), office))
      .toEqual({ ok: false, code: "bad-request" });
  });

  it("cancels an office payment on undo, and the week is owed again", async () => {
    const { rental, week, deposit } = await setup();
    const week1 = await week(1);
    await recordOfficePayment(prisma, rental.id, cash({ amountCents: 95_000, chargeId: week1.id, depositCents: 50_000 }), office);
    const payment = await prisma.payment.findFirstOrThrow();

    expect(await applyPaymentAction(prisma, payment.id, { action: "undo" }, office)).toEqual({ ok: true });

    expect(await week(1)).toMatchObject({ status: "SCHEDULED", paidAt: null });
    expect(await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).toMatchObject({ status: "IGNORED", depositCents: 0, chargeId: null });
    expect(await deposit()).toBe(0);
    expect(await applyPaymentAction(prisma, payment.id, { action: "undo" }, office)).toEqual({ ok: false, code: "conflict" });
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm exec vitest run --project db --testTimeout=180000 tests/db/officePayment.test.ts`
Expected: FAIL — `Cannot find module '@/lib/payments/office'`.

- [ ] **Step 3: `bookPayment`**

Replace the body of `lib/payments/book.ts` below `PaymentNotWaiting` with:

```ts
/**
 * Books a waiting payment to a rental: one week (or none) and a deposit share
 * (or none). One payment pays at most the deposit and one week — the spec,
 * decision 3. Neither → a credit on the rental.
 */
export async function bookPayment(
  tx: Prisma.TransactionClient,
  input: {
    paymentId: string;
    rentalId: string;
    chargeId: string | null;
    depositCents: number;
    matchedBy: string;
    paidAt: Date;
    actor: Actor | null;
  }
): Promise<boolean> {
  let previousChargeStatus: string | null = null;
  if (input.chargeId) {
    const charge = await tx.charge.findUnique({ where: { id: input.chargeId }, select: { status: true, rentalId: true } });
    if (!charge || charge.rentalId !== input.rentalId) return false;
    if (!(OPEN_CHARGE as readonly string[]).includes(charge.status)) return false;
    const claimed = await tx.charge.updateMany({
      where: { id: input.chargeId, status: charge.status },
      data: { status: "PAID", paidAt: input.paidAt },
    });
    if (claimed.count === 0) return false;
    previousChargeStatus = charge.status;
  }

  // Conditional, like the charge above: of two bookings of one payment that
  // both claimed a charge, the second finds the payment already BOOKED here
  // and throws, and its transaction gives its charge back.
  const took = await tx.payment.updateMany({
    where: { id: input.paymentId, status: "NEEDS_REVIEW" },
    data: {
      status: "BOOKED",
      reviewReason: null,
      rentalId: input.rentalId,
      chargeId: input.chargeId,
      depositCents: input.depositCents,
      matchedBy: input.matchedBy,
    },
  });
  if (took.count === 0) throw new PaymentNotWaiting();
  await recordPaymentEvent(
    tx,
    input.paymentId,
    input.chargeId || input.depositCents > 0 ? "payment.booked" : "payment.credited",
    { chargeId: input.chargeId, rentalId: input.rentalId, depositCents: input.depositCents, matchedBy: input.matchedBy, previousChargeStatus },
    input.actor
  );
  return true;
}

/** A week and no deposit: what every caller before the ledger booked. */
export function bookCharge(
  tx: Prisma.TransactionClient,
  input: { paymentId: string; chargeId: string; rentalId: string; matchedBy: string; paidAt: Date; actor: Actor | null }
): Promise<boolean> {
  return bookPayment(tx, { ...input, depositCents: 0 });
}
```

- [ ] **Step 4: `actions.ts` — deposit on book, undo by method**

- `export` the existing `inTransaction` and the `OK`/`CONFLICT`/`NOT_FOUND` constants plus a `BAD_REQUEST` (`{ ok: false, code: "bad-request" }`).
- `book` in `paymentActionSchema`: add `depositCents: z.number().int().min(0).default(0)`.
- `book` handling: load the rental with `depositCents` and the sum of `depositCents` of its BOOKED payments; refuse (`bad-request`) a `depositCents` above what is still outstanding or above the payment's amount. Book every case with `bookPayment` (`chargeId` may be null; credit = null + 0), `matchedBy: "office"`. The separate credit branch goes away.
- `undo`: select `method` too.
  - `method !== "TWINT"` and status `BOOKED` → `claim(tx, id, "BOOKED", { status: "IGNORED", chargeId: null, depositCents: 0, matchedBy: null })`, restore the charge exactly as today, event `payment.cancelled`.
  - `method !== "TWINT"` and status `IGNORED` → `CONFLICT` (a cancelled office payment is not reopened; the office records a new one).
  - TWINT → as today, plus `depositCents: 0` in the claim.

- [ ] **Step 5: `lib/payments/office.ts`**

```ts
/**
 * Payments the office records by hand: cash at the desk, a card, a bank
 * transfer, or a TWINT payment whose email never came. They go through the
 * same booking as a TWINT email (bookPayment), so the week, the deposit, the
 * timeline and undo all behave the same — the spec, decision 2.
 */

import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import { zurichInstant } from "@/lib/admin/rentalPeriod";
import type { Actor } from "@/lib/fines/events";
import { BAD_REQUEST, inTransaction, NOT_FOUND, type PaymentActionResult } from "./actions";
import { bookPayment } from "./book";
import { recordPaymentEvent } from "./events";

export const officePaymentSchema = z.object({
  amountCents: z.number().int().positive().max(10_000_000),
  /** The Zurich day it was paid; stored as noon that day. */
  paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  method: z.enum(["CASH", "CARD", "BANK", "TWINT"]),
  chargeId: z.string().min(1).nullable(),
  depositCents: z.number().int().min(0).default(0),
  note: z.string().trim().max(500).default(""),
});
export type OfficePayment = z.infer<typeof officePaymentSchema>;

export async function recordOfficePayment(
  client: PrismaClient,
  rentalId: string,
  input: OfficePayment,
  actor: Actor
): Promise<PaymentActionResult> {
  const rental = await client.rental.findUnique({
    where: { id: rentalId },
    select: { organisationId: true, depositCents: true, payments: { where: { status: "BOOKED" }, select: { depositCents: true } } },
  });
  if (!rental) return NOT_FOUND;

  const outstanding = rental.depositCents - rental.payments.reduce((sum, p) => sum + p.depositCents, 0);
  if (input.depositCents > outstanding || input.depositCents > input.amountCents) return BAD_REQUEST;
  if (input.chargeId) {
    const charge = await client.charge.findFirst({ where: { id: input.chargeId, rentalId }, select: { amountCents: true } });
    if (!charge) return NOT_FOUND;
    // The whole amount is accounted for: the week and the deposit share.
    if (input.amountCents !== charge.amountCents + input.depositCents) return BAD_REQUEST;
  } else if (input.depositCents > 0 && input.amountCents !== input.depositCents) {
    return BAD_REQUEST;
  }
  const paidAt = zurichInstant(`${input.paidOn}T12:00`);
  if (!paidAt) return BAD_REQUEST;

  return inTransaction(client, async (tx) => {
    const payment = await tx.payment.create({
      data: {
        organisationId: rental.organisationId,
        externalId: `office:${randomUUID()}`,
        amountCents: input.amountCents,
        paidAt,
        method: input.method,
        note: input.note || null,
        status: "NEEDS_REVIEW",
        candidates: [rentalId],
      },
      select: { id: true },
    });
    await recordPaymentEvent(tx, payment.id, "payment.recorded", { method: input.method, note: input.note || null }, actor);
    return bookPayment(tx, {
      paymentId: payment.id,
      rentalId,
      chargeId: input.chargeId,
      depositCents: input.depositCents,
      matchedBy: "office",
      paidAt,
      actor,
    });
  });
}
```

A `bookPayment` that returns `false` (the week was paid in between) makes `inTransaction` answer `conflict` and roll the new payment back.

- [ ] **Step 6: The route**

`app/api/admin/rentals/[id]/payments/route.ts` — `POST`, the shape of `app/api/admin/payments/[id]/actions/route.ts`: `requireAdmin`, parse JSON (`400` on failure), `officePaymentSchema.safeParse`, `recordOfficePayment`, status map `{ "bad-request": 400, conflict: 409, "not-found": 404 }`.

- [ ] **Step 7: Run all payment database tests**

Run: `pnpm exec vitest run --project db --testTimeout=180000 tests/db/officePayment.test.ts tests/db/paymentActions.test.ts tests/db/paymentIngest.test.ts tests/db/paymentDryRun.test.ts`
Expected: PASS. If a `paymentActions` test asserted the old `payment.credited` payload `{ rentalId }` exactly, widen it with `toMatchObject`.

- [ ] **Step 8: Type-check, lint, commit**

```bash
git add lib/payments/book.ts lib/payments/actions.ts lib/payments/office.ts "app/api/admin/rentals/[id]/payments" tests/db/officePayment.test.ts tests/db/paymentActions.test.ts
git commit -m "feat(payments): one booking pays the deposit and a week, and the office records cash"
```

---

### Task A4: The weeks after an early return — the office decides

**Files:**
- Modify: `lib/rental/passes.ts` (`isOwedAfterReturn`), `lib/rental/passes.test.ts`
- Create: `lib/payments/afterClose.ts`
- Create: `app/api/admin/rentals/[id]/weeks-after-close/route.ts`
- Test: `tests/db/weeksAfterClose.test.ts`

**Interfaces:**
- Consumes: `RETURN_CLOSE_EVENT` (`lib/rental/closeRental.ts`), `OPEN_CHARGE`, `weeklyChargePass` (guard).
- Produces: `isOwedAfterReturn(charge: { weekNumber; dueDate; keptAfterReturn? }, returnedAt)`; `CLOSE_EVENTS`; `closedAtOf(events): Date | null`; `pendingAfterClose(charges, closedAt): string[]`; `decideWeeksAfterClose(client, rentalId, choice: "void" | "keep", actor): Promise<{ ok: true; count: number } | { ok: false; code: "conflict" | "not-found" }>`; route `POST /api/admin/rentals/[id]/weeks-after-close/` `{ choice }`.

- [ ] **Step 1: Write the failing unit test**

Add to the `isOwedAfterReturn` block in `lib/rental/passes.test.ts`:

```ts
  it("still owes a week that began after the return when the office kept it", () => {
    const returnedAt = new Date("2026-06-16T08:00:00Z");
    const week4 = { weekNumber: 4, dueDate: new Date("2026-06-22T08:00:00Z") };

    expect(isOwedAfterReturn(week4, returnedAt)).toBe(false);
    expect(isOwedAfterReturn({ ...week4, keptAfterReturn: true }, returnedAt)).toBe(true);
  });
```

- [ ] **Step 2: Write the failing database tests**

`tests/db/weeksAfterClose.test.ts` (mail mocked as in Task A2):

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { decideWeeksAfterClose } from "@/lib/payments/afterClose";
import { closeRental, RETURN_CLOSE_EVENT } from "@/lib/rental/closeRental";
import { weeklyChargePass } from "@/lib/rental/scheduler";
import type { LifecycleMailConfig } from "@/lib/rental/lifecycleMail";
import { seedOrganisation, seedRental } from "./fineHelpers";

const sent: { to: string }[] = [];
vi.mock("@/lib/rental/lifecycleMail", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/rental/lifecycleMail")>();
  return { ...original, sendMail: async (_c: unknown, message: { to: string }) => void sent.push(message) };
});
const mail: LifecycleMailConfig = { host: "localhost", port: 587, user: "u", pass: "p", from: "noreply@zuriauto.ch", office: "office@zuriauto.ch" };
beforeEach(() => void (sent.length = 0));

const office = { id: "user-1", displayName: "Ahmed" };
const RETURNED = new Date("2026-06-16T08:00:00Z"); // during week 3; weeks 4–8 had not begun

async function returnedRental() {
  const org = await seedOrganisation();
  const rental = await seedRental(org.id, { signedAt: new Date("2026-06-01T08:00:00Z") });
  await prisma.$transaction((tx) =>
    closeRental(tx, {
      organisationId: org.id, rentalId: rental.id, carId: rental.carId,
      fromStatuses: ["ACTIVE"], settlement: null,
      event: { type: RETURN_CLOSE_EVENT, payload: {} }, now: RETURNED,
    })
  );
  const week = (n: number) => prisma.charge.findFirstOrThrow({ where: { rentalId: rental.id, weekNumber: n } });
  return { org, rental, week };
}

describe("decideWeeksAfterClose", () => {
  it("voids the weeks that had not begun, and records who decided", async () => {
    const { rental, week } = await returnedRental();

    expect(await decideWeeksAfterClose(prisma, rental.id, "void", office)).toEqual({ ok: true, count: 5 });

    expect((await week(4)).status).toBe("VOID");
    expect((await week(3)).status).toBe("SCHEDULED");
    const event = await prisma.rentalEvent.findFirstOrThrow({ where: { rentalId: rental.id, type: "rental.weeks-after-close.voided" } });
    expect(event.payload).toMatchObject({ actorName: "Ahmed" });
  });

  it("keeps them owed, and the daily job then asks for them once due", async () => {
    const { rental } = await returnedRental();
    await decideWeeksAfterClose(prisma, rental.id, "keep", office);

    // 23.06: weeks 1–4 due. Weeks 1–3 began before the return; week 4 is owed only because it was kept.
    const now = new Date("2026-06-23T08:00:00Z");
    expect(await weeklyChargePass({ client: prisma, now, baseUrl: "https://zuriauto.ch", mail })).toBe(4);
  });

  it("decides only once, and only for a closed rental", async () => {
    const { rental } = await returnedRental();
    await decideWeeksAfterClose(prisma, rental.id, "void", office);
    expect(await decideWeeksAfterClose(prisma, rental.id, "keep", office)).toEqual({ ok: false, code: "conflict" });

    const org = await prisma.organisation.findFirstOrThrow();
    const running = await seedRental(org.id, { signedAt: new Date("2026-07-01T08:00:00Z"), details: { vehicleId: "prius-18-zh918474" } });
    expect(await decideWeeksAfterClose(prisma, running.id, "void", office)).toEqual({ ok: false, code: "conflict" });
  });
});
```

(`prius-18-zh918474` is ZH 918 474 in `lib/rental/fleet.ts`; any other car of the seeded fleet works.)

- [ ] **Step 3: Run both to see them fail**

Run: `pnpm test lib/rental/passes.test.ts` → FAIL (`expected false to be true`). Run the database file → FAIL (`Cannot find module '@/lib/payments/afterClose'`).

- [ ] **Step 4: Implement**

`lib/rental/passes.ts`:

```ts
export function isOwedAfterReturn(
  charge: { weekNumber: number; dueDate: Date; keptAfterReturn?: boolean },
  returnedAt: Date | null
): boolean {
  if (returnedAt === null) return true;
  if (charge.weekNumber === 0) return true;
  // The office decided this week stays owed (lib/payments/afterClose.ts).
  if (charge.keptAfterReturn) return true;
  return charge.dueDate.getTime() < returnedAt.getTime();
}
```

Extend its doc comment by one sentence about `keptAfterReturn`. The scheduler already passes the whole charge row, so no change there.

`lib/payments/afterClose.ts`:

```ts
/**
 * The weeks of a closed rental that had not begun when it closed.
 *
 * The office decides, rental by rental (the spec, decision 4): void them, or
 * keep them owed. Until it decides, today's rule holds — not chased, not
 * counted as owed — and the rental account shows them as pending.
 */

import type { PrismaClient } from "@/generated/prisma/client";
import type { Actor } from "@/lib/fines/events";
import { RETURN_CLOSE_EVENT } from "@/lib/rental/closeRental";
import { OPEN_CHARGE } from "./twint/decide";

export const CLOSE_EVENTS = [RETURN_CLOSE_EVENT, "rental.closed.manual"];

/** The first close event's moment, or null for a rental that never closed. */
export function closedAtOf(events: { type: string; createdAt: Date }[]): Date | null {
  const closes = events.filter((e) => CLOSE_EVENTS.includes(e.type)).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return closes[0]?.createdAt ?? null;
}

export function pendingAfterClose(
  charges: { id: string; weekNumber: number; dueDate: Date; status: string; keptAfterReturn: boolean }[],
  closedAt: Date | null
): string[] {
  if (!closedAt) return [];
  return charges
    .filter(
      (c) =>
        c.weekNumber >= 1 &&
        !c.keptAfterReturn &&
        (OPEN_CHARGE as readonly string[]).includes(c.status) &&
        c.dueDate.getTime() >= closedAt.getTime()
    )
    .map((c) => c.id);
}

export async function decideWeeksAfterClose(
  client: PrismaClient,
  rentalId: string,
  choice: "void" | "keep",
  actor: Actor
): Promise<{ ok: true; count: number } | { ok: false; code: "conflict" | "not-found" }> {
  const rental = await client.rental.findUnique({
    where: { id: rentalId },
    select: {
      status: true,
      events: { where: { type: { in: CLOSE_EVENTS } }, select: { type: true, createdAt: true } },
      charges: { select: { id: true, weekNumber: true, dueDate: true, status: true, keptAfterReturn: true } },
    },
  });
  if (!rental) return { ok: false, code: "not-found" };
  const pending = pendingAfterClose(rental.charges, closedAtOf(rental.events));
  if (rental.status !== "COMPLETED" || pending.length === 0) return { ok: false, code: "conflict" };

  return client.$transaction(async (tx) => {
    const moved =
      choice === "void"
        ? await tx.charge.updateMany({ where: { id: { in: pending }, status: { in: [...OPEN_CHARGE] } }, data: { status: "VOID" } })
        : await tx.charge.updateMany({ where: { id: { in: pending }, keptAfterReturn: false }, data: { keptAfterReturn: true } });
    await tx.rentalEvent.create({
      data: {
        rentalId,
        type: choice === "void" ? "rental.weeks-after-close.voided" : "rental.weeks-after-close.kept",
        payload: { chargeIds: pending, actorId: actor.id, actorName: actor.displayName },
      },
    });
    return { ok: true, count: moved.count } as const;
  });
}
```

Route `app/api/admin/rentals/[id]/weeks-after-close/route.ts` — `POST`, `requireAdmin`, body `z.object({ choice: z.enum(["void", "keep"]) })`, `409` for conflict, `404` for not-found, `{ ok: true, count }` otherwise.

- [ ] **Step 5: Run both to see them pass**

Expected: PASS (unit and 3 database tests).

- [ ] **Step 6: Prove the keep guard**

Remove the `keptAfterReturn` line from `isOwedAfterReturn`; run `-t "keeps them owed"`. Expected: FAIL `expected 3 to be 4`. Restore; PASS.

- [ ] **Step 7: Type-check, lint, commit**

```bash
git add lib/rental/passes.ts lib/rental/passes.test.ts lib/payments/afterClose.ts "app/api/admin/rentals/[id]/weeks-after-close" tests/db/weeksAfterClose.test.ts
git commit -m "feat(payments): after an early return the office voids the remaining weeks or keeps them owed"
```

---

## B · Matching

### Task B1: The payer's own rentals of the named car

**Files:**
- Modify: `lib/payments/twint/decide.ts` (types only: `PayerRental`, `Evidence.paidAt`, `Evidence.payerRentals`)
- Modify: `lib/payments/twint/evidence.ts`
- Test: `tests/db/paymentEvidence.test.ts` (new cases); `lib/payments/twint/decide.test.ts` (helper defaults)

**Interfaces:**
- Consumes: `PayerAlias` (A1), `isOwedAfterReturn` (A4), `closedAtOf`/`CLOSE_EVENTS` (A4).
- Produces:

```ts
export interface PayerRental {
  rentalId: string;
  /** COMPLETED: the payment came after the rental closed. */
  closed: boolean;
  /** Held the car at the payment's minute (the fines possession rule). */
  isHolder: boolean;
  /** The pickup contract's signature, null for a rental without one. */
  pickupAt: Date | null;
  depositCents: number;
  depositReceivedCents: number;
  /** Week 1, if it is still open. */
  week1: OpenCharge | null;
  /** Open items still owed: weeks under isOwedAfterReturn, plus week 0. */
  owedOpen: OpenCharge[];
}
// Evidence gains: paidAt: Date; payerRentals: PayerRental[]
```

- [ ] **Step 1: Write the failing tests**

Append to `tests/db/paymentEvidence.test.ts` (reuse its `setup`/`notification` helpers; `notification()` pays for Anna's ZH 513 925 from `anna@example.ch`):

```ts
describe("gatherEvidence — the payer's own rentals", () => {
  it("finds the payer's rental of the named car with its open weeks and deposit, though someone else has the car now", async () => {
    const org = await seedOrganisation();
    const anna = await seedRental(org.id, { signedAt: new Date("2026-06-01T08:00:00Z") });
    await closeAt(org.id, anna, new Date("2026-06-16T08:00:00Z"));
    const ben = await seedRental(org.id, {
      signedAt: new Date("2026-06-17T08:00:00Z"),
      details: { firstName: "Ben", lastName: "Keller", email: "ben@example.ch", mobile: "079 765 43 21" },
    });

    const e = await gatherEvidence(prisma, org.id, notification({ paidAt: new Date("2026-06-18T10:00:00Z") }));

    expect(e.holder).toMatchObject({ ok: true, rentalId: ben.id });
    expect(e.payerRentals).toEqual([
      expect.objectContaining({
        rentalId: anna.id,
        closed: true,
        isHolder: false,
        depositCents: 50_000,
        depositReceivedCents: 0,
        owedOpen: [expect.objectContaining({ weekNumber: 1 }), expect.objectContaining({ weekNumber: 2 }), expect.objectContaining({ weekNumber: 3 })],
      }),
    ]);
  });

  it("counts a remembered payer as the customer", async () => {
    const org = await seedOrganisation();
    const anna = await seedRental(org.id, { signedAt: new Date("2026-06-01T08:00:00Z") });
    await prisma.payerAlias.create({ data: { organisationId: org.id, customerId: anna.customerId, kind: "email", value: "friend@example.ch" } });

    const e = await gatherEvidence(prisma, org.id, notification({ payerEmail: "friend@example.ch", payerPhone: null }));

    expect(e.payerCustomerIds).toEqual([anna.customerId]);
    expect(e.payerRentals.map((r) => r.rentalId)).toEqual([anna.id]);
  });

  it("owes a kept week after the close, and week 0, but not a week that had not begun", async () => {
    const org = await seedOrganisation();
    const anna = await seedRental(org.id, { signedAt: new Date("2026-06-01T08:00:00Z") });
    await closeAt(org.id, anna, new Date("2026-06-16T08:00:00Z"));
    await prisma.charge.updateMany({ where: { rentalId: anna.id, weekNumber: 4 }, data: { keptAfterReturn: true } });
    await prisma.charge.create({ data: { organisationId: org.id, rentalId: anna.id, weekNumber: 0, dueDate: new Date("2026-06-20T00:00:00Z"), amountCents: 12_000 } });

    const e = await gatherEvidence(prisma, org.id, notification({ paidAt: new Date("2026-06-25T10:00:00Z") }));

    expect(e.payerRentals[0].owedOpen.map((c) => c.weekNumber).sort()).toEqual([0, 1, 2, 3, 4]);
  });
});
```

Imports to add: `closeAt` from `./fineHelpers`. In `lib/payments/twint/decide.test.ts`, add `paidAt: new Date("2026-06-10T10:00:00Z"), payerRentals: []` to the `evidence()` defaults (existing tests keep their meaning: no payer rentals → the old rules).

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm exec vitest run --project db --testTimeout=180000 tests/db/paymentEvidence.test.ts`
Expected: FAIL — `payerRentals` is `undefined`.

- [ ] **Step 3: Implement**

In `decide.ts` add `PayerRental` (above) and the two `Evidence` fields. In `evidence.ts`:

- `payerCustomers` also reads `payerAlias` (`organisationId`, `OR` of `{ kind: "email", value: email }` and `{ kind: "phone", value: phoneKey }`) and returns the union of customer ids.
- `gatherEvidence` returns `paidAt: n.paidAt` and `payerRentals`:

```ts
async function payerRentalsOf(
  client: Client,
  customerIds: string[],
  carId: string,
  holder: Responsible | null
): Promise<PayerRental[]> {
  const rentals = await client.rental.findMany({
    where: { customerId: { in: customerIds }, carId, status: { not: "CANCELLED" } },
    orderBy: { startAt: "desc" },
    select: {
      id: true,
      status: true,
      depositCents: true,
      contracts: { where: { kind: "PICKUP" }, orderBy: { signedAt: "asc" }, take: 1, select: { signedAt: true } },
      events: { where: { type: { in: CLOSE_EVENTS } }, select: { type: true, createdAt: true } },
      charges: {
        where: { status: { in: [...OPEN_CHARGE] } },
        orderBy: { dueDate: "asc" },
        select: { ...openChargeSelect, keptAfterReturn: true },
      },
      payments: { where: { status: "BOOKED" }, select: { depositCents: true } },
    },
  });
  return rentals.map((r) => {
    const closedAt = closedAtOf(r.events);
    const open = r.charges.map((c) => ({
      charge: { id: c.id, rentalId: c.rentalId, weekNumber: c.weekNumber, amountCents: c.amountCents, dueDate: c.dueDate },
      owed: isOwedAfterReturn(c, closedAt),
    }));
    return {
      rentalId: r.id,
      closed: r.status === "COMPLETED",
      isHolder: Boolean(holder?.ok && holder.rentalId === r.id),
      pickupAt: r.contracts[0]?.signedAt ?? null,
      depositCents: r.depositCents,
      depositReceivedCents: r.payments.reduce((sum, p) => sum + p.depositCents, 0),
      week1: open.find((o) => o.charge.weekNumber === 1)?.charge ?? null,
      owedOpen: open.filter((o) => o.owed).map((o) => o.charge),
    };
  });
}
```

Called only when `plate.carId && plate.status === "CONFIRMED"` and there is at least one payer customer; otherwise `[]`. (`CONFIRMED` is a plate of ours found in the text itself (`findFleetPlates`); a one-character look-alike that `suggestPlate` offers is `DOUBTFUL` and never leads a payer-led booking.)

- [ ] **Step 4: Run to see them pass, then the whole evidence and decide suites**

Run: `pnpm exec vitest run --project db --testTimeout=180000 tests/db/paymentEvidence.test.ts && pnpm test lib/payments`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/payments/twint/decide.ts lib/payments/twint/decide.test.ts lib/payments/twint/evidence.ts tests/db/paymentEvidence.test.ts
git commit -m "feat(payments): gather the payer's own rentals of the named car, remembered payers included"
```

---

### Task B2: The pickup and payer-led rules

**Files:**
- Modify: `lib/payments/twint/decide.ts`, `lib/payments/twint/decide.test.ts`
- Modify: `lib/payments/twint/ingest.ts` (book via `bookPayment`)
- Modify: `lib/payments/twint/dryRunReport.ts` (+ its test: the BOOKED fixture gains `depositCents: 0`)
- Test: `tests/db/paymentLedgerIngest.test.ts`

**Interfaces:**
- Produces: `Decision` BOOKED becomes `{ status: "BOOKED"; rentalId; chargeId: string | null; depositCents: number; matchedBy: "reference+amount" | "holder+payer+amount" | "payer+plate+amount" | "payer+plate+deposit"; candidates }`; `PICKUP_WINDOW`.

- [ ] **Step 1: Write the failing unit tests**

Update every `toEqual` on a BOOKED decision in `decide.test.ts` with `depositCents: 0`. Then add:

```ts
const payerRental = (overrides: Partial<PayerRental> = {}): PayerRental => ({
  rentalId: "rental-anna",
  closed: false,
  isHolder: true,
  pickupAt: new Date("2026-09-20T10:33:00Z"),
  depositCents: 25_000,
  depositReceivedCents: 0,
  week1: week(1, { amountCents: 25_000 }),
  owedOpen: [week(1, { amountCents: 25_000 })],
  ...overrides,
});
const atPickup = (amountCents: number, r: Partial<PayerRental> = {}) =>
  decidePayment(evidence({ amountCents, paidAt: new Date("2026-09-20T14:38:00Z"), payerRentals: [payerRental(r)] }));

describe("decidePayment — at the pickup", () => {
  it("books deposit and week 1 from one payment (ZH 615 166, 20.09: CHF 500 = 250 + 250)", () => {
    expect(atPickup(50_000)).toMatchObject({ status: "BOOKED", chargeId: "charge-w1", depositCents: 25_000, matchedBy: "payer+plate+deposit" });
  });

  it("books the deposit alone when the amount is the deposit and week 1 costs something else", () => {
    expect(atPickup(50_000, { depositCents: 50_000, week1: week(1, { amountCents: 25_000 }) }))
      .toMatchObject({ status: "BOOKED", chargeId: null, depositCents: 50_000 });
  });

  it("waits when deposit and week 1 cost the same and the amount is one of them", () => {
    expect(atPickup(25_000)).toMatchObject({ status: "NEEDS_REVIEW", reason: "PICKUP_PAYMENT", rentalId: "rental-anna" });
  });

  it("waits for any other amount at the pickup, with the rental proposed", () => {
    expect(atPickup(30_000)).toMatchObject({ status: "NEEDS_REVIEW", reason: "PICKUP_PAYMENT", rentalId: "rental-anna" });
  });

  it("is not at the pickup three days later", () => {
    const d = decidePayment(evidence({ amountCents: 25_000, paidAt: new Date("2026-09-23T12:00:00Z"), payerRentals: [payerRental()] }));
    expect(d).toMatchObject({ status: "BOOKED", chargeId: "charge-w1", depositCents: 0, matchedBy: "holder+payer+amount" });
  });
});

describe("decidePayment — payer-led", () => {
  const returned = payerRental({ closed: true, isHolder: false, pickupAt: null, depositCents: 0, owedOpen: [week(2), week(3)] });

  it("books the payer's own rental after the return, though someone else holds the car", () => {
    const d = decidePayment(evidence({ payerRentals: [returned], holder: { ok: true, rentalId: "rental-ben", customerId: "ben" } }));
    expect(d).toMatchObject({ status: "BOOKED", rentalId: "rental-anna", chargeId: "charge-w2", matchedBy: "payer+plate+amount" });
  });

  it("waits when two of the payer's rentals owe this amount", () => {
    const other = { ...returned, rentalId: "rental-anna-2", owedOpen: [week(5, { rentalId: "rental-anna-2", id: "charge-x5" })] };
    expect(decidePayment(evidence({ payerRentals: [returned, other] })))
      .toMatchObject({ status: "NEEDS_REVIEW", reason: "REFERENCE_AMBIGUOUS", candidates: expect.arrayContaining(["rental-anna", "rental-anna-2"]) });
  });

  it("says the payment came after the return when nothing owed has this amount", () => {
    expect(decidePayment(evidence({ amountCents: 9_900, payerRentals: [returned] })))
      .toMatchObject({ status: "NEEDS_REVIEW", reason: "PAID_AFTER_RETURN", rentalId: "rental-anna" });
  });

  it("leaves a doubtful plate to the old rules", () => {
    const d = decidePayment(evidence({ plate: { carId: "car-prius", status: "DOUBTFUL", reason: null }, payerRentals: [returned] }));
    expect(d).toMatchObject({ status: "NEEDS_REVIEW", reason: "PLATE_DOUBTFUL" });
  });
});
```

(Import `type PayerRental` alongside the existing imports.)

- [ ] **Step 2: Write the failing database test (the real case)**

`tests/db/paymentLedgerIngest.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { ingestMail } from "@/lib/payments/twint/ingest";
import { closeAt, seedOrganisation, seedRental } from "./fineHelpers";
import { rawMail } from "./paymentHelpers";

const signed = async () => true;

describe("ingestMail with the rental account", () => {
  // ZH 615 166 on 20.09.2026, replayed on the seed car ZH 513 925:
  // deposit 250, weekly 250, pickup 12:33; CHF 500 at 16:38; CHF 250 on 29.09.
  it("takes deposit and week 1 from the pickup payment, and does not pay week 1 again nine days later", async () => {
    const org = await seedOrganisation();
    const rental = await seedRental(org.id, {
      signedAt: new Date("2026-09-20T10:33:00Z"),
      details: { terms: { type: "WEEKLY", startAt: "2026-09-20T10:33:00.000Z", totalWeeks: 1, weeklyAmountCents: 25_000, depositCents: 25_000 } },
    });
    const deps = { client: prisma, organisationId: org.id, verify: signed };

    const first = rawMail({ amount: "CHF 500.00", date: "20.09.2026, 16:38", transaction: "aaaaaaaa-0000-0000-0000-000000000001", message: ["Prius", "ZH 513 925"] }, 1);
    expect(await ingestMail(deps, first)).toBe("booked");
    expect(await prisma.payment.findFirstOrThrow({ where: { mailUid: 1 } })).toMatchObject({ depositCents: 25_000, matchedBy: "payer+plate+deposit" });

    const second = rawMail({ amount: "CHF 250.00", date: "29.09.2026, 13:52", transaction: "aaaaaaaa-0000-0000-0000-000000000002", message: ["Toyota Prius miete", "ZH 513 925"] }, 2);
    expect(await ingestMail(deps, second)).toBe("review");
    expect(await prisma.charge.count({ where: { rentalId: rental.id, status: "PAID" } })).toBe(1);
  });

  it("books a late payment to the renter who paid, not to the one who has the car now", async () => {
    const org = await seedOrganisation();
    const anna = await seedRental(org.id, { signedAt: new Date("2026-06-01T08:00:00Z") });
    await closeAt(org.id, anna, new Date("2026-06-16T08:00:00Z"));
    const ben = await seedRental(org.id, {
      signedAt: new Date("2026-06-17T08:00:00Z"),
      details: { firstName: "Ben", lastName: "Keller", email: "ben@example.ch", mobile: "079 765 43 21" },
    });

    const late = rawMail({ amount: "CHF 450.00", date: "18.06.2026, 12:00", message: ["Restgeld", "ZH 513 925"] }, 3);
    expect(await ingestMail({ client: prisma, organisationId: org.id, verify: signed }, late)).toBe("booked");

    const payment = await prisma.payment.findFirstOrThrow({ where: { mailUid: 3 }, include: { charge: true } });
    expect(payment).toMatchObject({ rentalId: anna.id, matchedBy: "payer+plate+amount", charge: { weekNumber: 1 } });
    expect(await prisma.charge.count({ where: { rentalId: ben.id, status: "PAID" } })).toBe(0);
  });
});
```

Note: `rawMail`'s default contact is Anna's email and phone — the payer of both payments in the first test is the renter, as on 20.09.

- [ ] **Step 3: Run to see them fail**

Run: `pnpm test lib/payments/twint/decide.test.ts` → FAIL (`depositCents` missing; payer-led cases fall to the old rules). Run the database file → FAIL: the first payment waits as `AMOUNT_MISMATCH` (no week costs 500) and the second books week 1 (`expected 'booked' to be 'review'`); the late payment waits as `PAYER_MISMATCH`.

- [ ] **Step 4: Implement the rules**

In `decide.ts`:

```ts
/** "At the pickup": from a day before the signed pickup to two days after (spec decision 5). */
export const PICKUP_WINDOW = { beforeMs: 24 * 3_600_000, afterMs: 48 * 3_600_000 } as const;

const byDue = (a: OpenCharge, b: OpenCharge) => a.dueDate.getTime() - b.dueDate.getTime();

function atPickup(r: PayerRental, paidAt: Date): boolean {
  if (!r.pickupAt || r.depositReceivedCents >= r.depositCents) return false;
  const offset = paidAt.getTime() - r.pickupAt.getTime();
  return offset >= -PICKUP_WINDOW.beforeMs && offset <= PICKUP_WINDOW.afterMs;
}

type Review = (reason: PaymentReviewReason, rentalId: string | null, candidates: string[]) => Decision;

/**
 * The payer is one of our customers and the plate is a car they rented: the
 * payment is about their rental of it, whoever holds the car now. Two signals
 * still — who paid, and what car they named — and the amount must fit exactly.
 * Null when the rule does not apply, and the older rules decide.
 */
function payerLed(e: Evidence, review: Review): Decision | null {
  if (e.plate.status !== "CONFIRMED" || e.payerRentals.length === 0) return null;
  const amount = e.amountCents;

  const starting = e.payerRentals.filter((r) => atPickup(r, e.paidAt));
  if (starting.length > 1) return review("PICKUP_PAYMENT", null, starting.map((r) => r.rentalId));
  if (starting.length === 1) {
    const r = starting[0];
    const deposit = r.depositCents - r.depositReceivedCents;
    const week1 = r.week1;
    const book = (chargeId: string | null, depositCents: number): Decision => ({
      status: "BOOKED",
      rentalId: r.rentalId,
      chargeId,
      depositCents,
      matchedBy: depositCents > 0 ? "payer+plate+deposit" : r.isHolder ? "holder+payer+amount" : "payer+plate+amount",
      candidates: [r.rentalId],
    });
    // 250 when both the deposit and week 1 cost 250: which one is a guess.
    if (week1 && week1.amountCents === deposit && amount === deposit) return review("PICKUP_PAYMENT", r.rentalId, [r.rentalId]);
    if (amount === deposit) return book(null, deposit);
    if (week1 && amount === deposit + week1.amountCents) return book(week1.id, deposit);
    if (week1 && amount === week1.amountCents) return book(week1.id, 0);
    return review("PICKUP_PAYMENT", r.rentalId, [r.rentalId]);
  }

  const matching = e.payerRentals
    .map((r) => ({ r, charge: r.owedOpen.filter((c) => c.amountCents === amount).sort(byDue)[0] }))
    .filter((m): m is { r: PayerRental; charge: OpenCharge } => Boolean(m.charge));
  if (matching.length > 1) return review("REFERENCE_AMBIGUOUS", null, matching.map((m) => m.r.rentalId));
  if (matching.length === 1) {
    const { r, charge } = matching[0];
    return {
      status: "BOOKED",
      rentalId: r.rentalId,
      chargeId: charge.id,
      depositCents: 0,
      matchedBy: r.isHolder ? "holder+payer+amount" : "payer+plate+amount",
      candidates: [r.rentalId],
    };
  }
  const proposed = e.payerRentals.find((r) => r.isHolder) ?? e.payerRentals[0];
  return review(proposed.closed ? "PAID_AFTER_RETURN" : "AMOUNT_MISMATCH", proposed.rentalId, [proposed.rentalId]);
}
```

In `decidePayment`: add `depositCents: 0` to both existing BOOKED returns; widen the `matchedBy` and `PaymentReviewReason` unions; after the four reference returns and before `if (!e.plate.carId || !e.holder)`:

```ts
  const led = payerLed(e, review);
  if (led) return led;
```

`ingest.ts`: replace `bookCharge(tx, {...})` with `bookPayment(tx, { paymentId, rentalId: decision.rentalId, chargeId: decision.chargeId, depositCents: decision.depositCents, matchedBy: decision.matchedBy, paidAt: n.paidAt, actor: null })`.

`dryRunReport.ts`: the BOOKED line names what it pays — `Kaution CHF x`, `Woche` (look the week number up from the labels map is not possible; print `charge <id>` as today, prefixed with `Kaution CHF x + ` when `depositCents > 0`). Update its test fixture with `depositCents: 0`.

- [ ] **Step 5: Run everything payment**

Run: `pnpm test lib/payments && pnpm exec vitest run --project db --testTimeout=180000 tests/db/paymentLedgerIngest.test.ts tests/db/paymentIngest.test.ts tests/db/paymentDryRun.test.ts tests/db/paymentPass.test.ts`
Expected: PASS.

- [ ] **Step 6: Prove the two guards**

(a) Comment out `const led = payerLed(e, review); if (led) return led;` → the database file fails on both tests with the reasons from Step 3. (b) Restore, then change `matching.length > 1` to `matching.length > 99` → `-t "two of the payer's rentals"` fails (`BOOKED` instead of `NEEDS_REVIEW`). Restore both; PASS.

- [ ] **Step 7: Type-check, lint, commit**

```bash
git add lib/payments/twint tests/db/paymentLedgerIngest.test.ts
git commit -m "feat(payments): a payment at the pickup pays the deposit, and a late one pays the payer's own rental"
```

---

### Task B3: Remember the payer

**Files:**
- Create: `lib/payments/payerAlias.ts`
- Modify: `lib/payments/actions.ts` (`book.rememberPayer`; undo forgets)
- Test: `tests/db/payerAlias.test.ts`

**Interfaces:**
- Produces: `rememberPayer(tx, { organisationId, customerId, paymentId, email, phone, actor }): Promise<number>`; `forgetPayerFrom(tx, paymentId)`; `paymentActionSchema.book.rememberPayer: z.boolean().default(false)`.

- [ ] **Step 1: Write the failing tests**

`tests/db/payerAlias.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { applyPaymentAction } from "@/lib/payments/actions";
import { ingestMail } from "@/lib/payments/twint/ingest";
import { seedOrganisation, seedRental } from "./fineHelpers";
import { rawMail } from "./paymentHelpers";

const office = { id: "user-1", displayName: "Ahmed" };
const signed = async () => true;
const friend = { contact: ["friend@example.ch", "+41 76 555 44 33"] };

async function friendPaysTwice() {
  const org = await seedOrganisation();
  const rental = await seedRental(org.id, { signedAt: new Date("2026-06-01T08:00:00Z") });
  const deps = { client: prisma, organisationId: org.id, verify: signed };
  expect(await ingestMail(deps, rawMail({ ...friend, message: ["Miete", "ZH 513 925"], date: "02.06.2026, 12:00" }, 1))).toBe("review");
  const first = await prisma.payment.findFirstOrThrow({ where: { mailUid: 1 } });
  const week1 = await prisma.charge.findFirstOrThrow({ where: { rentalId: rental.id, weekNumber: 1 } });
  return { rental, deps, first, week1 };
}

describe("remembering the payer", () => {
  it("lets the friend's next payment book itself once the office booked the first and ticked 'Zahler merken'", async () => {
    const { rental, deps, first, week1 } = await friendPaysTwice();

    await applyPaymentAction(prisma, first.id, { action: "book", rentalId: rental.id, chargeId: week1.id, depositCents: 0, rememberPayer: true }, office);

    const next = rawMail({ ...friend, transaction: "bbbbbbbb-0000-0000-0000-000000000002", message: ["Miete", "ZH 513 925"], date: "09.06.2026, 12:00" }, 2);
    expect(await ingestMail(deps, next)).toBe("booked");
    expect(await prisma.payerAlias.findMany({ select: { kind: true, value: true, createdByName: true } })).toEqual(
      expect.arrayContaining([
        { kind: "email", value: "friend@example.ch", createdByName: "Ahmed" },
        { kind: "phone", value: "+41765554433", createdByName: "Ahmed" },
      ])
    );
  });

  it("learns nothing without the tick, and forgets on undo", async () => {
    const { rental, first, week1 } = await friendPaysTwice();
    await applyPaymentAction(prisma, first.id, { action: "book", rentalId: rental.id, chargeId: week1.id, depositCents: 0, rememberPayer: false }, office);
    expect(await prisma.payerAlias.count()).toBe(0);

    await applyPaymentAction(prisma, first.id, { action: "undo" }, office);
    await applyPaymentAction(prisma, first.id, { action: "book", rentalId: rental.id, chargeId: week1.id, depositCents: 0, rememberPayer: true }, office);
    expect(await prisma.payerAlias.count()).toBe(2);

    await applyPaymentAction(prisma, first.id, { action: "undo" }, office);
    expect(await prisma.payerAlias.count()).toBe(0);
  });
});
```

- [ ] **Step 2: Run to see them fail**

Expected: FAIL — the second payment waits (`PAYER_MISMATCH`), and `rememberPayer` is stripped by zod (`count 0`).

- [ ] **Step 3: Implement**

`lib/payments/payerAlias.ts`:

```ts
/**
 * A payer the office confirmed pays for a customer. Learnt from an office
 * booking with "Zahler merken" ticked; forgotten when that booking is undone.
 * The renter's own email and phone are never stored here — they already match.
 */

import type { Prisma } from "@/generated/prisma/client";
import type { Actor } from "@/lib/fines/events";
import { normalisePhone } from "@/lib/rental/phone";

export async function rememberPayer(
  tx: Prisma.TransactionClient,
  input: { organisationId: string; customerId: string; paymentId: string; email: string | null; phone: string | null; actor: Actor }
): Promise<number> {
  const customer = await tx.customer.findUnique({ where: { id: input.customerId }, select: { email: true, phoneKey: true } });
  const email = input.email?.trim().toLowerCase() || null;
  const phone = input.phone ? normalisePhone(input.phone) : null;
  const rows = [
    ...(email && email !== customer?.email ? [{ kind: "email", value: email }] : []),
    ...(phone && phone !== customer?.phoneKey ? [{ kind: "phone", value: phone }] : []),
  ];
  if (rows.length === 0) return 0;
  const created = await tx.payerAlias.createMany({
    data: rows.map((row) => ({
      organisationId: input.organisationId,
      customerId: input.customerId,
      ...row,
      sourcePaymentId: input.paymentId,
      createdById: input.actor.id,
      createdByName: input.actor.displayName,
    })),
    skipDuplicates: true,
  });
  return created.count;
}

export async function forgetPayerFrom(tx: Prisma.TransactionClient, paymentId: string): Promise<void> {
  await tx.payerAlias.deleteMany({ where: { sourcePaymentId: paymentId } });
}
```

`actions.ts`: `book` schema gains `rememberPayer: z.boolean().default(false)`; the book transaction, after `bookPayment` returned true and when `action.rememberPayer`, calls `rememberPayer` with the rental's `customerId` and the payment's `payerEmail`/`payerPhone` (select them), and adds `{ remembered: n }` to nothing — the count goes in a `payment.payer.remembered` event when `n > 0`. `undo` calls `forgetPayerFrom(tx, paymentId)` in both branches.

- [ ] **Step 4: Run to see them pass; prove the guard**

PASS. Then make `rememberPayer` return 0 before `createMany` → the first test fails with `expected 'review' to be 'booked'`. Restore.

- [ ] **Step 5: Commit**

```bash
git add lib/payments/payerAlias.ts lib/payments/actions.ts tests/db/payerAlias.test.ts
git commit -m "feat(payments): the office can teach the system who pays for a renter"
```

---

## C · Screens

### Task C1: The rental account, "Wofür" and who owes what

**Files:**
- Create: `lib/payments/account.ts`
- Modify: `lib/payments/queries.ts` (`PaymentRow.method/depositCents/purpose`; `PaymentChoice.depositCents/depositReceivedCents`)
- Create: `app/api/admin/rentals/[id]/account/route.ts`, `app/api/admin/payments/owed/route.ts`
- Test: `tests/db/rentalAccount.test.ts`, `tests/db/paymentQueries.test.ts` (new case)

**Interfaces:**
- Produces:

```ts
export interface AccountItem {
  chargeId: string;
  weekNumber: number;            // 0 = balance after the return
  dueDate: string;
  amountCents: number;
  status: string;                // ChargeStatus
  owed: boolean;                 // isOwedAfterReturn at the close
  pendingAfterClose: boolean;    // waiting for the office's decision (A4)
  paidBy: { paymentId: string; method: string; paidAt: string } | null;
}
export interface RentalAccount {
  rentalId: string; renterName: string; plate: string; carModel: string;
  status: string; startAt: string; endAt: string;
  closedAt: string | null; closedBy: "return" | "manual" | null;
  cutoverAt: string | null;
  deposit: { agreedCents: number; receivedCents: number; payments: { paymentId: string; method: string; paidAt: string; cents: number }[]; back: boolean | null };
  items: AccountItem[];          // weeks ascending, week 0 last
  credits: { paymentId: string; method: string; paidAt: string; amountCents: number; note: string | null }[];
  declaration: { fullyPaid: boolean | null; paymentMethods: string[]; paidAmountCents: number | null; hasDuePayment: boolean | null; dueAmountCents: number | null; dueDate: string | null; depositBack: boolean | null } | null;
  totals: { dueToDateCents: number; paidCents: number; openCents: number };
}
export interface OwedRow {
  rentalId: string; renterName: string; plate: string; status: string; closed: boolean;
  owedCents: number; oldestDue: string | null;
  depositMissingCents: number;   // running rentals started on/after the cut-over, 48 h after pickup
  pendingWeeks: number;          // closed rentals awaiting the A4 decision
}
export function rentalAccount(client, rentalId, now): Promise<RentalAccount | null>;
export function openBalances(client, organisationId, now): Promise<OwedRow[]>; // closed first, then oldest due
export type PaymentPurpose = "week" | "deposit" | "deposit+week" | "return-balance" | "credit";
```

Rules, all in `account.ts` and tested:
- `totals` count items with `owed && status !== "VOID"` and `dueDate <= now`: due += amount; paid += amount when `PAID` or `SETTLED`; open = due − paid. Week 0 included. The deposit is never in the totals.
- `paidBy` = the BOOKED payment whose `chargeId` is the item; `SETTLED` shows as settled at the cut-over (no payment).
- `declaration` = the latest `RETURN_ADDENDUM` contract's money fields.
- `openBalances` lists a rental when it has owed open items due by `now`, or `depositMissingCents > 0`, or `pendingWeeks > 0`. Cancelled rentals never.

- [ ] **Step 1: Write the failing tests**

`tests/db/rentalAccount.test.ts` covers, each as its own `it`:
1. a running rental 01.06 with a cash deposit (500) and week 1 booked by a TWINT payment: deposit `{ agreed 50000, received 50000, payments [CASH] }`, week 1 `paidBy.method "TWINT"`, at `now = 10.06` totals `{ due 90000, paid 45000, open 45000 }`;
2. after the cut-over (A2) weeks due before it read `SETTLED` with `paidBy null` and count as paid;
3. a rental returned on 16.06 with a declared balance (use `closeRental` with `settlement: { amountCents: 12000, dueDate: 2026-06-20 }` and `RETURN_CLOSE_EVENT`): week 0 is last and owed, weeks 4–8 `pendingAfterClose: true` and `owed: false`, `closedBy "return"`;
4. `openBalances` at `now = 25.06` lists the returned rental before a running one, with `owedCents` and `oldestDue`; a running rental started after the cut-over with no deposit payment 3 days after pickup has `depositMissingCents 50000`; a rental started before the cut-over never has a missing deposit.

Add to `tests/db/paymentQueries.test.ts`: a payment booked with deposit + week 1 lists `purpose: "deposit+week"`, `weekNumber: 1`, `method: "TWINT"`; a credit lists `"credit"`; week 0 lists `"return-balance"`.

- [ ] **Step 2: Run to see them fail** — `Cannot find module '@/lib/payments/account'`; `purpose` undefined.

- [ ] **Step 3: Implement** `account.ts` with one `findUnique` per rental (`include` car, customer, charges ordered by `weekNumber` with week 0 sorted last in code, payments BOOKED, events of `CLOSE_EVENTS`, latest return addendum, organisation `paymentsCutoverAt`). `openBalances` reads the organisation's non-cancelled rentals that have an open charge or a deposit above 0, and reuses the same per-rental computation (small data: tens of rentals). `queries.ts` adds the three row fields and the two choice fields.

- [ ] **Step 4: Routes** — `GET /api/admin/rentals/[id]/account/` (`404` when null) and `GET /api/admin/payments/owed/` (`{ rows }`), both `requireAdmin`, `now = new Date()`.

- [ ] **Step 5: Run to see them pass** (both files), then `pnpm test lib/payments`.

- [ ] **Step 6: Commit**

```bash
git add lib/payments/account.ts lib/payments/queries.ts "app/api/admin/rentals/[id]/account" app/api/admin/payments/owed tests/db/rentalAccount.test.ts tests/db/paymentQueries.test.ts
git commit -m "feat(payments): every rental's account, what a payment paid, and who owes what"
```

---

### Task C2: The "Mietkonto" dialog

**Files:**
- Create: `components/admin/parts/RentalAccountDialog.tsx`
- Modify: `components/admin/parts/RentalRow.tsx`, `components/admin/parts/HistoryPeriod.tsx`, `components/admin/parts/PaymentDetail.tsx` (a "Mietkonto" button each)
- Modify: `lib/admin/labels.ts` (`account` block, de + en)

**Interfaces:**
- Consumes: `GET /api/admin/rentals/[id]/account/`, `POST /api/admin/rentals/[id]/payments/`, `POST /api/admin/charges/[id]/reopen/`, `POST /api/admin/rentals/[id]/weeks-after-close/`.
- Produces: `RentalAccountDialog({ rental: { id; customerName }, L, open, onClose })` — the `DocumentsDialog` pattern (fetch on open, `Dialog` from `./Dialog`, error line from `L.errors.generic`).

Layout, top to bottom, every section a `<section>` with a small uppercase heading like the existing panels:
1. **Kaution** — "vereinbart CHF x · erhalten CHF y (Datum, Bar/TWINT…) · zurück: ja/nein/—"; "vor Systemstart" when the rental started before `cutoverAt` and nothing was recorded.
2. **Wochen** — a table: Woche · fällig · Betrag · Status (offen / bezahlt DATUM · METHOD / vor Systemstart erledigt / storniert / nach Rückgabe — Entscheid offen). A settled row has a small "Wieder öffnen" button (confirm first).
3. **Nach der Rückgabe** — week 0 when present; the renter's declaration (bezahlt ja/nein, Zahlungsarten, offen CHF x bis DATUM, Kaution zurück).
4. **Entscheid** — when any item is `pendingAfterClose`: "N Wochen begannen nach der Rückgabe." with **Stornieren** and **Bleiben geschuldet** (confirm first).
5. **Guthaben** — credits, if any.
6. **Summen** — fällig bis heute · bezahlt · offen, tabular numbers, `offen` in the critical colour when above 0.
7. **Zahlung erfassen** — a form: Betrag, Datum (default today, Zurich), Art (Bar · Karte · Bank · TWINT), Wofür (each open week · Kaution · Kaution + Woche N · Guthaben — options built from the account), Notiz; the save button disabled while the amount does not add up for the chosen purpose, with the reason shown. Writes through `useAdmin().write`, then reloads the account.

Labels (`de` / `en`), at least: `account.heading` Mietkonto / Rental account, `deposit` Kaution / Deposit, `agreed` vereinbart / agreed, `received` erhalten / received, `notReceived` noch nicht erhalten / not received yet, `beforeCutover` vor Systemstart / before the system, `back` zurück / paid back, `weeks` Wochen / Weeks, `week` Woche / Week, `due` fällig / due, `open` offen / open, `paid` bezahlt / paid, `settled` vor Systemstart erledigt / settled before the system, `void` storniert / cancelled, `pending` nach Rückgabe — Entscheid offen / after the return — undecided, `reopen` Wieder öffnen / Reopen, `afterReturn` Nach der Rückgabe / After the return, `returnBalance` Restbetrag nach Rückgabe / Balance after the return, `declaration` Angaben bei der Rückgabe / What the renter declared, `decideIntro` "{n} Wochen begannen nach der Rückgabe." / "{n} weeks began after the return.", `decideVoid` Stornieren / Cancel them, `decideKeep` Bleiben geschuldet / Still owed, `credits` Guthaben / Credit, `totals` Summen / Totals, `dueToDate` fällig bis heute / due to date, `record` Zahlung erfassen / Record a payment, `amount`, `date`, `method`, `purpose`, `note`, `save`, `methodCASH` Bar / Cash, `methodCARD` Karte / Card, `methodBANK` Bank / Bank, `methodTWINT` TWINT, `purposeWeek` Woche / Week, `purposeDeposit` Kaution / Deposit, `purposeDepositWeek` Kaution + Woche / Deposit + week, `purposeCredit` Guthaben / Credit, `amountMismatch` "Betrag passt nicht: CHF {x} erwartet" / "Amount does not add up: CHF {x} expected".

- [ ] **Step 1: Write the component and the labels; wire the three buttons** (RentalRow next to "Dokumente"; HistoryPeriod next to its documents button; PaymentDetail on the renter line when `detail.renterName`, using the booked rental, and in the book panel for the selected choice).

- [ ] **Step 2: Type-check and lint.** `pnpm exec tsc --noEmit -p . && pnpm exec eslint components/admin lib/admin`; `pnpm test lib/admin components` (labels parity tests, if present, must pass).

- [ ] **Step 3: Browser check (required).** On a **test** database (refuse the live host): seed one running rental with a cash deposit and a TWINT week, one returned rental with week 0 and pending weeks, one settled week (run `applyCutover` with a date). Start `next dev` with that `DATABASE_URL`, sign in as a test admin, open the dialog from Mieten, from Verlauf and from a payment. Screenshots at 1280 px and 390 px (`pnpm shot` or Playwright, `MSYS_NO_PATHCONV=1` under Git Bash). Check: nothing overflows sideways on the phone; the dialog scrolls; record a cash payment and see the week turn paid; reopen a settled week; decide the pending weeks. Write what was seen.

- [ ] **Step 4: Commit**

```bash
git add components/admin/parts/RentalAccountDialog.tsx components/admin/parts/RentalRow.tsx components/admin/parts/HistoryPeriod.tsx components/admin/parts/PaymentDetail.tsx lib/admin/labels.ts
git commit -m "feat(payments): the Mietkonto — deposit, weeks, the balance after the return, and cash"
```

---

### Task C3: "Wofür", the book form, "Offene Beträge" and the Overview item

**Files:**
- Modify: `components/admin/sections/PaymentsSection.tsx` (Wofür + method; tab `owed`)
- Modify: `components/admin/parts/PaymentDetail.tsx` (book form: Wofür select, Zahler merken, amount warning)
- Modify: `lib/admin/attention.ts`, `lib/admin/attention.test.ts`, `components/admin/overview/attentionText.ts`, `components/admin/overview/attentionText.test.ts`, `app/api/admin/overview/route.ts`, `components/admin/types.ts`
- Modify: `lib/admin/labels.ts` (`payments.tabOwed`, `payments.rememberPayer`, `payments.purpose*`, `payments.method*`, `payments.reasonPICKUP_PAYMENT`, `payments.reasonPAID_AFTER_RETURN`, `overview.balancesWaiting`, `overview.balanceOne/Many`)

**Interfaces:**
- Consumes: Task C1 (`purpose`, `method`, `openBalances` via `GET /api/admin/payments/owed/`), Task B3 (`rememberPayer`), Task A3 (`depositCents` on book).
- Produces: `AttentionSource.openBalances?: number`; `AttentionKind` gains `"balance"`; overview payload field `openBalances`.

- [ ] **Step 1: Write the failing unit tests**

`lib/admin/attention.test.ts`:

```ts
  it("adds one item for renters who owe money, after the payments", () => {
    const items = attentionItems({ rentals: [], paymentReview: 2, openBalances: 3 });
    expect(items.map((i) => [i.kind, i.count])).toEqual([["payment", 2], ["balance", 3]]);
  });

  it("adds nothing when nobody owes anything", () => {
    expect(attentionItems({ rentals: [], openBalances: 0 })).toEqual([]);
  });
```

`components/admin/overview/attentionText.test.ts`: the `balance` item's title is `L.overview.balancesWaiting`, its text `"3 Mieten"` (`"1 Miete"` for one), its link `/admin/payments/?tab=owed`.

- [ ] **Step 2: Run to see them fail** — `pnpm test lib/admin components/admin` → FAIL (`balance` unknown).

- [ ] **Step 3: Implement** the attention source and text; the overview route reads `openBalances(prisma, organisation.id, new Date()).length`. Reasons for the new review values in `labels.ts`: `reasonPICKUP_PAYMENT` "Zahlung bei Übergabe — bitte Kaution und Woche zuordnen" / "Paid at the pickup — please assign deposit and week"; `reasonPAID_AFTER_RETURN` "Zahlung nach Rückgabe — Betrag passt zu keinem offenen Posten" / "Paid after the return — the amount fits no open item".

- [ ] **Step 4: The screens**
  - `PaymentsSection`: the row's renter line becomes `{renter} · {plate} · {Wofür}`, Wofür from `purpose` (`Woche N`, `Kaution`, `Kaution + Woche N`, `Restbetrag nach Rückgabe`, `Guthaben`) plus a small method chip when `method !== "TWINT"`. A fourth tab **Offene Beträge** (`?tab=owed`) renders `openBalances` rows: renter, plate, "zurückgegeben" badge when closed, `offen CHF x seit DATUM`, `Kaution fehlt CHF y`, `N Wochen zu entscheiden`, and a "Mietkonto" button (C2).
  - `PaymentDetail` book form: replace "Woche wählen" with **Wofür** (each open week · Kaution · Kaution + Woche N · Guthaben; deposit options only while the chosen rental's deposit is outstanding); preselect what the amount fits; send `{ action: "book", rentalId, chargeId, depositCents, rememberPayer }`. A **Zahler merken** checkbox, checked by default when the payment has an email or phone. A warning line, not a block, when the amount differs from the chosen week + deposit.

- [ ] **Step 5: Run the tests; type-check; lint** — PASS.

- [ ] **Step 6: Browser check (required)** — the same seeded test database as C2: Zahlungen at 1280 and 390 px (Wofür readable, tab row wraps rather than scrolls), book a waiting payment as Kaution + Woche 1 with Zahler merken, the Offene Beträge tab, the Overview item and its link. Write what was seen.

- [ ] **Step 7: Commit**

```bash
git add components/admin lib/admin app/api/admin/overview
git commit -m "feat(payments): Wofür on every payment, a book form for deposits, and who owes what on the Overview"
```

---

## D · Preview, then production

### Task D1: Measure on the real emails

**Files:**
- Modify: `docs/superpowers/specs/2026-10-15-payments-ledger-design.md` (section "Measured")

- [ ] **Step 1:** With `DATABASE_URL` pointing at the **preview branch database** (Task D2 Steps 1–2 done; never the live host), run `pnpm twint:dry-run -- --days 90` **before** the cut-over on that branch. Save the output to the scratchpad.
- [ ] **Step 2:** Check the cases this plan exists for: ZH 615 166 on 20.09 (CHF 500) → would BOOK deposit + week 1; 29.09 (CHF 250) → would WAIT. List every decision that changed against the 15.10 baseline (2 booked, 32 waiting) and why.
- [ ] **Step 3:** Apply the cut-over on the branch database (`pnpm payments:cutover -- --before <go-live day>` dry, then `--commit`), run the dry run again, record both outcome tables in "Measured". Note (review, 16.10): all 34 notifications are older than any go-live day, so after the cut-over every one waits as `BEFORE_CUTOVER` — the rules are measured by the run in Step 1, before the cut-over; the run after it only confirms that count.
- [ ] **Step 3b:** Ask Eng Ahmed to confirm, on one real payment, that the renter's TWINT app shows the same Transaktions-Nr. as the email to the shop. "Barzahlung erfassen" with method TWINT relies on it; if they differ, the office must not record TWINT payments by hand (the email books them).
- [ ] **Step 4:** Commit the spec update: `docs(payments): the ledger measured on the 34 real TWINT emails`.

### Task D2: The preview, then production

**Files:**
- Modify: `docs/PAYMENTS-SETUP.md` (cut-over, cash, Mietkonto, preview database)
- Modify: `docs/client/2026-10-15-twint-payments.html` (deposit, after the return, Mietkonto, Offene Beträge)

- [ ] **Step 1: A database for the preview.** Neon console → the production project → Branches → create `preview-payments` from the production branch (or `npx neonctl branches create --name preview-payments` after `npx neonctl auth`, which the owner runs). Note its pooled and direct connection strings. Check its host is **not** `ep-snowy-heart`.
- [ ] **Step 2: Preview variables scoped to this branch.** Vercel → `zuriauto-6v88` → Settings → Environment Variables → for **Preview**, Git branch **`feat/twint-payments`** only: `DATABASE_URL` and `DATABASE_URL_UNPOOLED` = the branch's; `TWINT_IMAP_USER` / `TWINT_IMAP_PASS` = a dedicated Hostinger app password; `SMTP_HOST=smtp.invalid` so no email can reach a real customer from the copy (`.invalid` never resolves). Re-read the list and confirm both database variables show the branch host for that branch.
- [ ] **Step 3: Only now push.** `git push -u origin feat/twint-payments`. In the preview's build log, the migrate line must name the branch host. If it names `ep-snowy-heart`, stop: the live database was migrated (additively) — report it and fix the variables before anything else runs.
- [ ] **Step 4: Cut-over on the branch database** (Task D1 Step 3, if not done).
- [ ] **Step 5: A real payments pass on the preview.** `curl -X POST -H "Authorization: Bearer <Preview CRON_SECRET>" https://<preview-url>/api/cron/payments/` (add the `x-vercel-protection-bypass` header if deployment protection is on). Read the counts; open Zahlungen on the preview.
- [ ] **Step 6: Browser check on the preview** (1280 and 390 px): Zahlungen with Wofür, the ZH 615 166 Mietkonto (deposit + week 1 on 20.09, the 29.09 payment waiting), record and undo a test cash payment, the Overview item. The owner looks too.
- [ ] **Step 7: Production, with the owner's go-ahead.** Merge to `main` (the production build migrates live: additive only). Run `pnpm payments:cutover -- --before <go-live day>` against live: dry run, read it with the owner, then `--commit`. Set the TWINT variables for Production, the scheduler every 10 minutes with its failure email, call the route once and read the counts. Update `docs/PAYMENTS-SETUP.md` and the client explainer; revoke the test app password; delete the `preview-payments` branch when no longer needed.

---

## Self-review notes

- **Spec coverage:** decision 1 → A2; 2 → A3; 3 → A3, B2; 4 → A4; 5 → B1, B2; 6 → B3; 7 → C1–C3; 8 → D2. "Measured" → D1.
- **Types flow:** `PayerRental` (B1) feeds `payerLed` (B2); `Decision.depositCents` (B2) feeds `bookPayment` (A3) via `ingestMail`; `purpose` (C1) feeds C3; `AccountItem.pendingAfterClose` uses `pendingAfterClose` (A4).
- **Existing tests touched on purpose:** `decide.test.ts` BOOKED expectations gain `depositCents: 0`; `paymentActions.test.ts` may need `toMatchObject` for the credited payload; `dryRunReport.test.ts` fixture gains `depositCents: 0`. No other behaviour changes for payments without a known payer rental.
- **Out of the plan, said so:** switching the daily cron back on (precondition: A2 on live); deposit refunds; one payment across two weeks.
