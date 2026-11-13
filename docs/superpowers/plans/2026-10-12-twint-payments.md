# TWINT Payments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every TWINT payment notification that reaches our mailbox becomes a `Payment` row; when two independent signals agree it marks the right weekly `Charge` PAID by itself, otherwise it waits on a new "Zahlungen" admin screen for one click.

**Architecture:** Pure modules under `lib/payments/twint/` parse the email, check TWINT's DKIM signature, and decide the match from gathered evidence — each unit-tested without a database. A database layer gathers evidence (reusing the fines plate search and `responsibleAt`), books charges in a transaction and writes a `PaymentEvent` timeline. A cron route reads the mailbox read-only over IMAP; office actions and an admin screen handle the rest.

**Tech Stack:** Next.js 15 App Router (Node runtime), Prisma 7 + Postgres, `imapflow` (IMAP), `mailparser` (MIME), `mailauth` (DKIM), zod, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-12-twint-payments-design.md` — read it first; this plan argues from it.

## Global Constraints

- API URLs end with a slash (`trailingSlash: true` 308s the unslashed path).
- Every route touching Prisma or IMAP: `export const runtime = "nodejs"` and `export const dynamic = "force-dynamic"`.
- Every admin route starts `const user = await requireAdmin(request); if (!user) return 401 {code:"unauthorised"}`.
- TWINT prints Zurich wall-clock time; convert with `zurichInstant("YYYY-MM-DDTHH:mm")` from `lib/admin/rentalPeriod.ts`.
- Only mail with `From: no-reply@twintpay.ch` and a DKIM pass for `d=twintpay.ch` is read. No link in an email is ever followed.
- The mailbox is opened **read-only**. Nothing is flagged, moved or deleted.
- Payment identity: `@@unique([organisationId, externalId])`, `externalId` = TWINT's Transaktions-Nr.
- Auto-book only on: reference (plate + week) + exact amount, **or** plate-and-time holder = payer customer + an open charge of exactly that amount. Never on one signal.
- Open charge statuses: `SCHEDULED`, `REQUESTED`, `REMINDED`, `OVERDUE`.
- Possession rule and handover margin come from `lib/fines/possession.ts` (`HANDOVER_MARGIN_MS` = 2 h). Do not copy them.
- Office copy German and English in `lib/admin/labels.ts` (`de` and `en` objects; `en` is typed `typeof de`, so both must change together).
- Unit tests: `lib/**/*.test.ts` (`pnpm test`). Database tests: `tests/db/**/*.test.ts` (`pnpm test:db`, needs `pnpm db:up`); new tables go in the truncation list in `tests/db/setup.ts`.
- Dependencies pinned to versions at least two weeks old: `imapflow@2.0.7`, `mailparser@3.9.28`, `mailauth@6.0.0`, `@types/mailparser` (dev).
- Env: `TWINT_IMAP_USER`, `TWINT_IMAP_PASS`, `TWINT_IMAP_HOST` (default `imap.hostinger.com`), `TWINT_IMAP_PORT` (default `993`), `TWINT_IMAP_MAILBOX` (default `INBOX`), `TWINT_LOOKBACK_DAYS` (default `14`). Unset user = feature off.

## Review Focus

- A renter pays a week that is already paid (same reference twice) → the second payment waits with `CHARGE_ALREADY_PAID`; it must never silently pay a different week. Tests: Task 4 (`decidePayment`) and Task 6 (`ingestMail`).
- Someone emails the mailbox a perfect copy of TWINT's layout from another address, or TWINT's real signature with an `l=` body limit and extra text appended → stored nowhere, outcome `unsigned`. Tests: Task 3 and Task 6.
- A renter pays in the same hour they hand the car back → `HANDOVER_BOUNDARY`, waits for the office with both rentals as candidates. Test: Task 5.
- A plate typed `zh.513.925` or `ZH513925` → still recognised as ZH 513 925. Test: Task 5.
- An amount of `CHF 1'250.00` → 125000 cents, and a winter date (`05.12.2026, 10:00`) → 09:00 UTC, a summer one → 08:00 UTC. Test: Task 2.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `scripts/twint-peek.mjs` | Read-only look at the real mailbox: field layout, signature, how customers write the plate (Task 0) |
| `prisma/schema.prisma` + migration | `Payment`, `PaymentEvent`, two enums, back-relations |
| `lib/payments/twint/parse.ts` | HTML → `TwintNotification` (pure) |
| `lib/payments/twint/__fixtures__/notification.ts` | Sample email HTML for tests |
| `lib/payments/twint/authentic.ts` | DKIM check (`signedByTwint` pure + `verifyTwintSignature`) |
| `lib/payments/twint/signals.ts` | Week and printed plate out of the free text (pure) |
| `lib/payments/twint/decide.ts` | Evidence → decision (pure); `OPEN_CHARGE` |
| `lib/payments/twint/evidence.ts` | Gathers evidence from the database |
| `lib/payments/events.ts` | `recordPaymentEvent` |
| `lib/payments/book.ts` | `bookCharge` — the one place a charge becomes PAID from a payment |
| `lib/payments/twint/ingest.ts` | One raw mail → verified, parsed, stored, matched, maybe booked |
| `lib/payments/twint/mailbox.ts` | IMAP config + read-only fetch |
| `lib/payments/twint/pass.ts` | Runs `ingestMail` over the fetched mails |
| `lib/cron/auth.ts` | Bearer check shared by both cron routes (moved out of the daily route) |
| `app/api/cron/payments/route.ts` | The trigger |
| `lib/payments/actions.ts` | Office actions: book, ignore, undo |
| `lib/payments/queries.ts` | List, detail, review count |
| `app/api/admin/payments/…` | List, detail, actions routes |
| `components/admin/sections/PaymentsSection.tsx`, `components/admin/parts/PaymentDetail.tsx`, `app/admin/payments/page.tsx` | The screen |
| `lib/admin/attention.ts`, `components/admin/overview/attentionText.ts`, `app/api/admin/overview/route.ts`, `components/admin/types.ts`, `components/admin/shell/Rail.tsx`, `lib/admin/labels.ts` | Overview item, nav, copy |
| `lib/payment.ts`, `lib/rental/lifecycleMail.ts`, `lib/rental/scheduler.ts` | TWINT link carrying the reference (Task 10) |
| `docs/PAYMENTS-SETUP.md` | Go-live steps |

---

### Task 0: Look at the real mailbox before writing code

This task decides whether the rest of the plan stands as written. It writes one script and changes no application code.

**Files:**
- Create: `scripts/twint-peek.mjs`
- Modify: `package.json` (dependencies + one script)

**Interfaces:**
- Consumes: nothing.
- Produces: the installed dependencies every later task imports, and a written answer to the four gate questions in Step 5.

- [ ] **Step 1: Install the mail libraries, pinned**

```bash
pnpm add imapflow@2.0.7 mailparser@3.9.28 mailauth@6.0.0
pnpm add -D @types/mailparser
```

- [ ] **Step 2: Write the read-only peek script**

`scripts/twint-peek.mjs`:

```js
// A read-only look at TWINT's payment notifications in the mailbox.
//
// Opens the mailbox read-only (nothing is marked read, moved or deleted),
// takes only mail from no-reply@twintpay.ch, never follows a link in it,
// checks TWINT's DKIM signature the way the site will, and prints the fields.
// Payer names are masked: this checks the email's format, not who paid.
//
//   pnpm twint:peek                 the last 50, with a summary
//   pnpm twint:peek -- --html 1234  the raw HTML of message uid 1234, to save
//                                   as an anonymised test fixture
//
// Reads TWINT_IMAP_* from .env.local (see docs/PAYMENTS-SETUP.md).

import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { dkimVerify } from "mailauth/lib/dkim/verify.js";

const SENDER = "no-reply@twintpay.ch";
const LABELS = ["Betrag", "Transaktionsdatum", "Transaktions-Nr.", "Name des Stores", "Name", "Kontakt", "Nachricht"];

const user = process.env.TWINT_IMAP_USER;
const pass = process.env.TWINT_IMAP_PASS;
if (!user || !pass) throw new Error("Set TWINT_IMAP_USER and TWINT_IMAP_PASS in .env.local");

const htmlUid = process.argv.includes("--html") ? Number(process.argv[process.argv.indexOf("--html") + 1]) : null;

function lines(html) {
  return html
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(td|th|tr|p|div|h[1-6]|li|table|b|strong|span)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function fields(all) {
  const out = {};
  for (let i = 0; i < all.length; i++) {
    const label = LABELS.find((l) => all[i] === l);
    if (!label || out[label]) continue;
    const value = [];
    for (let j = i + 1; j < all.length && !LABELS.includes(all[j]); j++) {
      if (/^Kundeninformation$|^Die Kundin oder/i.test(all[j])) break;
      value.push(all[j]);
    }
    out[label] = value;
  }
  return out;
}

const mask = (s) => s.split(" ").map((w) => (w.length <= 2 ? w : w[0] + "***")).join(" ");

const client = new ImapFlow({
  host: process.env.TWINT_IMAP_HOST || "imap.hostinger.com",
  port: Number(process.env.TWINT_IMAP_PORT || 993),
  secure: true,
  auth: { user, pass },
  logger: false,
});

await client.connect();
const lock = await client.getMailboxLock(process.env.TWINT_IMAP_MAILBOX || "INBOX", { readOnly: true });
try {
  const uids = (await client.search({ from: SENDER }, { uid: true })) || [];
  const pick = htmlUid ? [htmlUid] : uids.slice(-50);
  if (!htmlUid) console.log(`${uids.length} mails from ${SENDER}; reading the last ${pick.length}\n`);
  const stats = { read: 0, signed: 0, withPlate: 0, withWeek: 0, emptyMessage: 0 };

  if (pick.length > 0) {
    for await (const msg of client.fetch(pick.join(","), { source: true }, { uid: true })) {
      const mail = await simpleParser(msg.source);
      if (htmlUid) {
        process.stdout.write(mail.html || mail.textAsHtml || "");
        continue;
      }
      const dkim = await dkimVerify(msg.source);
      const pass = dkim.results.find((r) => r.status.result === "pass" && r.signingDomain === "twintpay.ch");
      const f = fields(lines(mail.html || mail.textAsHtml || ""));
      const message = (f["Nachricht"] ?? []).join(" / ");
      const plate = /ZH[\s.\-]*\d(?:[\s.\-]?\d){2,6}/i.exec(message)?.[0];
      const week = /(?:^|[^A-Z])W(?:oche)?\s?(\d{1,2})(?!\d)/i.exec(message)?.[1];

      stats.read++;
      if (pass) stats.signed++;
      if (plate) stats.withPlate++;
      if (week) stats.withWeek++;
      if (!message) stats.emptyMessage++;

      console.log(`uid ${msg.uid} · ${mail.date?.toISOString()} · DKIM ${pass ? "pass" : "NONE"}`);
      if (pass) {
        console.log(`  body limited: ${pass.canonBodyLengthLimited} · signed headers: ${JSON.stringify(pass.signingHeaders?.keys)}`);
      } else {
        console.log(`  dkim: ${dkim.results.map((r) => r.info).join(" | ")}`);
      }
      for (const label of LABELS) {
        const value = f[label];
        const shown = label === "Name" || label === "Kontakt" ? (value ? mask(value.join(" ")) : "?") : value?.join(" | ") ?? "?";
        console.log(`  ${label.padEnd(18)} ${shown}`);
      }
      console.log(`  -> plate ${plate ?? "none"} · week ${week ?? "none"}\n`);
    }
  }
  if (!htmlUid) console.log("Summary", stats);
} finally {
  lock.release();
  await client.logout();
}
```

Add to `package.json` scripts, beside `check-mail`:

```json
"twint:peek": "node --env-file=.env.local scripts/twint-peek.mjs",
```

- [ ] **Step 3: Put the mailbox login in `.env.local` (never in git, never in chat)**

```
TWINT_IMAP_USER=info@zuriauto.ch
TWINT_IMAP_PASS=<the mailbox password>
```

Run: `git check-ignore -v .env.local`
Expected: `.gitignore:34:.env*	.env.local`

- [ ] **Step 4: Run it**

Run: `pnpm twint:peek`
Expected: one block per TWINT email and a summary such as `{ read: 23, signed: 23, withPlate: 17, withWeek: 2, emptyMessage: 3 }`.

- [ ] **Step 5: Answer the gate questions in writing (append to the spec under "Findings from the real mailbox")**

1. Does every email print the seven labels exactly as in `LABELS`? If a label differs (e.g. `Zahlungszweck`), note the real one; Task 2's `LABELS` follows it.
2. Is `signed` equal to `read`, `body limited: false`, and does the signed-headers list contain `from`? If not, stop: the authenticity rule in Task 3 needs rethinking before anything is built.
3. How do customers write the plate and the week? Copy five anonymised `message` lines into the spec.
4. Save two anonymised fixtures: `pnpm twint:peek -- --html <uid> > tmp.html` for one with a plate and one with an empty Nachricht. Replace the payer's name, email and phone by hand with `Anna Meier`, `anna@example.ch`, `+41791234567`, and keep everything else byte for byte. Task 2 uses them.

- [ ] **Step 6: The test payment**

Ask Eng Ahmed to pay CHF 1.00 through this link from a private TWINT account (the link is `TWINT_URL` from `lib/payment.ts` plus two parameters):

```
<TWINT_URL>&trxInfo=ZH%20513%20925%20W1&amount=1.00
```

Run `pnpm twint:peek` again. Record in the spec where `ZH 513 925 W1` appears in the email (Nachricht, or another label). Task 10 depends on it.

- [ ] **Step 7: Commit**

```bash
git add scripts/twint-peek.mjs package.json pnpm-lock.yaml docs/superpowers/specs/2026-10-12-twint-payments-design.md
git commit -m "chore(payments): a read-only look at TWINT's notifications in the mailbox"
```

---

### Task 1: The `Payment` and `PaymentEvent` tables

**Files:**
- Modify: `prisma/schema.prisma` (new enums + models; back-relations on `Organisation`, `Rental`, `Charge`)
- Create: `prisma/migrations/<timestamp>_twint_payments/migration.sql` (generated)
- Modify: `tests/db/setup.ts` (truncation list)
- Test: `tests/db/paymentSchema.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: Prisma models `payment` (fields as below; compound unique `organisationId_externalId`) and `paymentEvent`; enums `PaymentStatus`, `PaymentReviewReason`.

- [ ] **Step 1: Write the failing test**

`tests/db/paymentSchema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { seedOrganisation } from "./fineHelpers";

/** The idempotency of reading the mailbox is this constraint, not a flag. */
describe("Payment", () => {
  const row = (organisationId: string) => ({
    organisationId,
    externalId: "ce21e52e-2354-4f6d-a7d7-64a448f335f8",
    amountCents: 25_000,
    paidAt: new Date("2026-10-05T08:00:00Z"),
    status: "NEEDS_REVIEW" as const,
    reviewReason: "NO_PLATE" as const,
  });

  it("stores one row per TWINT transaction number", async () => {
    const org = await seedOrganisation();
    await prisma.payment.create({ data: row(org.id) });

    await expect(prisma.payment.create({ data: row(org.id) })).rejects.toMatchObject({ code: "P2002" });
  });

  it("keeps a timeline per payment", async () => {
    const org = await seedOrganisation();
    const payment = await prisma.payment.create({ data: row(org.id) });
    await prisma.paymentEvent.create({ data: { paymentId: payment.id, type: "payment.received" } });

    expect(await prisma.paymentEvent.count({ where: { paymentId: payment.id } })).toBe(1);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm db:up && pnpm test:db tests/db/paymentSchema.test.ts`
Expected: FAIL — TypeScript/runtime error `Property 'payment' does not exist on type PrismaClient`.

- [ ] **Step 3: Add the schema**

Append to `prisma/schema.prisma`:

```prisma
/// Where a payment stands. See docs/superpowers/specs/2026-10-12-twint-payments-design.md.
enum PaymentStatus {
  /// Paid a charge (or credited a rental), by the system or by a person.
  BOOKED
  NEEDS_REVIEW
  /// A test payment, or one that is not ours to book. Kept, never deleted.
  IGNORED
}

enum PaymentReviewReason {
  NO_PLATE
  PLATE_NOT_IN_FLEET
  PLATE_AMBIGUOUS
  PLATE_DOUBTFUL
  NO_RENTAL_AT_TIME
  HANDOVER_BOUNDARY
  OVERLAPPING_RENTALS
  PAYER_MISMATCH
  AMOUNT_MISMATCH
  CHARGE_ALREADY_PAID
}

/// One TWINT transaction, as its notification email reported it.
model Payment {
  id             String @id @default(cuid())
  organisationId String

  /// TWINT's Transaktions-Nr. The unique key below is what makes reading the
  /// mailbox again harmless.
  externalId  String
  amountCents Int
  currency    String   @default("CHF")
  /// TWINT's Transaktionsdatum: Zurich wall clock, to the minute.
  paidAt      DateTime
  storeName   String?
  payerName   String?
  payerEmail  String?
  payerPhone  String?
  /// The customer's free text — where a plate and a week are, if anywhere.
  message     String?

  status       PaymentStatus
  reviewReason PaymentReviewReason?
  /// "reference+amount", "holder+payer+amount" or "office".
  matchedBy    String?
  /// Rentals the office chooses between when the rule could not.
  candidates   String[] @default([])

  rentalId String?
  chargeId String?
  /// The IMAP UID it was read from, for finding the email again.
  mailUid  Int?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  organisation Organisation   @relation(fields: [organisationId], references: [id])
  rental       Rental?        @relation(fields: [rentalId], references: [id])
  charge       Charge?        @relation(fields: [chargeId], references: [id])
  events       PaymentEvent[]

  @@unique([organisationId, externalId])
  @@index([organisationId, status])
  @@index([chargeId])
}

/// The payment's timeline: received, booked, ignored, undone — and by whom.
model PaymentEvent {
  id        String   @id @default(cuid())
  paymentId String
  type      String
  payload   Json?
  /// Null for the system.
  actorId   String?
  actorName String?
  createdAt DateTime @default(now())

  payment Payment @relation(fields: [paymentId], references: [id])

  @@index([paymentId, createdAt])
}
```

Add the back-relations:

```prisma
// in model Organisation, after fineDocuments
  payments      Payment[]

// in model Rental, after tokens
  payments      Payment[]

// in model Charge, after the rental relation
  payments Payment[]
```

- [ ] **Step 4: Generate the migration and add the tables to the truncation list**

Run: `pnpm db:migrate --name twint_payments`
Expected: `prisma/migrations/<timestamp>_twint_payments/migration.sql` created and applied; client regenerated.

In `tests/db/setup.ts`, add `"PaymentEvent", "Payment",` to the `TRUNCATE TABLE` list right after `"FineDocument", "Fine",`.

- [ ] **Step 5: Run the test to see it pass**

Run: `pnpm test:db tests/db/paymentSchema.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations tests/db/setup.ts tests/db/paymentSchema.test.ts
git commit -m "feat(payments): a table for TWINT payments and their timeline"
```

---

### Task 2: Read the notification email

**Files:**
- Create: `lib/payments/twint/parse.ts`
- Create: `lib/payments/twint/__fixtures__/notification.ts`
- Test: `lib/payments/twint/parse.test.ts`

**Interfaces:**
- Consumes: `zurichInstant(value: string): Date | null` from `@/lib/admin/rentalPeriod`.
- Produces:
  - `interface TwintNotification { externalId: string; amountCents: number; currency: string; paidAt: Date; storeName: string | null; payerName: string | null; payerEmail: string | null; payerPhone: string | null; message: string | null }`
  - `type ParseResult = { ok: true; notification: TwintNotification } | { ok: false; reason: "NOT_A_PAYMENT" | "FIELD_MISSING" | "FIELD_UNREADABLE"; field?: Label }`
  - `parseNotification(html: string): ParseResult`
  - `parseAmount(text: string): number | null`, `parseTwintDate(text: string): Date | null`, `htmlToLines(html: string): string[]`
  - `SAMPLE_HTML` and `sampleHtml(overrides)` from the fixture.

- [ ] **Step 1: Write the fixture**

`lib/payments/twint/__fixtures__/notification.ts` (rebuilt from the 05.10.2026 screenshot; if Task 0 saved real anonymised HTML, export it here as well and run every test below against both):

```ts
/**
 * TWINT's "erfolgreiche Transaktion" email, rebuilt from the 05.10.2026
 * screenshot Eng Ahmed sent. The real HTML (Task 0) is the authority; this
 * keeps the tests readable and lets them vary one field at a time.
 */

export interface SampleFields {
  amount: string;
  date: string;
  transaction: string;
  store: string;
  name: string[];
  contact: string[];
  message: string[];
}

export const SAMPLE: SampleFields = {
  amount: "CHF 250.00",
  date: "05.10.2026, 10:00",
  transaction: "ce21e52e-2354-4f6d-a7d7-64a448f335f8",
  store: "Zuriauto",
  name: ["Anna", "Meier"],
  contact: ["anna@example.ch", "+41791234567"],
  message: ["Auto vermieten", "ZH 513 925 W2"],
};

const cell = (label: string, lines: string[]) =>
  `<tr><td style="padding:8px"><b>${label}</b><br>${lines.join("<br>")}</td></tr>`;

export function sampleHtml(overrides: Partial<SampleFields> = {}): string {
  const f = { ...SAMPLE, ...overrides };
  return [
    "<html><head><style>td{font-family:Arial}</style></head><body>",
    "<h2>Hallo Zuriauto</h2><p>Sie haben soeben eine erfolgreiche Transaktion erhalten!</p>",
    "<table>",
    cell("Betrag", [f.amount]),
    cell("Transaktionsdatum", [f.date]),
    cell("Transaktions-Nr.", [f.transaction]),
    cell("Name des Stores", [f.store]),
    "</table>",
    "<h3>Kundeninformation</h3>",
    '<p>Die Kundin oder der Kunde hat bei dieser Zahlung die folgenden Informationen angegeben. Sie können diese Informationen auch aus dem Händler-Portal exportieren, und zwar im Bereich <a href="https://portal.twint.ch">Transaktionen</a>.</p>',
    "<table>",
    cell("Name", f.name),
    cell("Kontakt", f.contact.map((c) => (c.includes("@") ? `<a href="mailto:${c}">${c}</a>` : c))),
    cell("Nachricht", f.message),
    "</table></body></html>",
  ].join("\n");
}

export const SAMPLE_HTML = sampleHtml();
```

- [ ] **Step 2: Write the failing tests**

`lib/payments/twint/parse.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { SAMPLE_HTML, sampleHtml } from "./__fixtures__/notification";
import { parseAmount, parseNotification, parseTwintDate } from "./parse";

describe("parseNotification", () => {
  it("reads every field of TWINT's email", () => {
    expect(parseNotification(SAMPLE_HTML)).toEqual({
      ok: true,
      notification: {
        externalId: "ce21e52e-2354-4f6d-a7d7-64a448f335f8",
        amountCents: 25_000,
        currency: "CHF",
        paidAt: new Date("2026-10-05T08:00:00.000Z"),
        storeName: "Zuriauto",
        payerName: "Anna Meier",
        payerEmail: "anna@example.ch",
        payerPhone: "+41791234567",
        message: "Auto vermieten\nZH 513 925 W2",
      },
    });
  });

  it("leaves an empty Nachricht as null rather than failing", () => {
    const result = parseNotification(sampleHtml({ message: [] }));
    expect(result.ok && result.notification.message).toBeNull();
  });

  it("refuses an email without the TWINT fields", () => {
    expect(parseNotification("<p>Ihre Bestellung ist unterwegs</p>")).toEqual({ ok: false, reason: "NOT_A_PAYMENT" });
  });

  it("names the field it could not read", () => {
    expect(parseNotification(sampleHtml({ date: "gestern" }))).toEqual({
      ok: false,
      reason: "FIELD_UNREADABLE",
      field: "Transaktionsdatum",
    });
  });

  it("decodes HTML entities in the customer's text", () => {
    const result = parseNotification(sampleHtml({ message: ["Miete &amp; Kaution ZH 513 925"] }));
    expect(result.ok && result.notification.message).toBe("Miete & Kaution ZH 513 925");
  });
});

describe("parseAmount", () => {
  it.each([
    ["CHF 250.00", 25_000],
    ["CHF 1'250.00", 125_000],
    ["CHF 1’250.50", 125_050],
    ["CHF 40", 4_000],
  ])("%s → %i cents", (text, cents) => {
    expect(parseAmount(text)).toBe(cents);
  });

  it("refuses zero and non-amounts", () => {
    expect(parseAmount("CHF 0.00")).toBeNull();
    expect(parseAmount("zweihundert")).toBeNull();
  });
});

describe("parseTwintDate", () => {
  it("reads Zurich summer time", () => {
    expect(parseTwintDate("05.07.2026, 10:00")).toEqual(new Date("2026-07-05T08:00:00Z"));
  });

  it("reads Zurich winter time", () => {
    expect(parseTwintDate("05.12.2026, 10:00")).toEqual(new Date("2026-12-05T09:00:00Z"));
  });

  it("refuses a date that does not exist", () => {
    expect(parseTwintDate("31.02.2026, 10:00")).toBeNull();
  });
});
```

- [ ] **Step 3: Run them to see them fail**

Run: `pnpm test lib/payments/twint/parse.test.ts`
Expected: FAIL — `Cannot find module './parse'`.

- [ ] **Step 4: Write the parser**

`lib/payments/twint/parse.ts`:

```ts
/**
 * TWINT's payment notification, read.
 *
 * The email is a fixed machine template: a label in one table cell, its value
 * on the lines under it. Reading it is therefore a lookup, not an
 * interpretation — which is why there is no AI here (see the spec).
 *
 * Four fields TWINT fills itself and are trusted: amount, moment, transaction
 * number, store. Three the customer types and are only evidence: name,
 * contact, Nachricht.
 */

import { zurichInstant } from "@/lib/admin/rentalPeriod";

export const LABELS = [
  "Betrag",
  "Transaktionsdatum",
  "Transaktions-Nr.",
  "Name des Stores",
  "Name",
  "Kontakt",
  "Nachricht",
] as const;
export type Label = (typeof LABELS)[number];

export interface TwintNotification {
  externalId: string;
  amountCents: number;
  currency: string;
  paidAt: Date;
  storeName: string | null;
  payerName: string | null;
  payerEmail: string | null;
  payerPhone: string | null;
  message: string | null;
}

export type ParseResult =
  | { ok: true; notification: TwintNotification }
  | { ok: false; reason: "NOT_A_PAYMENT" | "FIELD_MISSING" | "FIELD_UNREADABLE"; field?: Label };

const ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
};

/** One line per cell, paragraph or <br>. Single pass over entities, so
 *  "&amp;lt;" stays "&lt;" rather than becoming "<". */
export function htmlToLines(html: string): string[] {
  return html
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(td|th|tr|p|div|h[1-6]|li|table|b|strong|span)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);|&[a-z]+;/gi, (entity, code: string | undefined) =>
      code ? String.fromCharCode(Number(code)) : (ENTITIES[entity.toLowerCase()] ?? entity)
    )
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/** The lines under each label, up to the next label or the intro paragraph. */
function labelled(lines: string[]): Partial<Record<Label, string[]>> {
  const out: Partial<Record<Label, string[]>> = {};
  const isLabel = (line: string) => (LABELS as readonly string[]).includes(line);
  for (let i = 0; i < lines.length; i += 1) {
    const label = LABELS.find((l) => l === lines[i]);
    if (!label || out[label]) continue;
    const value: string[] = [];
    for (let j = i + 1; j < lines.length && !isLabel(lines[j]); j += 1) {
      if (/^Kundeninformation$|^Die Kundin oder/i.test(lines[j])) break;
      value.push(lines[j]);
    }
    out[label] = value;
  }
  return out;
}

/** "CHF 1'250.00" → 125000. Null for anything that is not a positive amount. */
export function parseAmount(text: string): number | null {
  const match = /CHF\s*(\d[\d'’ ]*)(?:[.,](\d{2}))?/i.exec(text);
  if (!match) return null;
  const cents = Number(match[1].replace(/['’ ]/g, "")) * 100 + Number(match[2] ?? "0");
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

/** "05.10.2026, 10:00", Zurich wall clock → the instant. */
export function parseTwintDate(text: string): Date | null {
  const match = /^(\d{2})\.(\d{2})\.(\d{4}),?\s+(\d{2}):(\d{2})$/.exec(text.trim());
  if (!match) return null;
  const [, day, month, year, hour, minute] = match;
  const instant = zurichInstant(`${year}-${month}-${day}T${hour}:${minute}`);
  // zurichInstant normalises 31.02 to 03.03; a date TWINT never printed is refused.
  if (!instant) return null;
  const back = new Intl.DateTimeFormat("de-CH", {
    timeZone: "Europe/Zurich",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(instant);
  return back === `${day}.${month}.${year}` ? instant : null;
}

const text = (value: string[] | undefined, joiner: string) =>
  value && value.length > 0 ? value.join(joiner) : null;

export function parseNotification(html: string): ParseResult {
  const f = labelled(htmlToLines(html));
  if (!f["Betrag"] && !f["Transaktions-Nr."]) return { ok: false, reason: "NOT_A_PAYMENT" };

  for (const field of ["Betrag", "Transaktionsdatum", "Transaktions-Nr."] as const) {
    if (!f[field]?.length) return { ok: false, reason: "FIELD_MISSING", field };
  }

  const amountCents = parseAmount(f["Betrag"]!.join(" "));
  if (amountCents === null) return { ok: false, reason: "FIELD_UNREADABLE", field: "Betrag" };

  const paidAt = parseTwintDate(f["Transaktionsdatum"]!.join(" "));
  if (!paidAt) return { ok: false, reason: "FIELD_UNREADABLE", field: "Transaktionsdatum" };

  const externalId = f["Transaktions-Nr."]!.join("").trim();
  if (!/^[0-9a-f][0-9a-f-]{7,}$/i.test(externalId)) {
    return { ok: false, reason: "FIELD_UNREADABLE", field: "Transaktions-Nr." };
  }

  const contact = f["Kontakt"] ?? [];
  return {
    ok: true,
    notification: {
      externalId: externalId.toLowerCase(),
      amountCents,
      currency: "CHF",
      paidAt,
      storeName: text(f["Name des Stores"], " "),
      payerName: text(f["Name"], " "),
      payerEmail: contact.find((line) => line.includes("@"))?.toLowerCase() ?? null,
      payerPhone: contact.find((line) => /^\+?[\d\s()/-]{7,}$/.test(line)) ?? null,
      message: text(f["Nachricht"], "\n"),
    },
  };
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `pnpm test lib/payments/twint/parse.test.ts`
Expected: PASS. If the 31.02 case passes without the round-trip check, delete that check — `zurichInstant` already refuses it — and keep the test.

- [ ] **Step 6: Commit**

```bash
git add lib/payments/twint/parse.ts lib/payments/twint/parse.test.ts lib/payments/twint/__fixtures__/notification.ts
git commit -m "feat(payments): read TWINT's payment notification"
```

---

### Task 3: Only TWINT's own signature counts

**Files:**
- Create: `lib/payments/twint/authentic.ts`
- Test: `lib/payments/twint/authentic.test.ts`

**Interfaces:**
- Consumes: `dkimVerify` from `mailauth/lib/dkim/verify`.
- Produces: `TWINT_SENDER = "no-reply@twintpay.ch"`, `signedByTwint(report: DkimReport): boolean`, `verifyTwintSignature(raw: Buffer): Promise<boolean>`.

- [ ] **Step 1: Write the failing tests**

`lib/payments/twint/authentic.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { signedByTwint, verifyTwintSignature, type DkimReport } from "./authentic";

const pass = {
  signingDomain: "twintpay.ch",
  status: { result: "pass" },
  canonBodyLengthLimited: false,
  signingHeaders: { keys: ["From", "To", "Subject", "Date"] },
};
const report = (overrides: Partial<DkimReport> = {}): DkimReport => ({
  headerFrom: ["no-reply@twintpay.ch"],
  results: [pass],
  ...overrides,
});

describe("signedByTwint", () => {
  it("accepts TWINT's own passing signature over From", () => {
    expect(signedByTwint(report())).toBe(true);
  });

  it("refuses a signature by another domain", () => {
    expect(signedByTwint(report({ results: [{ ...pass, signingDomain: "twintpay.ch.example.com" }] }))).toBe(false);
  });

  it("refuses a signature that did not verify", () => {
    expect(signedByTwint(report({ results: [{ ...pass, status: { result: "fail" } }] }))).toBe(false);
  });

  it("refuses a signature with a body-length limit, which lets text be appended", () => {
    expect(signedByTwint(report({ results: [{ ...pass, canonBodyLengthLimited: true }] }))).toBe(false);
  });

  it("refuses a signature that does not cover From", () => {
    expect(signedByTwint(report({ results: [{ ...pass, signingHeaders: { keys: ["Subject"] } }] }))).toBe(false);
  });

  it("refuses another sender, even signed", () => {
    expect(signedByTwint(report({ headerFrom: ["billing@twintpay.ch"] }))).toBe(false);
    expect(signedByTwint(report({ headerFrom: ["no-reply@twintpay.ch", "x@evil.example"] }))).toBe(false);
  });
});

describe("verifyTwintSignature", () => {
  it("refuses an unsigned message that only looks like TWINT's", async () => {
    const forged = Buffer.from(
      "From: no-reply@twintpay.ch\r\nTo: info@zuriauto.ch\r\nSubject: Zahlung\r\n\r\n<b>Betrag</b><br>CHF 2000.00\r\n"
    );
    expect(await verifyTwintSignature(forged)).toBe(false);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm test lib/payments/twint/authentic.test.ts`
Expected: FAIL — `Cannot find module './authentic'`.

- [ ] **Step 3: Write the check**

`lib/payments/twint/authentic.ts`:

```ts
/**
 * Is this really TWINT?
 *
 * Anyone can send info@ an email laid out exactly like TWINT's. What they
 * cannot do is sign it with TWINT's key: twintpay.ch publishes DKIM keys
 * (selector1/2, its Microsoft 365 tenant) and DMARC p=reject. The site checks
 * the signature itself rather than trusting a header Hostinger may or may not
 * add, and asks three things of it beyond "pass":
 *
 *   - it is TWINT's domain that signed, not a lookalike;
 *   - it covers From, so the sender cannot be swapped under it;
 *   - it has no l= body limit, under which text can be appended unsigned.
 */

import { dkimVerify } from "mailauth/lib/dkim/verify";

export const TWINT_SENDER = "no-reply@twintpay.ch";
const TWINT_DOMAIN = "twintpay.ch";

/** The part of mailauth's result this check reads. */
export interface DkimReport {
  headerFrom: string[];
  results: Array<{
    signingDomain?: string;
    status: { result: string };
    canonBodyLengthLimited?: boolean;
    signingHeaders?: { keys: string[] };
  }>;
}

export function signedByTwint(report: DkimReport): boolean {
  const from = report.headerFrom.map((address) => address.toLowerCase());
  if (from.length !== 1 || from[0] !== TWINT_SENDER) return false;
  return report.results.some(
    (result) =>
      result.status.result === "pass" &&
      result.signingDomain?.toLowerCase() === TWINT_DOMAIN &&
      result.canonBodyLengthLimited !== true &&
      (result.signingHeaders?.keys ?? []).some((key) => key.toLowerCase() === "from")
  );
}

export async function verifyTwintSignature(raw: Buffer): Promise<boolean> {
  try {
    return signedByTwint((await dkimVerify(raw)) as DkimReport);
  } catch (error) {
    // A DNS failure is not a pass. The mail stays in the mailbox and the next
    // run tries again; nothing is stored in between.
    console.warn("[twint] DKIM check could not run:", error);
    return false;
  }
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `pnpm test lib/payments/twint/authentic.test.ts`
Expected: PASS (7 tests). If TypeScript cannot resolve `mailauth/lib/dkim/verify`, import `"mailauth/lib/dkim/verify.js"` — the package ships `verify.d.ts` beside it.

- [ ] **Step 5: Commit**

```bash
git add lib/payments/twint/authentic.ts lib/payments/twint/authentic.test.ts
git commit -m "feat(payments): only mail TWINT itself signed is read"
```

---

### Task 4: The decision, as a pure function

**Files:**
- Create: `lib/payments/twint/signals.ts`
- Create: `lib/payments/twint/decide.ts`
- Test: `lib/payments/twint/signals.test.ts`, `lib/payments/twint/decide.test.ts`

**Interfaces:**
- Consumes: `Responsible` from `@/lib/fines/possession`.
- Produces:
  - `weekOf(message: string): number | null`, `printedPlate(message: string): string | null`
  - `OPEN_CHARGE: readonly ["SCHEDULED","REQUESTED","REMINDED","OVERDUE"]`
  - `interface OpenCharge { id: string; rentalId: string; weekNumber: number; amountCents: number; dueDate: Date }`
  - `type PaymentReviewReason` (the ten enum values as a string union)
  - `type Reference = { kind: "open"; charge: OpenCharge } | { kind: "paid"; rentalId: string } | { kind: "none" }`
  - `interface Evidence { amountCents: number; plate: { carId: string | null; status: "CONFIRMED" | "DOUBTFUL" | "MISSING"; reason: "PLATE_AMBIGUOUS" | "PLATE_NOT_IN_FLEET" | null }; reference: Reference; holder: Responsible | null; holderOpenCharges: OpenCharge[]; payerCustomerIds: string[]; payerRentalIds: string[] }`
  - `type Decision = { status: "BOOKED"; rentalId: string; chargeId: string; matchedBy: "reference+amount" | "holder+payer+amount"; candidates: string[] } | { status: "NEEDS_REVIEW"; reason: PaymentReviewReason; rentalId: string | null; candidates: string[] }`
  - `decidePayment(e: Evidence): Decision`

- [ ] **Step 1: Write the failing tests for the signals**

`lib/payments/twint/signals.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { printedPlate, weekOf } from "./signals";

describe("weekOf", () => {
  it.each([
    ["ZH 513 925 W2", 2],
    ["ZH513925 w 12", 12],
    ["Miete Woche 3 ZH 513 925", 3],
    ["ZH 513 925", null],
    ["Auto vermieten", null],
    ["W0", null],
  ])("%s → %s", (message, week) => {
    expect(weekOf(message)).toBe(week);
  });
});

describe("printedPlate", () => {
  it.each([
    ["Auto vermieten\nZH918747", "ZH918747"],
    ["zh.513.925 W2", "zh.513.925"],
    ["Danke!", null],
  ])("%s → %s", (message, plate) => {
    expect(printedPlate(message)).toBe(plate);
  });
});
```

- [ ] **Step 2: Write the failing tests for the decision**

`lib/payments/twint/decide.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { decidePayment, type Evidence, type OpenCharge } from "./decide";

const week = (n: number, overrides: Partial<OpenCharge> = {}): OpenCharge => ({
  id: `charge-w${n}`,
  rentalId: "rental-anna",
  weekNumber: n,
  amountCents: 45_000,
  dueDate: new Date(`2026-06-${String(n * 7).padStart(2, "0")}T00:00:00Z`),
  ...overrides,
});

const evidence = (overrides: Partial<Evidence> = {}): Evidence => ({
  amountCents: 45_000,
  plate: { carId: "car-prius", status: "CONFIRMED", reason: null },
  reference: { kind: "none" },
  holder: { ok: true, rentalId: "rental-anna", customerId: "anna" },
  holderOpenCharges: [week(2), week(3)],
  payerCustomerIds: ["anna"],
  payerRentalIds: ["rental-anna"],
  ...overrides,
});

describe("decidePayment", () => {
  it("books the referenced week when the amount is that week's", () => {
    expect(decidePayment(evidence({ reference: { kind: "open", charge: week(3) } }))).toEqual({
      status: "BOOKED",
      rentalId: "rental-anna",
      chargeId: "charge-w3",
      matchedBy: "reference+amount",
      candidates: ["rental-anna"],
    });
  });

  it("does not book a referenced week for a different amount", () => {
    const d = decidePayment(evidence({ amountCents: 20_000, reference: { kind: "open", charge: week(3) } }));
    expect(d).toMatchObject({ status: "NEEDS_REVIEW", reason: "AMOUNT_MISMATCH", rentalId: "rental-anna" });
  });

  it("never pays another week when the referenced one is already paid", () => {
    const d = decidePayment(evidence({ reference: { kind: "paid", rentalId: "rental-anna" } }));
    expect(d).toMatchObject({ status: "NEEDS_REVIEW", reason: "CHARGE_ALREADY_PAID", rentalId: "rental-anna" });
  });

  it("books the earliest open week of the holder when the payer is the holder", () => {
    expect(decidePayment(evidence())).toMatchObject({
      status: "BOOKED",
      chargeId: "charge-w2",
      matchedBy: "holder+payer+amount",
    });
  });

  it("waits when someone else paid for the holder", () => {
    const d = decidePayment(evidence({ payerCustomerIds: [] , payerRentalIds: [] }));
    expect(d).toEqual({ status: "NEEDS_REVIEW", reason: "PAYER_MISMATCH", rentalId: "rental-anna", candidates: ["rental-anna"] });
  });

  it("waits when the holder owes nothing of that amount", () => {
    expect(decidePayment(evidence({ amountCents: 12_345 }))).toMatchObject({ reason: "AMOUNT_MISMATCH" });
  });

  it("waits on a guessed plate even when everything else agrees", () => {
    const d = decidePayment(evidence({ plate: { carId: "car-prius", status: "DOUBTFUL", reason: null } }));
    expect(d).toMatchObject({ status: "NEEDS_REVIEW", reason: "PLATE_DOUBTFUL" });
  });

  it("passes the possession rule's reason and candidates through", () => {
    const d = decidePayment(
      evidence({ holder: { ok: false, reason: "HANDOVER_BOUNDARY", candidates: ["rental-a", "rental-b"] }, payerRentalIds: [] })
    );
    expect(d).toEqual({ status: "NEEDS_REVIEW", reason: "HANDOVER_BOUNDARY", rentalId: null, candidates: ["rental-a", "rental-b"] });
  });

  it("names a plate that is not ours, and offers the payer's rentals", () => {
    const d = decidePayment(
      evidence({ plate: { carId: null, status: "MISSING", reason: "PLATE_NOT_IN_FLEET" }, holder: null })
    );
    expect(d).toEqual({ status: "NEEDS_REVIEW", reason: "PLATE_NOT_IN_FLEET", rentalId: null, candidates: ["rental-anna"] });
  });

  it("asks when no plate was written at all", () => {
    const d = decidePayment(evidence({ plate: { carId: null, status: "MISSING", reason: null }, holder: null }));
    expect(d).toMatchObject({ status: "NEEDS_REVIEW", reason: "NO_PLATE" });
  });

  it("asks when the text names two of our cars", () => {
    const d = decidePayment(evidence({ plate: { carId: null, status: "DOUBTFUL", reason: "PLATE_AMBIGUOUS" }, holder: null }));
    expect(d).toMatchObject({ status: "NEEDS_REVIEW", reason: "PLATE_AMBIGUOUS" });
  });
});
```

- [ ] **Step 3: Run them to see them fail**

Run: `pnpm test lib/payments/twint/signals.test.ts lib/payments/twint/decide.test.ts`
Expected: FAIL — `Cannot find module './signals'` and `'./decide'`.

- [ ] **Step 4: Write the signals**

`lib/payments/twint/signals.ts`:

```ts
/**
 * What the customer's free text says, if anything.
 *
 * Payment requests ask renters to quote `<plate> W<week>` (scheduler.ts), so
 * those are the two things looked for. Which of our cars a plate means is the
 * fines matcher's job (`matchPlate`); this only finds the printed attempt, for
 * its one-wrong-character suggestion.
 */

/** "W3", "w 12", "Woche 3" — not inside a word, not the start of a longer number. */
export function weekOf(message: string): number | null {
  const match = /(?:^|[^A-Za-z])W(?:oche)?\s?(\d{1,2})(?!\d)/i.exec(message);
  const week = match ? Number(match[1]) : 0;
  return week >= 1 ? week : null;
}

/** The first ZH plate as the customer typed it, separators included. */
export function printedPlate(message: string): string | null {
  return /\bZH[\s.\-]*\d(?:[\s.\-]?\d){2,6}\b/i.exec(message)?.[0] ?? null;
}
```

- [ ] **Step 5: Write the decision**

`lib/payments/twint/decide.ts`:

```ts
/**
 * From what we know about a payment to "book it" or "ask the office".
 *
 * Booked only when two independent things agree (the spec, decision 4):
 *
 *   reference + amount         the text names a car and a week, and the
 *                              amount is exactly that week's;
 *   holder + payer + amount    whoever had the named car at that moment is
 *                              the customer whose email or phone paid, and
 *                              owes exactly this amount.
 *
 * Everything else waits, with the reason and the rentals to choose from.
 * Pure: the database work is in evidence.ts, so every rule is a table test.
 */

import type { Responsible } from "@/lib/fines/possession";

export const OPEN_CHARGE = ["SCHEDULED", "REQUESTED", "REMINDED", "OVERDUE"] as const;

export interface OpenCharge {
  id: string;
  rentalId: string;
  weekNumber: number;
  amountCents: number;
  dueDate: Date;
}

export type PaymentReviewReason =
  | "NO_PLATE"
  | "PLATE_NOT_IN_FLEET"
  | "PLATE_AMBIGUOUS"
  | "PLATE_DOUBTFUL"
  | "NO_RENTAL_AT_TIME"
  | "HANDOVER_BOUNDARY"
  | "OVERLAPPING_RENTALS"
  | "PAYER_MISMATCH"
  | "AMOUNT_MISMATCH"
  | "CHARGE_ALREADY_PAID";

/** What the text's plate + week point at, in the car's latest rental. */
export type Reference =
  | { kind: "open"; charge: OpenCharge }
  | { kind: "paid"; rentalId: string }
  | { kind: "none" };

export interface Evidence {
  amountCents: number;
  plate: {
    carId: string | null;
    status: "CONFIRMED" | "DOUBTFUL" | "MISSING";
    reason: "PLATE_AMBIGUOUS" | "PLATE_NOT_IN_FLEET" | null;
  };
  reference: Reference;
  /** Null when no car was found to ask about. */
  holder: Responsible | null;
  /** The holder rental's open charges; empty without a holder. */
  holderOpenCharges: OpenCharge[];
  /** Customers whose email or phone is the payer's. */
  payerCustomerIds: string[];
  /** Those customers' recent rentals, offered to the office. */
  payerRentalIds: string[];
}

export type Decision =
  | {
      status: "BOOKED";
      rentalId: string;
      chargeId: string;
      matchedBy: "reference+amount" | "holder+payer+amount";
      candidates: string[];
    }
  | { status: "NEEDS_REVIEW"; reason: PaymentReviewReason; rentalId: string | null; candidates: string[] };

export function decidePayment(e: Evidence): Decision {
  const review = (reason: PaymentReviewReason, rentalId: string | null, candidates: string[]): Decision => ({
    status: "NEEDS_REVIEW",
    reason,
    rentalId,
    candidates: [...new Set([...candidates, ...e.payerRentalIds])],
  });

  if (e.reference.kind === "open") {
    const charge = e.reference.charge;
    if (charge.amountCents !== e.amountCents) return review("AMOUNT_MISMATCH", charge.rentalId, [charge.rentalId]);
    return {
      status: "BOOKED",
      rentalId: charge.rentalId,
      chargeId: charge.id,
      matchedBy: "reference+amount",
      candidates: [charge.rentalId],
    };
  }
  if (e.reference.kind === "paid") {
    return review("CHARGE_ALREADY_PAID", e.reference.rentalId, [e.reference.rentalId]);
  }

  if (!e.plate.carId || !e.holder) {
    return review(e.plate.reason ?? "NO_PLATE", null, []);
  }
  if (!e.holder.ok) return review(e.holder.reason, null, e.holder.candidates);

  const { rentalId, customerId } = e.holder;
  if (e.plate.status !== "CONFIRMED") return review("PLATE_DOUBTFUL", rentalId, [rentalId]);
  if (!e.payerCustomerIds.includes(customerId)) return review("PAYER_MISMATCH", rentalId, [rentalId]);

  const charge = e.holderOpenCharges
    .filter((c) => c.rentalId === rentalId && c.amountCents === e.amountCents)
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0];
  if (!charge) return review("AMOUNT_MISMATCH", rentalId, [rentalId]);

  return { status: "BOOKED", rentalId, chargeId: charge.id, matchedBy: "holder+payer+amount", candidates: [rentalId] };
}
```

- [ ] **Step 6: Run the tests to see them pass**

Run: `pnpm test lib/payments/twint/signals.test.ts lib/payments/twint/decide.test.ts`
Expected: PASS.

- [ ] **Step 7: Prove the double-payment guard guards**

Temporarily delete the `if (e.reference.kind === "paid")` block and run the decide tests again.
Expected: FAIL in "never pays another week when the referenced one is already paid" (it books `charge-w2`). Restore the block; tests pass again.

- [ ] **Step 8: Commit**

```bash
git add lib/payments/twint/signals.ts lib/payments/twint/signals.test.ts lib/payments/twint/decide.ts lib/payments/twint/decide.test.ts
git commit -m "feat(payments): book a payment only when two signals agree"
```

---

### Task 5: Gather the evidence from the database

**Files:**
- Create: `lib/payments/twint/evidence.ts`
- Test: `tests/db/paymentEvidence.test.ts`
- Create: `tests/db/paymentHelpers.ts`

**Interfaces:**
- Consumes: `matchPlate(text, printed, fleet)` from `@/lib/fines/plates`; `responsibleAt`, from `@/lib/fines/possession`; `loadIntervals(client, carId)` from `@/lib/fines/repo/possessionLoad`; `normalisePhone(input)` from `@/lib/rental/phone`; `weekOf`, `printedPlate` (Task 4); `OPEN_CHARGE`, `Evidence`, `OpenCharge` (Task 4); `TwintNotification` (Task 2).
- Produces: `gatherEvidence(client: PrismaClient, organisationId: string, n: TwintNotification): Promise<Evidence>`; test helper `notification(overrides): TwintNotification`.

- [ ] **Step 1: Write the test helper**

`tests/db/paymentHelpers.ts`:

```ts
import type { TwintNotification } from "@/lib/payments/twint/parse";

/** A parsed notification for Anna's rental of ZH 513 925 (fineHelpers' default car). */
export function notification(overrides: Partial<TwintNotification> = {}): TwintNotification {
  return {
    externalId: "ce21e52e-2354-4f6d-a7d7-64a448f335f8",
    amountCents: 45_000,
    currency: "CHF",
    paidAt: new Date("2026-06-10T10:00:00Z"),
    storeName: "Zuriauto",
    payerName: "Anna Meier",
    payerEmail: "anna@example.ch",
    payerPhone: "+41791234567",
    message: "ZH 513 925 W2",
    ...overrides,
  };
}
```

- [ ] **Step 2: Write the failing tests**

`tests/db/paymentEvidence.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { gatherEvidence } from "@/lib/payments/twint/evidence";
import { closeAt, seedOrganisation, seedRental } from "./fineHelpers";
import { notification } from "./paymentHelpers";

async function annaRental() {
  const org = await seedOrganisation();
  const rental = await seedRental(org.id, { signedAt: new Date("2026-06-01T08:00:00Z") });
  return { org, rental };
}

describe("gatherEvidence", () => {
  it("finds the week the text names, in the car's current rental", async () => {
    const { org, rental } = await annaRental();
    const e = await gatherEvidence(prisma, org.id, notification());

    expect(e.reference).toMatchObject({ kind: "open", charge: { rentalId: rental.id, weekNumber: 2, amountCents: 45_000 } });
  });

  it("reports a named week that is already paid", async () => {
    const { org, rental } = await annaRental();
    await prisma.charge.updateMany({ where: { rentalId: rental.id, weekNumber: 2 }, data: { status: "PAID" } });

    expect((await gatherEvidence(prisma, org.id, notification())).reference).toEqual({ kind: "paid", rentalId: rental.id });
  });

  it("finds the holder and recognises the payer by email", async () => {
    const { org, rental } = await annaRental();
    const e = await gatherEvidence(prisma, org.id, notification({ message: "ZH513925" }));

    expect(e.reference).toEqual({ kind: "none" });
    expect(e.holder).toEqual({ ok: true, rentalId: rental.id, customerId: rental.customerId });
    expect(e.payerCustomerIds).toEqual([rental.customerId]);
    expect(e.holderOpenCharges).toHaveLength(8);
  });

  it("recognises the payer by phone when the email differs", async () => {
    const { org, rental } = await annaRental();
    const e = await gatherEvidence(
      prisma,
      org.id,
      notification({ message: "zh.513.925", payerEmail: "anna.private@example.ch", payerPhone: "079 123 45 67" })
    );

    expect(e.plate).toMatchObject({ status: "CONFIRMED" });
    expect(e.payerCustomerIds).toEqual([rental.customerId]);
  });

  it("names a plate that is not ours", async () => {
    const { org } = await annaRental();
    const e = await gatherEvidence(prisma, org.id, notification({ message: "Auto vermieten\nZH918747" }));

    expect(e.plate).toEqual({ carId: null, status: "MISSING", reason: "PLATE_NOT_IN_FLEET" });
    expect(e.holder).toBeNull();
  });

  it("sends a payment made in the hour of a handover to the office", async () => {
    const { org, rental } = await annaRental();
    await closeAt(org.id, rental, new Date("2026-06-20T09:30:00Z"));
    const e = await gatherEvidence(prisma, org.id, notification({ message: "ZH 513 925", paidAt: new Date("2026-06-20T10:00:00Z") }));

    expect(e.holder).toMatchObject({ ok: false, reason: "HANDOVER_BOUNDARY" });
  });
});
```

- [ ] **Step 3: Run them to see them fail**

Run: `pnpm test:db tests/db/paymentEvidence.test.ts`
Expected: FAIL — `Cannot find module '@/lib/payments/twint/evidence'`.

- [ ] **Step 4: Write the gatherer**

`lib/payments/twint/evidence.ts`:

```ts
/**
 * Everything decidePayment needs, from the database.
 *
 * The car comes from the fines plate search (our plates looked for in the
 * text, so "zh.513.925" is found and "ZH918747" is not invented); the holder
 * from the fines possession rule, at the payment's minute. Neither is copied.
 */

import type { PrismaClient } from "@/generated/prisma/client";
import { matchPlate } from "@/lib/fines/plates";
import { responsibleAt } from "@/lib/fines/possession";
import { loadIntervals } from "@/lib/fines/repo/possessionLoad";
import { normalisePhone } from "@/lib/rental/phone";
import { OPEN_CHARGE, type Evidence, type OpenCharge, type Reference } from "./decide";
import type { TwintNotification } from "./parse";
import { printedPlate, weekOf } from "./signals";

/** A week may be paid a little before the rental it belongs to starts. */
const PREPAY_MS = 7 * 24 * 60 * 60 * 1000;

const isOpen = (status: string) => (OPEN_CHARGE as readonly string[]).includes(status);

const chargeSelect = { id: true, rentalId: true, weekNumber: true, amountCents: true, dueDate: true, status: true } as const;

async function referenceOf(
  client: PrismaClient,
  carId: string,
  week: number,
  paidAt: Date
): Promise<Reference> {
  // The car's latest rental that had started by then — not an older rental
  // whose week N happens to be unpaid, which belongs to somebody else.
  const rental = await client.rental.findFirst({
    where: { carId, status: { not: "CANCELLED" }, startAt: { lte: new Date(paidAt.getTime() + PREPAY_MS) } },
    orderBy: { startAt: "desc" },
    select: { id: true, charges: { where: { weekNumber: week }, select: chargeSelect } },
  });
  const charge = rental?.charges[0];
  if (!rental || !charge) return { kind: "none" };
  return isOpen(charge.status) ? { kind: "open", charge } : { kind: "paid", rentalId: rental.id };
}

async function payerCustomers(client: PrismaClient, organisationId: string, n: TwintNotification) {
  const phoneKey = n.payerPhone ? normalisePhone(n.payerPhone) : null;
  const or = [
    ...(n.payerEmail ? [{ email: n.payerEmail.toLowerCase() }] : []),
    ...(phoneKey ? [{ phoneKey }] : []),
  ];
  if (or.length === 0) return [];
  return client.customer.findMany({ where: { organisationId, OR: or }, select: { id: true } });
}

export async function gatherEvidence(
  client: PrismaClient,
  organisationId: string,
  n: TwintNotification
): Promise<Evidence> {
  const message = n.message ?? "";
  // Every car, retired ones included: the payment may be for a past rental.
  const fleet = await client.car.findMany({ where: { organisationId }, select: { id: true, plate: true } });
  const found = matchPlate(message, printedPlate(message), fleet);
  const plate: Evidence["plate"] = {
    carId: found.carId,
    status: found.status === "READ" ? "DOUBTFUL" : found.status,
    reason: found.reason,
  };

  const week = weekOf(message);
  const reference: Reference =
    plate.carId && plate.status === "CONFIRMED" && week
      ? await referenceOf(client, plate.carId, week, n.paidAt)
      : { kind: "none" };

  const holder = plate.carId
    ? responsibleAt(await loadIntervals(client, plate.carId), { kind: "instant", at: n.paidAt })
    : null;

  const holderOpenCharges: OpenCharge[] = holder?.ok
    ? (
        await client.charge.findMany({
          where: { rentalId: holder.rentalId, status: { in: [...OPEN_CHARGE] } },
          orderBy: { dueDate: "asc" },
          select: chargeSelect,
        })
      ).map(({ status: _status, ...charge }) => charge)
    : [];

  const payers = await payerCustomers(client, organisationId, n);
  const payerRentals = payers.length
    ? await client.rental.findMany({
        where: { customerId: { in: payers.map((p) => p.id) }, status: { not: "CANCELLED" } },
        orderBy: { startAt: "desc" },
        take: 5,
        select: { id: true },
      })
    : [];

  return {
    amountCents: n.amountCents,
    plate,
    reference,
    holder,
    holderOpenCharges,
    payerCustomerIds: payers.map((p) => p.id),
    payerRentalIds: payerRentals.map((r) => r.id),
  };
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `pnpm test:db tests/db/paymentEvidence.test.ts`
Expected: PASS (6 tests). If "recognises the payer by phone" fails because the seeded customer has no `phoneKey`, check `lib/rental/customers.ts`: `persistPickup` must write it; if it does not, fix the test helper to set it with `normalisePhone` — never weaken the assertion.

- [ ] **Step 6: Commit**

```bash
git add lib/payments/twint/evidence.ts tests/db/paymentEvidence.test.ts tests/db/paymentHelpers.ts
git commit -m "feat(payments): gather plate, holder, reference and payer for a payment"
```

---

### Task 6: Store, decide and book one email

**Files:**
- Create: `lib/payments/events.ts`
- Create: `lib/payments/book.ts`
- Create: `lib/payments/twint/ingest.ts`
- Test: `tests/db/paymentIngest.test.ts`
- Modify: `tests/db/paymentHelpers.ts` (add `rawMail`)

**Interfaces:**
- Consumes: `parseNotification` (Task 2); `verifyTwintSignature` (Task 3); `decidePayment`, `OPEN_CHARGE` (Task 4); `gatherEvidence` (Task 5); `Actor` type from `@/lib/fines/events`.
- Produces:
  - `recordPaymentEvent(client: PrismaClient | Prisma.TransactionClient, paymentId: string, type: string, payload?: Record<string, unknown>, actor?: Actor | null): Promise<void>`
  - `bookCharge(tx: Prisma.TransactionClient, input: { paymentId: string; chargeId: string; rentalId: string; matchedBy: string; paidAt: Date; actor: Actor | null }): Promise<boolean>`
  - `interface RawMail { uid: number | null; source: Buffer }`
  - `type IngestOutcome = "booked" | "review" | "duplicate" | "unsigned" | "unreadable"`
  - `ingestMail(deps: { client: PrismaClient; organisationId: string; verify?: (raw: Buffer) => Promise<boolean> }, mail: RawMail): Promise<IngestOutcome>`

- [ ] **Step 1: Add the raw-mail helper**

Add to `tests/db/paymentHelpers.ts` (the two imports go at the top of the file, beside the existing one):

```ts
import { sampleHtml, type SampleFields } from "@/lib/payments/twint/__fixtures__/notification";
import type { RawMail } from "@/lib/payments/twint/ingest";

/** A whole RFC 822 message around the fixture HTML. Unsigned: tests inject
 *  `verify`, and the signature itself is Task 3's business. */
export function rawMail(fields: Partial<SampleFields> = {}, uid = 1): RawMail {
  const html = sampleHtml({ amount: "CHF 450.00", date: "10.06.2026, 12:00", ...fields });
  const source = [
    "From: no-reply@twintpay.ch",
    "To: info@zuriauto.ch",
    "Subject: Erfolgreiche Transaktion",
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=utf-8",
    "",
    html,
  ].join("\r\n");
  return { uid, source: Buffer.from(source) };
}
```

- [ ] **Step 2: Write the failing tests**

`tests/db/paymentIngest.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { ingestMail } from "@/lib/payments/twint/ingest";
import { seedOrganisation, seedRental } from "./fineHelpers";
import { rawMail } from "./paymentHelpers";

const signed = async () => true;

async function setup() {
  const org = await seedOrganisation();
  const rental = await seedRental(org.id, { signedAt: new Date("2026-06-01T08:00:00Z") });
  const deps = { client: prisma, organisationId: org.id, verify: signed };
  return { org, rental, deps };
}

describe("ingestMail", () => {
  it("books the referenced week and marks it paid at the payment's moment", async () => {
    const { rental, deps } = await setup();

    expect(await ingestMail(deps, rawMail())).toBe("booked");

    const charge = await prisma.charge.findFirstOrThrow({ where: { rentalId: rental.id, weekNumber: 2 } });
    expect(charge).toMatchObject({ status: "PAID", paidAt: new Date("2026-06-10T10:00:00Z") });
    const payment = await prisma.payment.findFirstOrThrow({ include: { events: true } });
    expect(payment).toMatchObject({ status: "BOOKED", chargeId: charge.id, matchedBy: "reference+amount" });
    expect(payment.events.map((e) => e.type)).toEqual(["payment.received", "payment.booked"]);
  });

  it("stores the same transaction once, however often it is read", async () => {
    const { deps } = await setup();
    await ingestMail(deps, rawMail());

    expect(await ingestMail(deps, rawMail())).toBe("duplicate");
    expect(await prisma.payment.count()).toBe(1);
  });

  it("stores nothing from a message that is not signed by TWINT", async () => {
    const { deps } = await setup();

    expect(await ingestMail({ ...deps, verify: async () => false }, rawMail())).toBe("unsigned");
    expect(await prisma.payment.count()).toBe(0);
  });

  it("keeps a payment with a plate that is not ours for the office, and touches no charge", async () => {
    const { deps } = await setup();

    expect(await ingestMail(deps, rawMail({ message: ["Auto vermieten", "ZH918747"] }))).toBe("review");
    expect(await prisma.payment.findFirstOrThrow()).toMatchObject({ status: "NEEDS_REVIEW", reviewReason: "PLATE_NOT_IN_FLEET" });
    expect(await prisma.charge.count({ where: { status: "PAID" } })).toBe(0);
  });

  it("sends a second payment for an already-paid week to the office", async () => {
    const { deps } = await setup();
    await ingestMail(deps, rawMail());

    const second = rawMail({ transaction: "0f0e0d0c-aaaa-bbbb-cccc-000000000002" }, 2);
    expect(await ingestMail(deps, second)).toBe("review");
    expect(await prisma.payment.findFirstOrThrow({ where: { mailUid: 2 } })).toMatchObject({ reviewReason: "CHARGE_ALREADY_PAID" });
    expect(await prisma.charge.count({ where: { status: "PAID" } })).toBe(1);
  });

  it("refuses an email it cannot read without storing a half row", async () => {
    const { deps } = await setup();

    expect(await ingestMail(deps, rawMail({ amount: "zweihundert" }))).toBe("unreadable");
    expect(await prisma.payment.count()).toBe(0);
  });
});
```

- [ ] **Step 3: Run them to see them fail**

Run: `pnpm test:db tests/db/paymentIngest.test.ts`
Expected: FAIL — `Cannot find module '@/lib/payments/twint/ingest'`.

- [ ] **Step 4: Write the event recorder and the booking**

`lib/payments/events.ts`:

```ts
/**
 * The payment's timeline — how the office answers "who decided this was
 * Anna's week 3?" months later. The FineEvent pattern, keyed by payment.
 */

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { Actor } from "@/lib/fines/events";

type Client = PrismaClient | Prisma.TransactionClient;

export async function recordPaymentEvent(
  client: Client,
  paymentId: string,
  type: string,
  payload: Record<string, unknown> = {},
  actor: Actor | null = null
): Promise<void> {
  await client.paymentEvent.create({
    data: {
      paymentId,
      type,
      payload: payload as Prisma.InputJsonValue,
      actorId: actor?.id ?? null,
      actorName: actor?.displayName ?? null,
    },
  });
}
```

`lib/payments/book.ts`:

```ts
/**
 * The one place a payment makes a charge PAID.
 *
 * Conditional on the status it read, so two runs — or the office and a run —
 * cannot both pay the same week: the second update finds nothing to change
 * and reports false. The previous status goes into the event, which is what
 * lets "undo" put the charge back exactly as it was.
 */

import type { Prisma } from "@/generated/prisma/client";
import type { Actor } from "@/lib/fines/events";
import { recordPaymentEvent } from "./events";
import { OPEN_CHARGE } from "./twint/decide";

export async function bookCharge(
  tx: Prisma.TransactionClient,
  input: { paymentId: string; chargeId: string; rentalId: string; matchedBy: string; paidAt: Date; actor: Actor | null }
): Promise<boolean> {
  const charge = await tx.charge.findUnique({
    where: { id: input.chargeId },
    select: { status: true, rentalId: true },
  });
  if (!charge || charge.rentalId !== input.rentalId) return false;
  if (!(OPEN_CHARGE as readonly string[]).includes(charge.status)) return false;

  const claimed = await tx.charge.updateMany({
    where: { id: input.chargeId, status: charge.status },
    data: { status: "PAID", paidAt: input.paidAt },
  });
  if (claimed.count === 0) return false;

  await tx.payment.update({
    where: { id: input.paymentId },
    data: {
      status: "BOOKED",
      reviewReason: null,
      rentalId: input.rentalId,
      chargeId: input.chargeId,
      matchedBy: input.matchedBy,
    },
  });
  await recordPaymentEvent(
    tx,
    input.paymentId,
    "payment.booked",
    { chargeId: input.chargeId, rentalId: input.rentalId, matchedBy: input.matchedBy, previousChargeStatus: charge.status },
    input.actor
  );
  return true;
}
```

- [ ] **Step 5: Write the ingest**

`lib/payments/twint/ingest.ts`:

```ts
/**
 * One email from the mailbox, start to finish.
 *
 *   is it TWINT's?        no  → "unsigned", nothing stored
 *   can we read it?       no  → "unreadable", nothing stored
 *   seen it before?       yes → "duplicate"
 *   then: store, decide, and book if two signals agree — in one transaction,
 *   so a payment never exists half-booked.
 *
 * Nothing that fails here is lost: the email stays in the mailbox (opened
 * read-only) and the next run reads it again.
 */

import { simpleParser } from "mailparser";
import type { PrismaClient } from "@/generated/prisma/client";
import { bookCharge } from "../book";
import { recordPaymentEvent } from "../events";
import { verifyTwintSignature } from "./authentic";
import { decidePayment } from "./decide";
import { gatherEvidence } from "./evidence";
import { parseNotification } from "./parse";

export interface RawMail {
  uid: number | null;
  source: Buffer;
}

export type IngestOutcome = "booked" | "review" | "duplicate" | "unsigned" | "unreadable";

export interface IngestDeps {
  client: PrismaClient;
  organisationId: string;
  /** Injected by tests; production checks TWINT's DKIM signature. */
  verify?: (raw: Buffer) => Promise<boolean>;
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";
}

export async function ingestMail(deps: IngestDeps, mail: RawMail): Promise<IngestOutcome> {
  const { client, organisationId } = deps;
  const verify = deps.verify ?? verifyTwintSignature;

  if (!(await verify(mail.source))) {
    console.warn(`[twint] uid ${mail.uid}: not signed by TWINT, skipped`);
    return "unsigned";
  }

  const parsed = await simpleParser(mail.source);
  const result = parseNotification(parsed.html || parsed.textAsHtml || "");
  if (!result.ok) {
    console.warn(`[twint] uid ${mail.uid}: ${result.reason} ${result.field ?? ""}`.trim());
    return "unreadable";
  }
  const n = result.notification;

  const seen = await client.payment.findUnique({
    where: { organisationId_externalId: { organisationId, externalId: n.externalId } },
    select: { id: true },
  });
  if (seen) return "duplicate";

  const decision = decidePayment(await gatherEvidence(client, organisationId, n));

  try {
    return await client.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          organisationId,
          externalId: n.externalId,
          amountCents: n.amountCents,
          currency: n.currency,
          paidAt: n.paidAt,
          storeName: n.storeName,
          payerName: n.payerName,
          payerEmail: n.payerEmail,
          payerPhone: n.payerPhone,
          message: n.message,
          mailUid: mail.uid,
          status: "NEEDS_REVIEW",
          reviewReason: decision.status === "NEEDS_REVIEW" ? decision.reason : null,
          rentalId: decision.rentalId,
          candidates: decision.candidates,
        },
        select: { id: true },
      });
      await recordPaymentEvent(tx, payment.id, "payment.received", {
        decision: decision.status,
        reason: decision.status === "NEEDS_REVIEW" ? decision.reason : null,
      });
      if (decision.status !== "BOOKED") return "review";

      const booked = await bookCharge(tx, {
        paymentId: payment.id,
        chargeId: decision.chargeId,
        rentalId: decision.rentalId,
        matchedBy: decision.matchedBy,
        paidAt: n.paidAt,
        actor: null,
      });
      if (booked) return "booked";
      // Paid between evidence and booking — by the office or a parallel run.
      await tx.payment.update({ where: { id: payment.id }, data: { reviewReason: "CHARGE_ALREADY_PAID" } });
      return "review";
    });
  } catch (error) {
    if (isUniqueViolation(error)) return "duplicate";
    throw error;
  }
}
```

- [ ] **Step 6: Run the tests to see them pass**

Run: `pnpm test:db tests/db/paymentIngest.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 7: Prove the signature gate guards**

Temporarily change `if (!(await verify(mail.source)))` to `if (false)` and run the tests.
Expected: FAIL in "stores nothing from a message that is not signed by TWINT". Restore; tests pass.

- [ ] **Step 8: Commit**

```bash
git add lib/payments/events.ts lib/payments/book.ts lib/payments/twint/ingest.ts tests/db/paymentIngest.test.ts tests/db/paymentHelpers.ts
git commit -m "feat(payments): store each TWINT payment once and book it when two signals agree"
```

---

### Task 7: Read the mailbox on a schedule

**Files:**
- Create: `lib/cron/auth.ts` (moved from `app/api/cron/daily/route.ts`)
- Modify: `app/api/cron/daily/route.ts` (import instead of define)
- Create: `lib/payments/twint/mailbox.ts`
- Create: `lib/payments/twint/pass.ts`
- Create: `app/api/cron/payments/route.ts`
- Test: `lib/cron/auth.test.ts`, `lib/payments/twint/mailbox.test.ts`, `tests/db/paymentPass.test.ts`

**Interfaces:**
- Consumes: `ingestMail`, `RawMail`, `IngestOutcome` (Task 6); `TWINT_SENDER` (Task 3).
- Produces: `cronAuthorised(request: Request): boolean`; `readMailboxConfig(env?: NodeJS.ProcessEnv): MailboxConfig | null`; `fetchTwintMails(config: MailboxConfig, now: Date): Promise<RawMail[]>`; `twintPaymentPass(deps: { client: PrismaClient; fetchMails: () => Promise<RawMail[]>; verify?: (raw: Buffer) => Promise<boolean> }): Promise<Record<IngestOutcome | "failed", number>>`; route `GET|POST /api/cron/payments/`.

- [ ] **Step 1: Write the failing tests**

`lib/cron/auth.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";
import { cronAuthorised } from "./auth";

const request = (authorization?: string) =>
  new Request("https://zuriauto.ch/api/cron/payments/", { headers: authorization ? { authorization } : {} });

describe("cronAuthorised", () => {
  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("accepts the bearer secret", () => {
    process.env.CRON_SECRET = "s3cret";
    expect(cronAuthorised(request("Bearer s3cret"))).toBe(true);
  });

  it("refuses a wrong or missing secret", () => {
    process.env.CRON_SECRET = "s3cret";
    expect(cronAuthorised(request("Bearer nope"))).toBe(false);
    expect(cronAuthorised(request())).toBe(false);
  });

  it("fails closed when no secret is configured", () => {
    expect(cronAuthorised(request("Bearer "))).toBe(false);
  });
});
```

`lib/payments/twint/mailbox.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readMailboxConfig } from "./mailbox";

describe("readMailboxConfig", () => {
  it("is off without a user or password", () => {
    expect(readMailboxConfig({})).toBeNull();
    expect(readMailboxConfig({ TWINT_IMAP_USER: "payments@zuriauto.ch" })).toBeNull();
  });

  it("defaults to Hostinger's IMAP, the inbox and 14 days", () => {
    expect(readMailboxConfig({ TWINT_IMAP_USER: "payments@zuriauto.ch", TWINT_IMAP_PASS: "pw" })).toEqual({
      host: "imap.hostinger.com",
      port: 993,
      user: "payments@zuriauto.ch",
      pass: "pw",
      mailbox: "INBOX",
      lookbackDays: 14,
    });
  });
});
```

`tests/db/paymentPass.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { twintPaymentPass } from "@/lib/payments/twint/pass";
import { seedOrganisation, seedRental } from "./fineHelpers";
import { rawMail } from "./paymentHelpers";

describe("twintPaymentPass", () => {
  it("counts each outcome, and one bad mail does not stop the others", async () => {
    const org = await seedOrganisation();
    await seedRental(org.id, { signedAt: new Date("2026-06-01T08:00:00Z") });
    const broken = { uid: 9, source: Buffer.from("not an email at all") };

    const counts = await twintPaymentPass({
      client: prisma,
      fetchMails: async () => [rawMail({}, 1), rawMail({}, 1), broken],
      verify: async (raw) => raw.toString().startsWith("From:"),
    });

    expect(counts).toEqual({ booked: 1, review: 0, duplicate: 1, unsigned: 1, unreadable: 0, failed: 0 });
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm test lib/cron/auth.test.ts lib/payments/twint/mailbox.test.ts && pnpm test:db tests/db/paymentPass.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Move the bearer check**

Create `lib/cron/auth.ts` with the `authorised` function body cut from `app/api/cron/daily/route.ts`, renamed and exported:

```ts
import { timingSafeEqual } from "node:crypto";

/**
 * Vercel Cron (or any external scheduler) sends `Authorization: Bearer $CRON_SECRET`.
 * Shared by every cron route, so there is one rule for who may trigger mail
 * to customers and who may book payments.
 */
export function cronAuthorised(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  // Fail closed. An unset secret must not mean an open trigger.
  if (!expected) return false;

  const header = request.headers.get("authorization") ?? "";
  const supplied = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!supplied) return false;

  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}
```

In `app/api/cron/daily/route.ts`: delete the local `authorised` function and the `timingSafeEqual` import, add `import { cronAuthorised } from "@/lib/cron/auth";`, and change `if (!authorised(request))` to `if (!cronAuthorised(request))`.

- [ ] **Step 4: Write the mailbox reader**

`lib/payments/twint/mailbox.ts`:

```ts
/**
 * TWINT's emails, fetched read-only.
 *
 * Read-only is the point: the mailbox is the office's, and a payment the site
 * failed to store must still be there for the next run — so nothing is
 * flagged as seen, moved or deleted. Each run re-reads the last
 * `lookbackDays`; the unique transaction number makes that harmless, and a
 * handful of emails a day makes it cheap.
 */

import { ImapFlow } from "imapflow";
import { TWINT_SENDER } from "./authentic";
import type { RawMail } from "./ingest";

export interface MailboxConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  mailbox: string;
  lookbackDays: number;
}

export function readMailboxConfig(env: NodeJS.ProcessEnv = process.env): MailboxConfig | null {
  const user = env.TWINT_IMAP_USER?.trim();
  const pass = env.TWINT_IMAP_PASS;
  if (!user || !pass) return null;
  return {
    host: env.TWINT_IMAP_HOST?.trim() || "imap.hostinger.com",
    port: Number(env.TWINT_IMAP_PORT || 993),
    user,
    pass,
    mailbox: env.TWINT_IMAP_MAILBOX?.trim() || "INBOX",
    lookbackDays: Number(env.TWINT_LOOKBACK_DAYS || 14),
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

export async function fetchTwintMails(config: MailboxConfig, now: Date): Promise<RawMail[]> {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: true,
    auth: { user: config.user, pass: config.pass },
    logger: false,
  });
  await client.connect();
  try {
    const lock = await client.getMailboxLock(config.mailbox, { readOnly: true });
    try {
      const since = new Date(now.getTime() - config.lookbackDays * DAY_MS);
      const uids = (await client.search({ from: TWINT_SENDER, since }, { uid: true })) || [];
      if (uids.length === 0) return [];
      const mails: RawMail[] = [];
      for await (const message of client.fetch(uids.join(","), { source: true }, { uid: true })) {
        if (message.source) mails.push({ uid: message.uid, source: message.source });
      }
      return mails;
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}
```

- [ ] **Step 5: Write the pass**

`lib/payments/twint/pass.ts`:

```ts
/**
 * Every fetched email through `ingestMail`, counted.
 *
 * One email that throws is logged and counted as "failed"; the rest are still
 * read. It stays in the mailbox, so the next run tries it again.
 */

import type { PrismaClient } from "@/generated/prisma/client";
import { ingestMail, type IngestOutcome, type RawMail } from "./ingest";

export async function twintPaymentPass(deps: {
  client: PrismaClient;
  fetchMails: () => Promise<RawMail[]>;
  verify?: (raw: Buffer) => Promise<boolean>;
}): Promise<Record<IngestOutcome | "failed", number>> {
  const organisation = await deps.client.organisation.findFirstOrThrow({ select: { id: true } });
  const counts: Record<IngestOutcome | "failed", number> = {
    booked: 0,
    review: 0,
    duplicate: 0,
    unsigned: 0,
    unreadable: 0,
    failed: 0,
  };
  for (const mail of await deps.fetchMails()) {
    try {
      counts[await ingestMail({ client: deps.client, organisationId: organisation.id, verify: deps.verify }, mail)] += 1;
    } catch (error) {
      console.error(`[twint] uid ${mail.uid} failed:`, error);
      counts.failed += 1;
    }
  }
  return counts;
}
```

- [ ] **Step 6: Write the route**

`app/api/cron/payments/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cronAuthorised } from "@/lib/cron/auth";
import { fetchTwintMails, readMailboxConfig } from "@/lib/payments/twint/mailbox";
import { twintPaymentPass } from "@/lib/payments/twint/pass";

/**
 * Reads TWINT's payment emails and books what it can.
 *
 * Its own route, not part of the daily run: payments want minutes, the daily
 * run sends customer mail once a day. Vercel's free plan runs crons daily, so
 * the every-10-minutes trigger is an external scheduler calling this URL
 * with the same bearer secret (docs/PAYMENTS-SETUP.md). Safe to call twice.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function run(request: Request) {
  if (!cronAuthorised(request)) {
    return NextResponse.json({ code: "unauthorised" }, { status: 401 });
  }
  const config = readMailboxConfig();
  if (!config) return NextResponse.json({ ok: true, skipped: "not-configured" });

  const startedAt = Date.now();
  try {
    const counts = await twintPaymentPass({ client: prisma, fetchMails: () => fetchTwintMails(config, new Date()) });
    console.log("[cron] payments", JSON.stringify(counts));
    return NextResponse.json({ ok: true, ms: Date.now() - startedAt, ...counts });
  } catch (error) {
    // A mailbox that cannot be reached is reported, never swallowed.
    console.error("[cron] payments failed:", error);
    return NextResponse.json({ code: "failed" }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
```

- [ ] **Step 7: Run all the tests**

Run: `pnpm test && pnpm test:db`
Expected: PASS, including the existing scheduler and cron tests (the daily route behaves exactly as before).

- [ ] **Step 8: Try it against the real mailbox, locally**

In `.env.local` set `CRON_SECRET=local-test` and the `TWINT_IMAP_*` lines from Task 0, point `DATABASE_URL` at the local Docker database (`pnpm db:up && pnpm db:seed`), run `pnpm dev`, then:

Run: `curl -s -X POST -H "Authorization: Bearer local-test" http://localhost:3000/api/cron/payments/`
Expected: `{"ok":true,...,"booked":0,"review":N,...,"unsigned":0,"unreadable":0}` — most land in `review` because the local database has none of the real rentals. `unsigned` or `unreadable` above 0 means stop and look at the logged uid with `pnpm twint:peek`.

Run it a second time.
Expected: every email counted as `duplicate`.

- [ ] **Step 9: Commit**

```bash
git add lib/cron app/api/cron lib/payments/twint/mailbox.ts lib/payments/twint/mailbox.test.ts lib/payments/twint/pass.ts tests/db/paymentPass.test.ts
git commit -m "feat(payments): read TWINT's emails from the mailbox on a schedule"
```

---

### Task 8: What the office can do to a payment

**Files:**
- Create: `lib/payments/actions.ts`
- Create: `app/api/admin/payments/[id]/actions/route.ts`
- Test: `tests/db/paymentActions.test.ts`

**Interfaces:**
- Consumes: `bookCharge` (Task 6), `recordPaymentEvent` (Task 6), `OPEN_CHARGE` (Task 4), `Actor` from `@/lib/fines/events`, `requireAdmin` from `@/lib/admin/session`.
- Produces: `paymentActionSchema` (zod), `type PaymentAction`, `applyPaymentAction(client: PrismaClient, paymentId: string, action: PaymentAction, actor: Actor): Promise<{ ok: true } | { ok: false; code: "bad-request" | "conflict" | "not-found" }>`; route `POST /api/admin/payments/[id]/actions/`.

- [ ] **Step 1: Write the failing tests**

`tests/db/paymentActions.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { applyPaymentAction } from "@/lib/payments/actions";
import { ingestMail } from "@/lib/payments/twint/ingest";
import { seedOrganisation, seedRental } from "./fineHelpers";
import { rawMail } from "./paymentHelpers";

const office = { id: "user-1", displayName: "Ahmed" };

async function waitingPayment() {
  const org = await seedOrganisation();
  const rental = await seedRental(org.id, { signedAt: new Date("2026-06-01T08:00:00Z") });
  await ingestMail(
    { client: prisma, organisationId: org.id, verify: async () => true },
    rawMail({ message: ["für Anna"], contact: ["friend@example.ch"] })
  );
  const payment = await prisma.payment.findFirstOrThrow();
  const week3 = await prisma.charge.findFirstOrThrow({ where: { rentalId: rental.id, weekNumber: 3 } });
  return { rental, payment, week3 };
}

describe("applyPaymentAction", () => {
  it("books a waiting payment to the week the office picks, and says who did it", async () => {
    const { rental, payment, week3 } = await waitingPayment();

    const result = await applyPaymentAction(prisma, payment.id, { action: "book", rentalId: rental.id, chargeId: week3.id }, office);

    expect(result).toEqual({ ok: true });
    expect(await prisma.charge.findUniqueOrThrow({ where: { id: week3.id } })).toMatchObject({ status: "PAID" });
    const booked = await prisma.paymentEvent.findFirstOrThrow({ where: { type: "payment.booked" } });
    expect(booked).toMatchObject({ actorId: "user-1", actorName: "Ahmed" });
  });

  it("credits the rental without a charge when the office says so", async () => {
    const { rental, payment } = await waitingPayment();

    await applyPaymentAction(prisma, payment.id, { action: "book", rentalId: rental.id, chargeId: null }, office);

    expect(await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).toMatchObject({
      status: "BOOKED",
      rentalId: rental.id,
      chargeId: null,
      matchedBy: "office",
    });
  });

  it("will not pay a week that is already paid", async () => {
    const { rental, payment, week3 } = await waitingPayment();
    await prisma.charge.update({ where: { id: week3.id }, data: { status: "PAID" } });

    expect(
      await applyPaymentAction(prisma, payment.id, { action: "book", rentalId: rental.id, chargeId: week3.id }, office)
    ).toEqual({ ok: false, code: "conflict" });
  });

  it("undoes a booking and puts the charge back as it was", async () => {
    const { rental, payment, week3 } = await waitingPayment();
    await applyPaymentAction(prisma, payment.id, { action: "book", rentalId: rental.id, chargeId: week3.id }, office);

    expect(await applyPaymentAction(prisma, payment.id, { action: "undo" }, office)).toEqual({ ok: true });

    expect(await prisma.charge.findUniqueOrThrow({ where: { id: week3.id } })).toMatchObject({ status: "SCHEDULED", paidAt: null });
    expect(await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).toMatchObject({ status: "NEEDS_REVIEW", chargeId: null });
  });

  it("ignores a payment only with a reason, and can bring it back", async () => {
    const { payment } = await waitingPayment();

    await applyPaymentAction(prisma, payment.id, { action: "ignore", note: "Test payment by Ahmed" }, office);
    expect(await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).toMatchObject({ status: "IGNORED" });

    await applyPaymentAction(prisma, payment.id, { action: "undo" }, office);
    expect(await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).toMatchObject({ status: "NEEDS_REVIEW" });
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm test:db tests/db/paymentActions.test.ts`
Expected: FAIL — `Cannot find module '@/lib/payments/actions'`.

- [ ] **Step 3: Write the actions**

`lib/payments/actions.ts`:

```ts
/**
 * What the office can do to a payment.
 *
 *   book    a waiting payment to a rental — and to one of its open weeks, or
 *           to none, as a credit (deposit, damage, anything not a week)
 *   ignore  a waiting payment that is not ours to book; a reason is required
 *   undo    a booking (the charge goes back to its previous status) or an
 *           ignore; the payment waits again
 *
 * Every action writes a PaymentEvent naming who did it.
 */

import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import type { Actor } from "@/lib/fines/events";
import { bookCharge } from "./book";
import { recordPaymentEvent } from "./events";

export const paymentActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("book"), rentalId: z.string().min(1), chargeId: z.string().min(1).nullable() }),
  z.object({ action: z.literal("ignore"), note: z.string().trim().min(1).max(500) }),
  z.object({ action: z.literal("undo") }),
]);

export type PaymentAction = z.infer<typeof paymentActionSchema>;
export type PaymentActionResult = { ok: true } | { ok: false; code: "bad-request" | "conflict" | "not-found" };

const OK = { ok: true } as const;
const CONFLICT = { ok: false, code: "conflict" } as const;
const NOT_FOUND = { ok: false, code: "not-found" } as const;

const CHARGE_STATUSES = ["SCHEDULED", "REQUESTED", "REMINDED", "OVERDUE"] as const;

export async function applyPaymentAction(
  client: PrismaClient,
  paymentId: string,
  action: PaymentAction,
  actor: Actor
): Promise<PaymentActionResult> {
  const payment = await client.payment.findUnique({
    where: { id: paymentId },
    select: { id: true, organisationId: true, status: true, chargeId: true, paidAt: true },
  });
  if (!payment) return NOT_FOUND;

  if (action.action === "book") {
    if (payment.status !== "NEEDS_REVIEW") return CONFLICT;
    const rental = await client.rental.findFirst({
      where: { id: action.rentalId, organisationId: payment.organisationId },
      select: { id: true },
    });
    if (!rental) return NOT_FOUND;

    if (action.chargeId) {
      const chargeId = action.chargeId;
      const booked = await client.$transaction((tx) =>
        bookCharge(tx, { paymentId, chargeId, rentalId: rental.id, matchedBy: "office", paidAt: payment.paidAt, actor })
      );
      return booked ? OK : CONFLICT;
    }
    await client.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: paymentId },
        data: { status: "BOOKED", reviewReason: null, rentalId: rental.id, chargeId: null, matchedBy: "office" },
      });
      await recordPaymentEvent(tx, paymentId, "payment.credited", { rentalId: rental.id }, actor);
    });
    return OK;
  }

  if (action.action === "ignore") {
    if (payment.status !== "NEEDS_REVIEW") return CONFLICT;
    await client.$transaction(async (tx) => {
      await tx.payment.update({ where: { id: paymentId }, data: { status: "IGNORED" } });
      await recordPaymentEvent(tx, paymentId, "payment.ignored", { note: action.note }, actor);
    });
    return OK;
  }

  // undo
  if (payment.status === "NEEDS_REVIEW") return CONFLICT;
  await client.$transaction(async (tx) => {
    if (payment.status === "BOOKED" && payment.chargeId) {
      const booked = await tx.paymentEvent.findFirst({
        where: { paymentId, type: "payment.booked" },
        orderBy: { createdAt: "desc" },
        select: { payload: true },
      });
      const previous = (booked?.payload as { previousChargeStatus?: string } | null)?.previousChargeStatus;
      const restore = (CHARGE_STATUSES as readonly string[]).includes(previous ?? "")
        ? (previous as (typeof CHARGE_STATUSES)[number])
        : "REQUESTED";
      await tx.charge.updateMany({
        where: { id: payment.chargeId, status: "PAID" },
        data: { status: restore, paidAt: null },
      });
    }
    await tx.payment.update({
      where: { id: paymentId },
      data: { status: "NEEDS_REVIEW", chargeId: null, matchedBy: null },
    });
    await recordPaymentEvent(tx, paymentId, payment.status === "BOOKED" ? "payment.undone" : "payment.reopened", {}, actor);
  });
  return OK;
}
```

- [ ] **Step 4: Write the route**

`app/api/admin/payments/[id]/actions/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/session";
import { applyPaymentAction, paymentActionSchema } from "@/lib/payments/actions";

/** An office action on a payment. See lib/payments/actions.ts for each one. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS = { "bad-request": 400, conflict: 409, "not-found": 404 } as const;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ code: "unauthorised" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ code: "bad-request" }, { status: 400 });
  }
  const parsed = paymentActionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ code: "bad-request" }, { status: 400 });

  const result = await applyPaymentAction(prisma, (await params).id, parsed.data, {
    id: user.id,
    displayName: user.displayName,
  });
  if (!result.ok) return NextResponse.json({ code: result.code }, { status: STATUS[result.code] });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `pnpm test:db tests/db/paymentActions.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/payments/actions.ts app/api/admin/payments tests/db/paymentActions.test.ts
git commit -m "feat(payments): the office books, ignores or undoes a payment"
```

---

### Task 9: The "Zahlungen" screen and the Overview item

**Files:**
- Create: `lib/payments/queries.ts`
- Create: `app/api/admin/payments/route.ts`, `app/api/admin/payments/[id]/route.ts`
- Create: `components/admin/sections/PaymentsSection.tsx`, `components/admin/parts/PaymentDetail.tsx`, `app/admin/payments/page.tsx`
- Modify: `components/admin/format.ts` (add `zurichTime`), `lib/admin/attention.ts`, `components/admin/overview/attentionText.ts`, `app/api/admin/overview/route.ts`, `components/admin/types.ts`, `components/admin/shell/Rail.tsx`, `lib/admin/labels.ts`
- Test: `tests/db/paymentQueries.test.ts`, `lib/admin/attention.test.ts` (add a case)

**Interfaces:**
- Consumes: Prisma models (Task 1), actions route (Task 8).
- Produces: `paymentList(client, tab: "review" | "booked" | "all"): Promise<PaymentRow[]>`, `paymentDetail(client, id): Promise<PaymentDetailData | null>`, `paymentReviewCount(client): Promise<number>`; `GET /api/admin/payments/?tab=`, `GET /api/admin/payments/[id]/`; attention kind `"payment"`.

- [ ] **Step 1: Write the failing tests**

`tests/db/paymentQueries.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { ingestMail } from "@/lib/payments/twint/ingest";
import { paymentDetail, paymentList, paymentReviewCount } from "@/lib/payments/queries";
import { seedOrganisation, seedRental } from "./fineHelpers";
import { rawMail } from "./paymentHelpers";

async function onePaidOneWaiting() {
  const org = await seedOrganisation();
  const rental = await seedRental(org.id, { signedAt: new Date("2026-06-01T08:00:00Z") });
  const deps = { client: prisma, organisationId: org.id, verify: async () => true };
  await ingestMail(deps, rawMail({}, 1));
  await ingestMail(deps, rawMail({ transaction: "aaaaaaaa-0000-0000-0000-000000000002", message: ["Danke"] }, 2));
  return { rental };
}

describe("payment queries", () => {
  it("lists what waits on the review tab, and counts it for the Overview", async () => {
    await onePaidOneWaiting();

    const review = await paymentList(prisma, "review");
    expect(review).toHaveLength(1);
    expect(review[0]).toMatchObject({ status: "NEEDS_REVIEW", reviewReason: "NO_PLATE", message: "Danke" });
    expect(await paymentReviewCount(prisma)).toBe(1);
    expect(await paymentList(prisma, "all")).toHaveLength(2);
  });

  it("shows a booked payment with its renter, car and week", async () => {
    await onePaidOneWaiting();

    const [booked] = await paymentList(prisma, "booked");
    expect(booked).toMatchObject({ renterName: "Anna Meier", plate: "ZH 513 925", weekNumber: 2 });
  });

  it("offers the open rentals and their open weeks as choices", async () => {
    const { rental } = await onePaidOneWaiting();
    const waiting = await prisma.payment.findFirstOrThrow({ where: { status: "NEEDS_REVIEW" } });

    const detail = await paymentDetail(prisma, waiting.id);
    const choice = detail?.choices.find((c) => c.rentalId === rental.id);
    expect(choice?.openCharges.map((c) => c.weekNumber)).toEqual([1, 3, 4, 5, 6, 7, 8]);
  });
});
```

Add to `lib/admin/attention.test.ts` (inside its top-level `describe`):

```ts
  it("adds one payment row when payments wait for the office", () => {
    const items = attentionItems({ rentals: [], paymentReview: 2 }, new Date("2026-10-12T08:00:00Z"));
    expect(items).toEqual([{ kind: "payment", key: "payment:waiting", customerName: "", count: 2 }]);
  });
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm test lib/admin/attention.test.ts && pnpm test:db tests/db/paymentQueries.test.ts`
Expected: FAIL — `paymentReview` is not a property of `AttentionSource`; `Cannot find module '@/lib/payments/queries'`.

- [ ] **Step 3: Write the queries**

`lib/payments/queries.ts`:

```ts
/**
 * What the payments screen reads. Shapes are plain JSON for the client.
 */

import type { PrismaClient } from "@/generated/prisma/client";
import { OPEN_CHARGE } from "./twint/decide";

export type PaymentTab = "review" | "booked" | "all";

const STATUS_OF: Record<PaymentTab, ("BOOKED" | "NEEDS_REVIEW" | "IGNORED")[]> = {
  review: ["NEEDS_REVIEW"],
  booked: ["BOOKED"],
  all: ["NEEDS_REVIEW", "BOOKED", "IGNORED"],
};

export interface PaymentRow {
  id: string;
  status: string;
  reviewReason: string | null;
  paidAt: string;
  amountCents: number;
  payerName: string | null;
  message: string | null;
  plate: string | null;
  renterName: string | null;
  weekNumber: number | null;
}

const rowInclude = {
  rental: { select: { car: { select: { plate: true } }, customer: { select: { firstName: true, lastName: true } } } },
  charge: { select: { weekNumber: true } },
} as const;

export async function paymentList(client: PrismaClient, tab: PaymentTab): Promise<PaymentRow[]> {
  const payments = await client.payment.findMany({
    where: { status: { in: STATUS_OF[tab] } },
    orderBy: { paidAt: "desc" },
    take: 200,
    include: rowInclude,
  });
  return payments.map((p) => ({
    id: p.id,
    status: p.status,
    reviewReason: p.reviewReason,
    paidAt: p.paidAt.toISOString(),
    amountCents: p.amountCents,
    payerName: p.payerName,
    message: p.message,
    plate: p.rental?.car.plate ?? null,
    renterName: p.rental ? `${p.rental.customer.firstName} ${p.rental.customer.lastName}` : null,
    weekNumber: p.charge?.weekNumber ?? null,
  }));
}

export function paymentReviewCount(client: PrismaClient): Promise<number> {
  return client.payment.count({ where: { status: "NEEDS_REVIEW" } });
}

export interface PaymentChoice {
  rentalId: string;
  renterName: string;
  plate: string;
  carModel: string;
  startAt: string;
  status: string;
  isCandidate: boolean;
  openCharges: { id: string; weekNumber: number; amountCents: number; status: string; dueDate: string }[];
}

export interface PaymentDetailData extends PaymentRow {
  externalId: string;
  payerEmail: string | null;
  payerPhone: string | null;
  matchedBy: string | null;
  choices: PaymentChoice[];
  events: { type: string; actorName: string | null; createdAt: string; payload: unknown }[];
}

const RUNNING = ["ACTIVE", "EXTENSION_REQUESTED", "RETURN_SUBMITTED"] as const;

export async function paymentDetail(client: PrismaClient, id: string): Promise<PaymentDetailData | null> {
  const p = await client.payment.findUnique({
    where: { id },
    include: { ...rowInclude, events: { orderBy: { createdAt: "asc" } } },
  });
  if (!p) return null;

  const pinned = [...p.candidates, ...(p.rentalId ? [p.rentalId] : [])];
  const rentals = await client.rental.findMany({
    where: { organisationId: p.organisationId, OR: [{ id: { in: pinned } }, { status: { in: [...RUNNING] } }] },
    orderBy: { startAt: "desc" },
    include: {
      car: { select: { plate: true, model: true } },
      customer: { select: { firstName: true, lastName: true } },
      charges: { where: { status: { in: [...OPEN_CHARGE] } }, orderBy: { weekNumber: "asc" } },
    },
  });
  const choices: PaymentChoice[] = rentals
    .map((r) => ({
      rentalId: r.id,
      renterName: `${r.customer.firstName} ${r.customer.lastName}`,
      plate: r.car.plate,
      carModel: r.car.model,
      startAt: r.startAt.toISOString(),
      status: r.status,
      isCandidate: pinned.includes(r.id),
      openCharges: r.charges.map((c) => ({
        id: c.id,
        weekNumber: c.weekNumber,
        amountCents: c.amountCents,
        status: c.status,
        dueDate: c.dueDate.toISOString(),
      })),
    }))
    .sort((a, b) => Number(b.isCandidate) - Number(a.isCandidate));

  return {
    id: p.id,
    status: p.status,
    reviewReason: p.reviewReason,
    paidAt: p.paidAt.toISOString(),
    amountCents: p.amountCents,
    payerName: p.payerName,
    message: p.message,
    plate: p.rental?.car.plate ?? null,
    renterName: p.rental ? `${p.rental.customer.firstName} ${p.rental.customer.lastName}` : null,
    weekNumber: p.charge?.weekNumber ?? null,
    externalId: p.externalId,
    payerEmail: p.payerEmail,
    payerPhone: p.payerPhone,
    matchedBy: p.matchedBy,
    choices,
    events: p.events.map((e) => ({
      type: e.type,
      actorName: e.actorName,
      createdAt: e.createdAt.toISOString(),
      payload: e.payload,
    })),
  };
}
```

- [ ] **Step 4: Write the two read routes**

`app/api/admin/payments/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/session";
import { paymentList, type PaymentTab } from "@/lib/payments/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TABS: PaymentTab[] = ["review", "booked", "all"];

export async function GET(request: Request) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ code: "unauthorised" }, { status: 401 });
  const asked = new URL(request.url).searchParams.get("tab") as PaymentTab | null;
  const tab = asked && TABS.includes(asked) ? asked : "review";
  return NextResponse.json({ payments: await paymentList(prisma, tab) }, { headers: { "cache-control": "no-store" } });
}
```

`app/api/admin/payments/[id]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/session";
import { paymentDetail } from "@/lib/payments/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ code: "unauthorised" }, { status: 401 });
  const detail = await paymentDetail(prisma, (await params).id);
  if (!detail) return NextResponse.json({ code: "not-found" }, { status: 404 });
  return NextResponse.json(detail, { headers: { "cache-control": "no-store" } });
}
```

- [ ] **Step 5: The Overview item**

In `lib/admin/attention.ts`:
- add to `AttentionSource`: `/** Absent before the payments feature, and treated as nothing waiting. */ paymentReview?: number;`
- change `AttentionKind` to `"return" | "ending" | "mail" | "fine" | "payment"`;
- before the final `return`, add:

```ts
  const paymentCount = source.paymentReview ?? 0;
  const payment: AttentionItem[] =
    paymentCount > 0 ? [{ kind: "payment", key: "payment:waiting", customerName: "", count: paymentCount }] : [];
```

- and return `[...returns, ...endings, ...mail, ...fine, ...payment]`. Add "4. payment  TWINT payments the system would not book." to the header comment's list.

In `components/admin/overview/attentionText.ts`, add the `payment` case to each function:

```ts
// attentionTitle, first line
  if (item.kind === "payment") return L.overview.paymentsWaiting;
// attentionDetail, first line
  if (item.kind === "payment") {
    const count = item.count ?? 0;
    return `${count} ${count === 1 ? L.overview.paymentOne : L.overview.paymentMany}`;
  }
// attentionHref, first line
  if (item.kind === "payment") return "/admin/payments/?tab=review";
```

In `components/admin/types.ts`, beside `fineAttention`: `/** Absent on a deployment older than the payments feature. */ paymentReview?: number;`

In `app/api/admin/overview/route.ts`: import `paymentReviewCount` from `@/lib/payments/queries`; beside `const fineAttention = …` add `const paymentReview = await paymentReviewCount(prisma);`; add `paymentReview: number;` to the payload type next to `fineAttention`, and `paymentReview,` to the returned payload.

- [ ] **Step 6: The copy**

In `lib/admin/labels.ts`, `de`:

```ts
// in nav
    payments: "Zahlungen",
// in overview
    paymentsWaiting: "Zahlungen zu prüfen",
    paymentOne: "Zahlung",
    paymentMany: "Zahlungen",
// a new top-level block after fines
  payments: {
    heading: "TWINT-Zahlungen",
    intro: "Zahlungen aus den TWINT-Mails. Was das System nicht sicher zuordnen konnte, wartet hier.",
    tabReview: "Zu prüfen",
    tabBooked: "Verbucht",
    tabAll: "Alle",
    empty: "Keine Zahlungen.",
    paidAt: "Bezahlt am",
    amount: "Betrag",
    payer: "Zahler/in",
    message: "Nachricht",
    renter: "Mieter/in",
    week: "Woche",
    why: "Warum es wartet",
    chooseRental: "Miete wählen",
    chooseWeek: "Woche wählen",
    asCredit: "Ohne Woche — als Guthaben auf die Miete",
    book: "Verbuchen",
    ignore: "Ignorieren",
    ignoreNote: "Grund (z. B. Testzahlung)",
    undo: "Rückgängig machen",
    back: "Zurück",
    timeline: "Verlauf",
    bySystem: "System",
    reasonNO_PLATE: "Kein Kennzeichen in der Nachricht",
    reasonPLATE_NOT_IN_FLEET: "Kennzeichen gehört zu keinem unserer Fahrzeuge",
    reasonPLATE_AMBIGUOUS: "Nachricht nennt mehrere Fahrzeuge",
    reasonPLATE_DOUBTFUL: "Kennzeichen nur ähnlich — bitte prüfen",
    reasonNO_RENTAL_AT_TIME: "Zu diesem Zeitpunkt hatte niemand das Fahrzeug",
    reasonHANDOVER_BOUNDARY: "Bezahlt nahe an einer Übergabe",
    reasonOVERLAPPING_RENTALS: "Zwei Mieten überschneiden sich",
    reasonPAYER_MISMATCH: "Jemand anderes als die Mieterin / der Mieter hat bezahlt",
    reasonAMOUNT_MISMATCH: "Betrag passt zu keiner offenen Woche",
    reasonCHARGE_ALREADY_PAID: "Diese Woche ist schon bezahlt",
  },
```

`en` (same keys):

```ts
// in nav
    payments: "Payments",
// in overview
    paymentsWaiting: "Payments to review",
    paymentOne: "payment",
    paymentMany: "payments",
// after fines
  payments: {
    heading: "TWINT payments",
    intro: "Payments from TWINT's emails. Whatever the system could not match for certain waits here.",
    tabReview: "To review",
    tabBooked: "Booked",
    tabAll: "All",
    empty: "No payments.",
    paidAt: "Paid at",
    amount: "Amount",
    payer: "Payer",
    message: "Message",
    renter: "Renter",
    week: "Week",
    why: "Why it waits",
    chooseRental: "Choose the rental",
    chooseWeek: "Choose the week",
    asCredit: "No week — credit on the rental",
    book: "Book",
    ignore: "Ignore",
    ignoreNote: "Reason (e.g. test payment)",
    undo: "Undo",
    back: "Back",
    timeline: "Timeline",
    bySystem: "System",
    reasonNO_PLATE: "No plate in the message",
    reasonPLATE_NOT_IN_FLEET: "The plate is none of our cars",
    reasonPLATE_AMBIGUOUS: "The message names several cars",
    reasonPLATE_DOUBTFUL: "The plate is only similar — please check",
    reasonNO_RENTAL_AT_TIME: "Nobody had the car at that moment",
    reasonHANDOVER_BOUNDARY: "Paid close to a handover",
    reasonOVERLAPPING_RENTALS: "Two rentals overlap",
    reasonPAYER_MISMATCH: "Someone other than the renter paid",
    reasonAMOUNT_MISMATCH: "The amount matches no open week",
    reasonCHARGE_ALREADY_PAID: "That week is already paid",
  },
```

- [ ] **Step 7: The navigation item**

In `components/admin/shell/Rail.tsx`, import `Wallet` from `lucide-react` and add after the fines item:

```tsx
    // Beside the fines: both are money the office has to match to a renter.
    { href: "/admin/payments", label: L.nav.payments, icon: Wallet },
```

- [ ] **Step 8: The screen**

`app/admin/payments/page.tsx`:

```tsx
"use client";

import { Suspense } from "react";
import { PaymentsSection } from "@/components/admin/sections/PaymentsSection";

/** Suspense for `useSearchParams`: the tab and the open payment live in the URL. */
export default function AdminPaymentsPage() {
  return (
    <Suspense fallback={null}>
      <PaymentsSection />
    </Suspense>
  );
}
```

Append to `components/admin/format.ts` (both payment components use it; keeping it in either would make them import each other):

```ts
/** An instant as the office reads it: Zurich date and time. Unlike `day`,
 *  this one is a moment, so it does go through Date — in Zurich's zone. */
export function zurichTime(iso: string): string {
  return new Date(iso).toLocaleString("de-CH", {
    timeZone: "Europe/Zurich",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
```

`components/admin/sections/PaymentsSection.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAdmin } from "@/components/admin/shell/AdminContext";
import { Panel } from "@/components/admin/parts/Panel";
import { PaymentDetail } from "@/components/admin/parts/PaymentDetail";
import { formatChf } from "@/lib/rental/money";
import { zurichTime } from "@/components/admin/format";
import type { PaymentRow } from "@/lib/payments/queries";

/**
 * TWINT payments: what booked itself, and what waits for one click.
 * Opens on "To review", the one tab that needs anybody.
 */

type Tab = "review" | "booked" | "all";

export function PaymentsSection() {
  const { L, reload } = useAdmin();
  const P = L.payments;
  const params = useSearchParams();
  const router = useRouter();
  const tab = (["review", "booked", "all"].includes(params.get("tab") ?? "") ? params.get("tab") : "review") as Tab;
  const paymentId = params.get("payment");
  const [rows, setRows] = useState<PaymentRow[] | null>(null);

  const load = useCallback(async () => {
    const response = await fetch(`/api/admin/payments/?tab=${tab}`);
    if (response.ok) setRows((await response.json()).payments);
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);

  const go = (next: { tab?: Tab; payment?: string | null }) => {
    const query = new URLSearchParams({ tab: next.tab ?? tab });
    if (next.payment) query.set("payment", next.payment);
    router.push(`/admin/payments/?${query.toString()}`);
  };

  if (paymentId) {
    return (
      <PaymentDetail
        paymentId={paymentId}
        onBack={() => go({ payment: null })}
        onChanged={() => {
          void load();
          void reload();
        }}
      />
    );
  }

  const tabs: [Tab, string][] = [
    ["review", P.tabReview],
    ["booked", P.tabBooked],
    ["all", P.tabAll],
  ];
  const reason = (key: string | null) => (key ? ((P as Record<string, string>)[`reason${key}`] ?? key) : "");

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">{P.heading}</h1>
        <p className="mt-1 text-sm text-[var(--admin-muted)]">{P.intro}</p>
      </header>

      <Panel
        title={P.heading}
        meta={rows ? String(rows.length) : undefined}
        action={
          <nav className="flex flex-wrap gap-1" aria-label={P.heading}>
            {tabs.map(([key, name]) => (
              <button
                key={key}
                type="button"
                onClick={() => go({ tab: key })}
                aria-current={key === tab ? "page" : undefined}
                className={`h-8 rounded-md px-3 text-sm ${
                  key === tab
                    ? "bg-[var(--admin-accent)] text-[var(--admin-accent-ink)]"
                    : "text-[var(--admin-muted)] hover:bg-[var(--admin-sunk)]"
                }`}
              >
                {name}
              </button>
            ))}
          </nav>
        }
      >
        {rows && rows.length === 0 && <p className="px-4 py-6 text-sm text-[var(--admin-muted)]">{P.empty}</p>}
        <ul className="divide-y divide-[var(--admin-rule)]">
          {(rows ?? []).map((row) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => go({ payment: row.id })}
                className="flex w-full flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-left hover:bg-[var(--admin-sunk)]"
              >
                <span className="min-w-0">
                  <span className="font-medium">CHF {formatChf(row.amountCents)}</span>
                  <span className="text-[var(--admin-muted)]"> · {zurichTime(row.paidAt)} · {row.payerName ?? "—"}</span>
                  <span className="block truncate text-xs text-[var(--admin-faint)]">{row.message ?? "—"}</span>
                </span>
                <span className="text-sm">
                  {row.status === "NEEDS_REVIEW" ? (
                    <span className="text-[var(--admin-crit)]">{reason(row.reviewReason)}</span>
                  ) : (
                    <span className="text-[var(--admin-muted)]">
                      {[row.renterName, row.plate, row.weekNumber ? `${P.week} ${row.weekNumber}` : null]
                        .filter(Boolean)
                        .join(" · ") || row.status}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
```

`components/admin/parts/PaymentDetail.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdmin } from "@/components/admin/shell/AdminContext";
import { Panel } from "@/components/admin/parts/Panel";
import { zurichTime } from "@/components/admin/format";
import { formatChf } from "@/lib/rental/money";
import type { PaymentDetailData } from "@/lib/payments/queries";

/** One payment: what TWINT said, why it waits, and the choice to book it. */
export function PaymentDetail({
  paymentId,
  onBack,
  onChanged,
}: {
  paymentId: string;
  onBack: () => void;
  onChanged: () => void;
}) {
  const { L, write, busy } = useAdmin();
  const P = L.payments;
  const [detail, setDetail] = useState<PaymentDetailData | null>(null);
  const [rentalId, setRentalId] = useState<string>("");
  const [chargeId, setChargeId] = useState<string>("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    const response = await fetch(`/api/admin/payments/${paymentId}/`);
    if (!response.ok) return;
    const data: PaymentDetailData = await response.json();
    setDetail(data);
    const first = data.choices.find((c) => c.isCandidate) ?? data.choices[0];
    setRentalId(first?.rentalId ?? "");
    setChargeId(first?.openCharges.find((c) => c.amountCents === data.amountCents)?.id ?? "");
  }, [paymentId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!detail) return null;
  const choice = detail.choices.find((c) => c.rentalId === rentalId);
  const act = async (body: unknown) => {
    if (await write(`/api/admin/payments/${paymentId}/actions/`, { method: "POST", body: JSON.stringify(body) })) {
      await load();
      onChanged();
    }
  };
  const reason = detail.reviewReason ? ((P as Record<string, string>)[`reason${detail.reviewReason}`] ?? detail.reviewReason) : null;
  const field = "h-9 w-full rounded-md border border-[var(--admin-rule-strong)] bg-[var(--admin-surface)] px-2 text-sm";
  const button = "inline-flex h-9 items-center rounded-md px-4 text-sm disabled:opacity-50";

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="text-sm text-[var(--admin-muted)] hover:underline">
        ← {P.back}
      </button>

      <Panel title={`CHF ${formatChf(detail.amountCents)} · ${zurichTime(detail.paidAt)}`} meta={detail.status}>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 px-4 py-3 text-sm">
          <dt className="text-[var(--admin-muted)]">{P.payer}</dt>
          <dd>{[detail.payerName, detail.payerEmail, detail.payerPhone].filter(Boolean).join(" · ") || "—"}</dd>
          <dt className="text-[var(--admin-muted)]">{P.message}</dt>
          <dd className="whitespace-pre-line">{detail.message ?? "—"}</dd>
          {reason && (
            <>
              <dt className="text-[var(--admin-muted)]">{P.why}</dt>
              <dd className="text-[var(--admin-crit)]">{reason}</dd>
            </>
          )}
          {detail.renterName && (
            <>
              <dt className="text-[var(--admin-muted)]">{P.renter}</dt>
              <dd>
                {[detail.renterName, detail.plate, detail.weekNumber ? `${P.week} ${detail.weekNumber}` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </dd>
            </>
          )}
        </dl>
      </Panel>

      {detail.status === "NEEDS_REVIEW" && (
        <Panel title={P.book}>
          <div className="grid gap-3 px-4 py-3 sm:grid-cols-2">
            <label className="text-sm">
              {P.chooseRental}
              <select
                className={field}
                value={rentalId}
                onChange={(e) => {
                  setRentalId(e.target.value);
                  setChargeId("");
                }}
              >
                {detail.choices.map((c) => (
                  <option key={c.rentalId} value={c.rentalId}>
                    {c.isCandidate ? "★ " : ""}
                    {c.renterName} · {c.plate} · {c.carModel}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              {P.chooseWeek}
              <select className={field} value={chargeId} onChange={(e) => setChargeId(e.target.value)}>
                <option value="">{P.asCredit}</option>
                {(choice?.openCharges ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {P.week} {c.weekNumber} · CHF {formatChf(c.amountCents)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-end gap-2 border-t border-[var(--admin-rule)] px-4 py-3">
            <button
              type="button"
              disabled={busy || !rentalId}
              onClick={() => act({ action: "book", rentalId, chargeId: chargeId || null })}
              className={`${button} bg-[var(--admin-accent)] text-[var(--admin-accent-ink)]`}
            >
              {P.book}
            </button>
            <input
              className={`${field} max-w-xs`}
              placeholder={P.ignoreNote}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <button
              type="button"
              disabled={busy || !note.trim()}
              onClick={() => act({ action: "ignore", note })}
              className={`${button} border border-[var(--admin-rule-strong)]`}
            >
              {P.ignore}
            </button>
          </div>
        </Panel>
      )}

      {detail.status !== "NEEDS_REVIEW" && (
        <button
          type="button"
          disabled={busy}
          onClick={() => act({ action: "undo" })}
          className={`${button} border border-[var(--admin-rule-strong)]`}
        >
          {P.undo}
        </button>
      )}

      <Panel title={P.timeline}>
        <ul className="space-y-1 px-4 py-3 text-sm">
          {detail.events.map((e) => (
            <li key={`${e.type}-${e.createdAt}`}>
              {zurichTime(e.createdAt)} · {e.type} · {e.actorName ?? P.bySystem}
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
```

`PaymentRow` and `PaymentDetailData` are imported as types only, so no server code reaches the client bundle.

- [ ] **Step 9: Run every test and the type check**

Run: `pnpm test && pnpm test:db && pnpm exec tsc --noEmit && pnpm lint`
Expected: PASS, no type errors (the `en: typeof de` labels catch a missing English key).

- [ ] **Step 10: Look at it in a browser before calling it done**

Run `pnpm dev`, sign in at `/admin`, ingest two emails through the local cron call from Task 7, and check by eye — at desktop width and at 390 px wide:
1. The Overview shows "Zahlungen zu prüfen" with the count, and its link opens the review tab.
2. "Zahlungen" appears in the navigation beside "Bussen".
3. A waiting payment opens, shows its reason in plain words, pre-selects the candidate rental (★) and the week with the same amount.
4. "Verbuchen" moves it to the Booked tab; "Rückgängig machen" brings it back and the week is unpaid again.
5. "Ignorieren" stays disabled until a reason is typed.

Write down what was seen and what was only reasoned in the commit message body.

- [ ] **Step 11: Commit**

```bash
git add lib/payments/queries.ts app/api/admin/payments app/admin/payments components/admin lib/admin tests/db/paymentQueries.test.ts app/api/admin/overview/route.ts
git commit -m "feat(payments): a screen for payments that wait, and an Overview item"
```

---

### Task 10: The payment request carries the reference into TWINT

**Gate:** only start once Task 0 Step 6 recorded that `trxInfo` shows up in the email's Nachricht. If it lands under another label, first add that label to `LABELS` in `lib/payments/twint/parse.ts`, include it in `message`, and add a parse test for it.

**Files:**
- Modify: `lib/payment.ts` (add `twintLinkFor`)
- Modify: `lib/rental/lifecycleMail.ts` (`chargeDueMail` gains `twintUrl`)
- Modify: `lib/rental/scheduler.ts` (every `chargeDueMail({...})` call passes it)
- Test: `lib/payment.test.ts` (create), `lib/rental/lifecycleMail.test.ts` (create — no unit test of `chargeDueMail` exists yet)

**Interfaces:**
- Consumes: `TWINT_URL` from `@/lib/payment`.
- Produces: `twintLinkFor(reference: string, amountCents: number): string`; `chargeDueMail(ctx & { twintUrl: string })`.

- [ ] **Step 1: Write the failing tests**

`lib/payment.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { TWINT_URL, twintLinkFor } from "./payment";

describe("twintLinkFor", () => {
  it("pre-fills the reference and the amount on our TWINT link", () => {
    expect(twintLinkFor("ZH 513 925 W3", 45_000)).toBe(`${TWINT_URL}&trxInfo=ZH%20513%20925%20W3&amount=450.00`);
  });
});
```

Create `lib/rental/lifecycleMail.test.ts` with `import { describe, expect, it } from "vitest";`, `import { chargeDueMail } from "./lifecycleMail";` and a `describe("chargeDueMail", () => { … })` holding:

```ts
  it("offers TWINT with the reference already filled in", () => {
    const mail = chargeDueMail({
      firstName: "Anna",
      carModel: "Toyota Prius Hybrid",
      plate: "ZH 513 925",
      weekNumber: 3,
      amountCents: 45_000,
      paymentUrl: "https://pay.sumup.com/b2c/QH47IRGK",
      twintUrl: "https://go.twint.ch/x&trxInfo=ZH%20513%20925%20W3&amount=450.00",
      reference: "ZH 513 925 W3",
      language: "de",
      isReminder: false,
    });
    expect(mail.text).toContain("TWINT: https://go.twint.ch/x&trxInfo=ZH%20513%20925%20W3&amount=450.00");
  });
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm test lib/payment.test.ts lib/rental/lifecycleMail.test.ts`
Expected: FAIL — `twintLinkFor is not a function`; the mail text has no `TWINT:` line.

- [ ] **Step 3: Implement**

Append to `lib/payment.ts`:

```ts
/**
 * Our TWINT link with the reference and amount pre-filled, so the payment's
 * notification email names the car and week the matcher looks for
 * (lib/payments/twint). TWINT lets the payer edit both — the matcher still
 * checks the amount — but most leave them as they are.
 */
export function twintLinkFor(reference: string, amountCents: number): string {
  return `${TWINT_URL}&trxInfo=${encodeURIComponent(reference)}&amount=${(amountCents / 100).toFixed(2)}`;
}
```

In `lib/rental/lifecycleMail.ts`, add `twintUrl: string;` to `chargeDueMail`'s `ctx` type, and in both languages insert after the line with `ctx.paymentUrl`:

```ts
        "",
        `TWINT: ${ctx.twintUrl}`,
```

In `lib/rental/scheduler.ts`, import `twintLinkFor` from `@/lib/payment` and pass `twintUrl: twintLinkFor(reference, charge.amountCents),` in every `chargeDueMail({ … })` call (the request and the reminder; `grep -n "chargeDueMail(" lib/rental/scheduler.ts` lists them). Where a call site builds `reference` differently, build it as `` `${rental.car.plate} W${charge.weekNumber}` `` — the same string the matcher expects.

- [ ] **Step 4: Run all tests**

Run: `pnpm test && pnpm test:db`
Expected: PASS, including `tests/db/scheduler.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add lib/payment.ts lib/payment.test.ts lib/rental/lifecycleMail.ts lib/rental/lifecycleMail.test.ts lib/rental/scheduler.ts
git commit -m "feat(payments): payment requests pre-fill the reference in TWINT"
```

---

### Task 11: Setup notes and going live

**Files:**
- Create: `docs/PAYMENTS-SETUP.md`

- [ ] **Step 1: Write the setup document**

`docs/PAYMENTS-SETUP.md` must cover, in this order, each as a short numbered step with the exact values:

1. Hostinger hPanel → Emails → create `payments@zuriauto.ch`.
2. In the `info@` webmail, add a filter: From contains `no-reply@twintpay.ch` → forward a copy to `payments@zuriauto.ch` (keep the original in info@). Then send one TWINT test payment and run `pnpm twint:peek` with `TWINT_IMAP_USER=payments@zuriauto.ch` to confirm the forwarded copy still shows `DKIM pass`. If it does not, read `info@` directly instead and record that decision here.
3. Vercel → Project → Settings → Environment Variables (Production): `TWINT_IMAP_USER`, `TWINT_IMAP_PASS` (and only if they differ from the defaults: `TWINT_IMAP_HOST`, `TWINT_IMAP_PORT`, `TWINT_IMAP_MAILBOX`, `TWINT_LOOKBACK_DAYS`). `CRON_SECRET` already exists.
4. The trigger: on cron-job.org create a job, URL `https://<production domain>/api/cron/payments/`, every 10 minutes, method POST, header `Authorization: Bearer <CRON_SECRET>`. Or, on Vercel Pro, add `{ "path": "/api/cron/payments/", "schedule": "*/10 * * * *" }` to `crons` in `vercel.json`.
5. First run: call it once by hand (`curl -X POST -H "Authorization: Bearer …" https://…/api/cron/payments/`) and check the counts. Expected the first time: everything from the last 14 days arrives, mostly `review` for payments older than the feature.
6. The first week: look at "Zahlungen" daily. Write down how many booked themselves and why the rest waited — this decides whether the Stripe/Payrexx route (spec, "Out of scope") is worth it.
7. Turning it off: delete `TWINT_IMAP_USER` in Vercel. The route answers `skipped` and nothing else changes.

- [ ] **Step 2: Deploy to a preview and check it there**

Push the branch, open the Vercel preview, set the env vars for Preview, call the route with curl, open `/admin/payments` on the preview. Record what was seen.

- [ ] **Step 3: Commit**

```bash
git add docs/PAYMENTS-SETUP.md
git commit -m "docs(payments): how to switch TWINT payment reading on"
```

---

## Self-review notes

- Spec coverage: decisions 1–8 → Tasks 2 (1), 3 (2), 1/6 (3), 4/5/6 (4), 6/8 (5, 6), 7 (7), 10 (8). Out-of-scope items have no task by design.
- The double-payment, forged-mail, handover, plate-spelling and amount/date-format cases from Review Focus each have a named test in Tasks 2–6.
- Names used across tasks: `TwintNotification`, `RawMail`, `IngestOutcome`, `Evidence`, `Decision`, `OPEN_CHARGE`, `bookCharge`, `recordPaymentEvent`, `gatherEvidence`, `decidePayment`, `ingestMail`, `twintPaymentPass`, `fetchTwintMails`, `readMailboxConfig`, `cronAuthorised`, `applyPaymentAction`, `paymentList`, `paymentDetail`, `paymentReviewCount`, `twintLinkFor` — each defined once, in the task that produces it.
